#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const HERE =
  import.meta.dirname ?? path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const REPO_ROOT = path.dirname(HERE);
const RESULTS_DIR = path.join(HERE, 'results');
const TAIL_LINES = 40;

const STAGE_ORDER = [
  'install',
  'pods',
  'ios-cold',
  'ios-incremental',
  'android-cold',
  'metro-cold',
  'worktree-to-running',
];

const STAGE_TIMEOUT_MS = {
  install: 20 * 60_000,
  pods: 30 * 60_000,
  'ios-cold': 60 * 60_000,
  'ios-incremental': 20 * 60_000,
  'android-cold': 60 * 60_000,
  'metro-cold': 30 * 60_000,
  'worktree-to-running': 90 * 60_000,
};

const HELP = `
  npm run bench -- [options]

  Times the stages of an AI-agent build/implement/validate loop for this repo and
  writes a JSON record plus per-stage logs under bench/results/.

  Options
    --only <a,b>     Run only these stages (comma separated).
    --skip <a,b>     Skip these stages (applied after --only).
    --label <name>   Label for this run; becomes part of the result filename.
                     Default: "baseline".
    --json           Print the result JSON on stdout; the summary table goes to
                     stderr so the JSON stays pipeable.
    --help           Show this message.

  Stages, in order
    install               rm -rf node_modules, then a cold install with the
                          package manager the lockfile declares.
    pods                  rm -rf ios/Pods ios/build, then a CocoaPods install.
    ios-cold              Purged debug simulator build (arm64 simulator).
    ios-incremental       Touch one JS source file, then rebuild.
    android-cold          Purge android build dirs, then ./gradlew assembleDebug.
    metro-cold            Cold Metro bundle via expo export:embed, caches cleared.
    worktree-to-running   Fresh git worktree of HEAD -> app installed on a
                          simulator -> worktree torn down.

  Environment
    BENCH_SIM_UDID   Force a specific simulator UDID instead of auto-picking one.
`;

class StageLog {
  #fd;
  #pending = { out: '', err: '' };
  #out = [];
  #err = [];

  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file;
    this.#fd = fs.openSync(file, 'a');
  }

  note(text) {
    this.#write(text.endsWith('\n') ? text : `${text}\n`);
  }

  chunk(stream, data) {
    const text = data.toString();
    this.#write(text);
    const ring = stream === 'err' ? this.#err : this.#out;
    const lines = (this.#pending[stream] + text).split('\n');
    this.#pending[stream] = lines.pop();
    for (const line of lines) ring.push(line);
    if (ring.length > TAIL_LINES) ring.splice(0, ring.length - TAIL_LINES);
  }

  // Prefer stderr for the failure excerpt, but xcodebuild and gradle put most of
  // their diagnostics on stdout, so fall back rather than reporting nothing.
  tail() {
    const flushed = (ring, pending) => (pending ? [...ring, pending] : ring);
    const err = flushed(this.#err, this.#pending.err).filter((l) => l.trim());
    if (err.length) return err.slice(-TAIL_LINES);
    return flushed(this.#out, this.#pending.out).slice(-TAIL_LINES);
  }

  close() {
    try {
      fs.closeSync(this.#fd);
    } catch {}
  }

  #write(text) {
    try {
      fs.writeSync(this.#fd, text);
    } catch {}
  }
}

const LIVE = new Set();

function killTree(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    // Children are spawned detached, so the negated pid addresses the whole
    // process group -- xcodebuild, gradlew and npx all fan out into helpers that
    // outlive a signal sent to the direct child alone.
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
}

function killAllLive(signal) {
  for (const child of LIVE) killTree(child, signal);
}

let shuttingDown = false;
function onFatalSignal() {
  if (shuttingDown) process.exit(130);
  shuttingDown = true;
  process.stderr.write('\nbench: interrupted, terminating child processes...\n');
  killAllLive('SIGTERM');
  setTimeout(() => {
    killAllLive('SIGKILL');
    process.exit(130);
  }, 2000).unref();
}
process.on('SIGINT', onFatalSignal);
process.on('SIGTERM', onFatalSignal);
process.on('exit', () => killAllLive('SIGKILL'));

function exec({ cmd, args = [], cwd = REPO_ROOT, env, log, timeoutMs }) {
  return new Promise((resolve) => {
    log.note(`\n$ ${[cmd, ...args].join(' ')}\n  cwd: ${cwd}`);
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    LIVE.add(child);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child, 'SIGTERM');
      setTimeout(() => killTree(child, 'SIGKILL'), 5000).unref();
    }, Math.max(1000, timeoutMs));

    child.stdout.on('data', (d) => log.chunk('out', d));
    child.stderr.on('data', (d) => log.chunk('err', d));

    child.on('error', (err) => {
      clearTimeout(timer);
      LIVE.delete(child);
      log.note(`spawn error: ${err.message}`);
      resolve({ code: null, signal: null, timedOut, spawnError: err.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      LIVE.delete(child);
      log.note(`exit: code=${code} signal=${signal ?? 'none'}`);
      resolve({ code, signal, timedOut });
    });
  });
}

function capture(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
      ...opts,
    }).trim();
  } catch {
    return null;
  }
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
}

function exists(p) {
  return fs.existsSync(p);
}

function pgrepPids(pattern) {
  const out = capture('pgrep', ['-f', pattern]);
  if (!out) return new Set();
  return new Set(
    out
      .split('\n')
      .map((l) => Number(l.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
  );
}

// pgrep uses extended regex; these are the shapes a React Native packager takes
// when something spawns one behind our back.
const METRO_PATTERN = 'cli\\.js start|expo start|metro/src/index';

function reapNew(pattern, before, log, what) {
  const started = [...pgrepPids(pattern)].filter((pid) => !before.has(pid));
  if (!started.length) return;
  log.note(`bench: terminating ${started.length} ${what} process(es) this stage started: ${started.join(', ')}`);
  for (const pid of started) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
}

function detectPackageManager() {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = exists(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  const declared = typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : null;
  const lockfiles = [
    ['package-lock.json', 'npm'],
    ['npm-shrinkwrap.json', 'npm'],
    ['yarn.lock', 'yarn'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
  ];
  const found = lockfiles.find(([file]) => exists(path.join(REPO_ROOT, file)));
  const name = declared || found?.[1] || 'npm';
  return { name, lockfile: found?.[0] ?? null, version: capture(name, ['--version']) };
}

function installCommand(pm) {
  const locked = Boolean(pm.lockfile);
  switch (pm.name) {
    case 'yarn': {
      const major = Number(String(pm.version ?? '1').split('.')[0]);
      if (!locked) return { cmd: 'yarn', args: ['install'] };
      return { cmd: 'yarn', args: ['install', major >= 2 ? '--immutable' : '--frozen-lockfile'] };
    }
    case 'pnpm':
      return { cmd: 'pnpm', args: locked ? ['install', '--frozen-lockfile'] : ['install'] };
    case 'bun':
      return { cmd: 'bun', args: locked ? ['install', '--frozen-lockfile'] : ['install'] };
    default:
      return { cmd: 'npm', args: [locked ? 'ci' : 'install'] };
  }
}

function podsCommand(root) {
  const iosDir = path.join(root, 'ios');
  const iosGemfile = path.join(iosDir, 'Gemfile');
  const rootGemfile = path.join(root, 'Gemfile');
  if (exists(iosGemfile)) {
    return { cmd: 'bundle', args: ['exec', 'pod', 'install'], cwd: iosDir, how: 'bundle exec pod install (ios/Gemfile)' };
  }
  if (exists(rootGemfile) && fs.readFileSync(rootGemfile, 'utf8').includes('cocoapods')) {
    return {
      cmd: 'bundle',
      args: ['exec', 'pod', 'install'],
      cwd: iosDir,
      env: { BUNDLE_GEMFILE: rootGemfile },
      how: 'bundle exec pod install (root Gemfile)',
    };
  }
  if (capture('which', ['pod'])) {
    return { cmd: 'pod', args: ['install'], cwd: iosDir, how: 'pod install' };
  }
  return { cmd: 'npx', args: ['pod-install', 'ios'], cwd: root, how: 'npx pod-install' };
}

function xcodeProject(root) {
  const iosDir = path.join(root, 'ios');
  if (!exists(iosDir)) return null;
  const workspace = fs.readdirSync(iosDir).find((n) => n.endsWith('.xcworkspace'));
  if (!workspace) return null;
  return {
    iosDir,
    root: path.dirname(iosDir),
    workspace: path.join(iosDir, workspace),
    scheme: workspace.replace(/\.xcworkspace$/, ''),
  };
}

// The harness deliberately does not pass -derivedDataPath: `ios/build` already
// holds React Native's codegen output and pointing derived data at it breaks the
// build, and using Xcode's default location means these timings share a cache
// with whatever `expo run:ios` the rest of the loop does.
function derivedDataRoot() {
  const custom = capture('defaults', ['read', 'com.apple.dt.Xcode', 'IDECustomDerivedDataLocation']);
  return custom && path.isAbsolute(custom)
    ? custom
    : path.join(os.homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData');
}

function derivedDataDirs(scheme) {
  try {
    return fs
      .readdirSync(derivedDataRoot())
      .filter((name) => name.startsWith(`${scheme}-`))
      .map((name) => path.join(derivedDataRoot(), name));
  } catch {
    return [];
  }
}

// xcodebuild echoes the script-phase environment, which is the cheapest way to
// learn where the .app landed when the derived data path is Xcode's hashed one.
function appPathFromLog(logFile) {
  let text;
  try {
    text = fs.readFileSync(logFile, 'utf8');
  } catch {
    return null;
  }
  const pick = (name) =>
    [...text.matchAll(new RegExp(`export ${name}\\\\?=(.*)$`, 'gm'))].map((m) => m[1].trim()).filter(Boolean);
  const dirs = pick('CONFIGURATION_BUILD_DIR').sort((a, b) => a.length - b.length);
  const names = pick('UNLOCALIZED_RESOURCES_FOLDER_PATH');
  if (!dirs.length || !names.length) return null;
  const candidate = path.join(dirs[0], names[names.length - 1]);
  return exists(candidate) ? candidate : null;
}

function appPathFromBuildSettings(project, sim) {
  const raw = capture(
    'xcodebuild',
    [
      '-workspace',
      project.workspace,
      '-scheme',
      project.scheme,
      '-configuration',
      'Debug',
      '-destination',
      `platform=iOS Simulator,id=${sim.udid}`,
      '-showBuildSettings',
      '-json',
    ],
    { cwd: project.root, timeout: 300_000 }
  );
  if (!raw) return null;
  try {
    for (const entry of JSON.parse(raw)) {
      const settings = entry.buildSettings ?? {};
      if (!settings.BUILT_PRODUCTS_DIR || !settings.FULL_PRODUCT_NAME) continue;
      const candidate = path.join(settings.BUILT_PRODUCTS_DIR, settings.FULL_PRODUCT_NAME);
      if (exists(candidate)) return candidate;
    }
  } catch {}
  return null;
}

// <derived data>/Build/Products/Debug-iphonesimulator/Foo.app -> <derived data>,
// but only when it really is a child of the derived data root.
function derivedDataDirForApp(appPath) {
  const dir = path.resolve(appPath, '..', '..', '..', '..');
  return path.dirname(dir) === derivedDataRoot() ? dir : null;
}

function pickSimulator() {
  if (process.env.BENCH_SIM_UDID) {
    return { udid: process.env.BENCH_SIM_UDID, name: '(BENCH_SIM_UDID)', runtime: 'unknown' };
  }
  const raw = capture('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  if (!raw) throw new Error('`xcrun simctl list` failed; are the Xcode command line tools installed?');
  const parsed = JSON.parse(raw);
  const candidates = [];
  for (const [runtime, devices] of Object.entries(parsed.devices ?? {})) {
    const match = /SimRuntime\.iOS-([\d-]+)$/.exec(runtime);
    if (!match) continue;
    const version = match[1].split('-').map(Number);
    for (const device of devices) {
      if (device.isAvailable === false) continue;
      if (!/^iPhone/.test(device.name)) continue;
      candidates.push({ udid: device.udid, name: device.name, state: device.state, runtime, version });
    }
  }
  if (!candidates.length) throw new Error('No available iPhone simulator found.');
  const booted = candidates.find((c) => c.state === 'Booted');
  if (booted) return booted;
  const compare = (a, b) => {
    for (let i = 0; i < Math.max(a.version.length, b.version.length); i += 1) {
      const diff = (b.version[i] ?? 0) - (a.version[i] ?? 0);
      if (diff) return diff;
    }
    return 0;
  };
  return candidates.sort(compare)[0];
}

function findTouchTarget(root) {
  const preferred = [
    'app/_layout.tsx',
    'app/(tabs)/index.tsx',
    'App.tsx',
    'App.js',
    'index.js',
    'index.ts',
  ];
  for (const rel of preferred) {
    if (exists(path.join(root, rel))) return rel;
  }
  const stack = ['app', 'src'].map((d) => path.join(root, d)).filter(exists);
  while (stack.length) {
    const dir = stack.shift();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) return path.relative(root, full);
    }
  }
  return null;
}

// Gitignored files a fresh worktree needs but git will not carry across. An
// optional `.worktreeinclude` at the repo root can name more of them, one
// gitignore-style pattern per line.
function worktreeCarryList(root) {
  const patterns = ['ios/.xcode.env.local'];
  const file = path.join(root, '.worktreeinclude');
  if (exists(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) patterns.push(trimmed);
    }
  }

  const matches = new Set();
  for (const pattern of patterns) {
    const dir = path.dirname(pattern);
    const base = path.basename(pattern);
    if (!base.includes('*')) {
      if (exists(path.join(root, pattern))) matches.add(pattern);
      continue;
    }
    const re = new RegExp(`^${base.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    try {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (entry.isFile() && re.test(entry.name)) matches.add(path.join(dir === '.' ? '' : dir, entry.name));
      }
    } catch {}
  }
  return [...matches];
}

/** `<pm> run <script> -- <args>`, so the harness builds the way the project does. */
/** True when something already answers on the port, so the stage can say so. */
function portInUse(port) {
  return Boolean(capture('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']));
}

/** Reports whether a build cache provider is configured, so a fast result says why. */
function expoConfigBuildCacheProvider(root) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    // SDK 53 reads this from experiments; newer SDKs moved it to the top level.
    const p = cfg?.expo?.experiments?.buildCacheProvider ?? cfg?.expo?.buildCacheProvider;
    if (!p) return null;
    return typeof p === 'string' ? p : (p.plugin ?? 'custom');
  } catch {
    return null;
  }
}

function projectScript(pm, name, extraArgs = []) {
  const needsSeparator = pm.name === 'npm' || pm.name === 'pnpm';
  const args = ['run', name, ...(needsSeparator && extraArgs.length ? ['--'] : []), ...extraArgs];
  return { cmd: pm.name, args };
}

/**
 * The bundle id to launch. On a build-cache hit there is no xcodebuild output to
 * parse an .app path from, so fall back to the app config, which is the source of
 * truth for an Expo project anyway.
 */
function appBundleId(root, appPath) {
  if (appPath) {
    const out = capture('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', path.join(appPath, 'Info.plist')]);
    if (out) return out.trim();
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    const id = cfg?.expo?.ios?.bundleIdentifier;
    if (id) return id;
  } catch {}
  throw new Error('could not determine the iOS bundle identifier');
}

function expoCli(root) {
  const local = path.join(root, 'node_modules', '.bin', 'expo');
  return exists(local) ? { cmd: local, args: [] } : { cmd: 'npx', args: ['expo'] };
}

function isBooted(udid) {
  const raw = capture('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']);
  if (!raw) return false;
  try {
    return Object.values(JSON.parse(raw).devices ?? {})
      .flat()
      .some((device) => device.udid === udid);
  } catch {
    return false;
  }
}

async function bootSimulator(udid, ctx) {
  const boot = await exec({ ...ctx.cmdBase(), cmd: 'xcrun', args: ['simctl', 'boot', udid] });
  // `simctl boot` exits non-zero when the device is already booted; that is the
  // state we want, so only bootstatus decides success.
  const status = await exec({ ...ctx.cmdBase(), cmd: 'xcrun', args: ['simctl', 'bootstatus', udid, '-b'] });
  if (status.code !== 0) {
    throw new Error(`simulator ${udid} failed to boot (boot=${boot.code}, bootstatus=${status.code})`);
  }
}

function fingerprint(pm) {
  const xcodeVersion = capture('xcodebuild', ['-version']);
  const dfLine = capture('df', ['-Pk', REPO_ROOT])?.split('\n')[1] ?? '';
  const dfAvailableKb = Number(dfLine.trim().split(/\s+/)[3]);
  const gitRoot = capture('git', ['rev-parse', '--show-toplevel'], { cwd: REPO_ROOT });
  const gitStatus = gitRoot ? capture('git', ['status', '--porcelain'], { cwd: REPO_ROOT }) : null;

  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: process.arch,
    cpuModel: capture('sysctl', ['-n', 'machdep.cpu.brand_string']) ?? os.cpus()[0]?.model ?? 'unknown',
    physicalCores: Number(capture('sysctl', ['-n', 'hw.physicalcpu'])) || null,
    logicalCores: Number(capture('sysctl', ['-n', 'hw.logicalcpu'])) || os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    macosVersion: capture('sw_vers', ['-productVersion']),
    macosBuild: capture('sw_vers', ['-buildVersion']),
    xcodeVersion: xcodeVersion ? xcodeVersion.split('\n').join(' / ') : null,
    xcodePath: capture('xcode-select', ['-p']),
    cocoapodsVersion: capture('pod', ['--version']),
    nodeVersion: process.version,
    packageManager: pm.name,
    packageManagerVersion: pm.version,
    lockfile: pm.lockfile,
    javaVersion: capture('sh', ['-c', 'java -version 2>&1'])?.split('\n')[0] ?? null,
    freeDiskBytes: Number.isFinite(dfAvailableKb) ? dfAvailableKb * 1024 : null,
    repoVolume: dfLine.trim().split(/\s+/).slice(-1)[0] || null,
    git: {
      isRepo: Boolean(gitRoot),
      root: gitRoot,
      commit: gitRoot ? capture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT }) : null,
      branch: gitRoot ? capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO_ROOT }) : null,
      dirty: gitStatus === null ? null : gitStatus.length > 0,
    },
  };
}

const stages = {
  async install(ctx) {
    const command = installCommand(ctx.pm);
    ctx.purge(() => rmrf(path.join(REPO_ROOT, 'node_modules')));
    await ctx.sh(command);
    return {
      packageManager: ctx.pm.name,
      packageManagerVersion: ctx.pm.version,
      lockfile: ctx.pm.lockfile,
      command: [command.cmd, ...command.args].join(' '),
    };
  },

  async pods(ctx) {
    const project = xcodeProject(REPO_ROOT);
    if (!project) return ctx.skip('no ios/*.xcworkspace in this repo');
    const command = podsCommand(REPO_ROOT);
    ctx.purge(() => {
      rmrf(path.join(REPO_ROOT, 'ios', 'Pods'));
      rmrf(path.join(REPO_ROOT, 'ios', 'build'));
    });
    await ctx.sh(command);
    return { command: command.how, cocoapodsVersion: capture('pod', ['--version']) };
  },

  async 'ios-cold'(ctx) {
    const project = xcodeProject(REPO_ROOT);
    if (!project) return ctx.skip('no ios/*.xcworkspace in this repo');
    const sim = pickSimulator();
    // ios/build is left alone on purpose: it holds React Native's codegen output,
    // and deleting it would require another pod install before this can build.
    // The `pods` stage is what purges it, which is why it runs first.
    ctx.purge(() => {
      for (const dir of derivedDataDirs(project.scheme)) rmrf(dir);
    });
    // Use the project's own run command, not xcodebuild directly: that is what a
    // loop invokes, and it is the only path that runs pod install when needed and
    // consults a configured build cache.
    await bootSimulator(sim.udid, ctx);
    await ctx.sh({
      ...projectScript(ctx.pm, 'ios', ['--device', sim.udid, '--no-bundler']),
      cwd: REPO_ROOT,
      env: { RCT_NO_LAUNCH_PACKAGER: 'true' },
    });
    const app = ctx.builtApp(project, sim);
    return {
      scheme: project.scheme,
      simulator: `${sim.name} (${sim.udid})`,
      command: `${ctx.pm.name} run ios`,
      buildCacheProvider: expoConfigBuildCacheProvider(REPO_ROOT),
    };
  },

  async 'ios-incremental'(ctx) {
    const project = xcodeProject(REPO_ROOT);
    if (!project) return ctx.skip('no ios/*.xcworkspace in this repo');
    if (!derivedDataDirs(project.scheme).length) {
      return ctx.skip('no prior build products; run the ios-cold stage first');
    }
    const rel = findTouchTarget(REPO_ROOT);
    if (!rel) return ctx.skip('could not find a JS/TS source file to touch');

    const file = path.join(REPO_ROOT, rel);
    const original = fs.readFileSync(file, 'utf8');
    const stat = fs.statSync(file);
    const sim = pickSimulator();
    try {
      fs.writeFileSync(file, `${original}\n// bench touch ${Date.now()}\n`);
      await ctx.xcodebuild(project, sim);
    } finally {
      // Restore bytes and mtime so the tree is byte-identical afterwards and the
      // next build does not see a spurious change.
      fs.writeFileSync(file, original);
      fs.utimesSync(file, stat.atime, stat.mtime);
    }
    return { touchedFile: rel, scheme: project.scheme, simulator: `${sim.name} (${sim.udid})` };
  },

  async 'android-cold'(ctx) {
    const androidDir = path.join(REPO_ROOT, 'android');
    const gradlew = path.join(androidDir, 'gradlew');
    if (!exists(gradlew)) return ctx.skip('no android/gradlew in this repo');

    const preexisting = pgrepPids('GradleDaemon');
    ctx.cleanup(async () => {
      const after = pgrepPids('GradleDaemon');
      const started = [...after].filter((pid) => !preexisting.has(pid));
      if (!started.length) return;
      ctx.log.note(`bench: stopping ${started.length} Gradle daemon(s) started by this run`);
      await exec({ ...ctx.cmdBase(), cmd: gradlew, args: ['--stop'], cwd: androidDir });
    });

    // Purge build outputs directly instead of `./gradlew clean`. Under the new
    // architecture, clean still configures CMake, which fails with "Cannot specify
    // link libraries for target react_codegen_* which is not built by this project"
    // whenever generated codegen is stale -- exactly the state a preceding cold
    // `install` leaves behind. Deleting the directories is both more reliable and a
    // truer cold start, since it drops the .cxx configure cache that clean keeps.
    rmrf(path.join(androidDir, 'build'));
    rmrf(path.join(androidDir, 'app', 'build'));
    rmrf(path.join(androidDir, 'app', '.cxx'));

    // Autolinked libraries build inside their own package, not under android/.
    // Leaving these behind makes a "cold" build reuse most of its native work --
    // enough to report a 10x improvement that is pure measurement artifact.
    const nodeModules = path.join(REPO_ROOT, 'node_modules');
    if (exists(nodeModules)) {
      for (const entry of fs.readdirSync(nodeModules)) {
        const scoped = entry.startsWith('@')
          ? fs.readdirSync(path.join(nodeModules, entry)).map((n) => path.join(entry, n))
          : [entry];
        for (const pkg of scoped) {
          rmrf(path.join(nodeModules, pkg, 'android', 'build'));
          rmrf(path.join(nodeModules, pkg, 'android', '.cxx'));
        }
      }
    }

    // Honour a narrowed ABI list if the caller sets one. A dev loop should build
    // one ABI, but pinning that in gradle.properties would narrow release builds
    // too, so it belongs on the invocation -- and a stage that ignored it would
    // report no gain for the correct choice.
    // This is a dev-mode benchmark, so build only the ABI the local emulator runs.
    // Release builds keep every ABI; narrowing lives on the invocation, not in
    // gradle.properties.
    const devArch = process.env.ORG_GRADLE_PROJECT_reactNativeArchitectures ?? 'arm64-v8a';
    await ctx.sh({
      ...projectScript(ctx.pm, 'android', ['--no-bundler']),
      cwd: REPO_ROOT,
      env: { ORG_GRADLE_PROJECT_reactNativeArchitectures: devArch },
    });

    const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    return {
      command: `rm -rf android/{build,app/build,app/.cxx} && ${ctx.pm.name} run android`,
      reactNativeArchitectures: devArch,
      apkPath: exists(apk) ? path.relative(REPO_ROOT, apk) : null,
      apkBytes: exists(apk) ? fs.statSync(apk).size : null,
    };
  },

  async 'metro-cold'(ctx) {
    const cli = expoCli(REPO_ROOT);
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-metro-'));
    const bundle = path.join(outDir, 'main.jsbundle');
    const caches = [
      path.join(os.tmpdir(), 'metro-cache'),
      path.join(REPO_ROOT, 'node_modules', '.cache'),
      path.join(REPO_ROOT, '.expo', 'metro'),
      path.join(REPO_ROOT, '.expo', 'cache'),
    ];
    ctx.purge(() => {
      for (const dir of caches) rmrf(dir);
    });
    ctx.cleanup(() => rmrf(outDir));

    await ctx.sh({
      cmd: cli.cmd,
      args: [
        ...cli.args,
        'export:embed',
        '--platform',
        'ios',
        '--dev',
        'false',
        '--reset-cache',
        '--bundle-output',
        bundle,
        '--assets-dest',
        path.join(outDir, 'assets'),
      ],
      // `expo export:embed` disables --reset-cache when CI is set, which would
      // silently turn this into a warm measurement.
      env: { CI: undefined, EXPO_NO_TELEMETRY: '1' },
    });

    return {
      command: 'expo export:embed --platform ios --dev false --reset-cache',
      clearedCaches: caches.map((c) => c.replace(os.homedir(), '~')),
      bundleBytes: exists(bundle) ? fs.statSync(bundle).size : null,
    };
  },

  async 'worktree-to-running'(ctx) {
    const gitRoot = capture('git', ['rev-parse', '--show-toplevel'], { cwd: REPO_ROOT });
    if (!gitRoot) return ctx.skip('not a git repository, cannot create a worktree');
    const head = capture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
    if (!head) return ctx.skip('git HEAD does not resolve (no commits yet?)');
    const project = xcodeProject(REPO_ROOT);
    if (!project) return ctx.skip('no ios/*.xcworkspace in this repo');

    let sim;
    try {
      sim = pickSimulator();
    } catch (error) {
      return ctx.skip(error.message);
    }

    const bootedBefore = isBooted(sim.udid);
    const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-worktree-'));
    const wt = path.join(holder, 'checkout');
    const wtRepo = path.join(wt, path.relative(gitRoot, REPO_ROOT));
    let worktreeDerivedData = null;

    ctx.cleanup(async () => {
      if (!bootedBefore) {
        await exec({ ...ctx.cmdBase(), cmd: 'xcrun', args: ['simctl', 'shutdown', sim.udid] });
      }
      // The worktree gets its own hashed derived data directory keyed on its path;
      // removing the worktree would otherwise strand gigabytes of it.
      if (worktreeDerivedData) rmrf(worktreeDerivedData);
      await exec({ ...ctx.cmdBase(), cmd: 'git', args: ['worktree', 'remove', '--force', wt], cwd: gitRoot });
      await exec({ ...ctx.cmdBase(), cmd: 'git', args: ['worktree', 'prune'], cwd: gitRoot });
      rmrf(holder);
    });

    const steps = [];
    const step = async (name, fn) => {
      const start = process.hrtime.bigint();
      await fn();
      steps.push({ name, ms: elapsedMs(start) });
    };

    await step('worktree-add', () =>
      ctx.sh({ cmd: 'git', args: ['worktree', 'add', '--detach', wt, head], cwd: gitRoot })
    );

    const carried = worktreeCarryList(REPO_ROOT);
    for (const rel of carried) {
      const to = path.join(wtRepo, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, rel), to);
    }

    const install = installCommand(ctx.pm);
    await step('install', () => ctx.sh({ ...install, cwd: wtRepo }));

    // No explicit pod install: the project's run script does it when it is
    // actually going to build, so forcing it charges every cached run for work a
    // cache hit never needs.
    await step('boot-simulator', () => bootSimulator(sim.udid, ctx));

    const wtProject = xcodeProject(wtRepo);
    const ddBefore = new Set(derivedDataDirs(wtProject.scheme));

    // Metro has to be on 8081: the app resolves its bundler port at launch and
    // defaults there, and `--port` cannot be combined with `--no-bundler`.
    // It also has to be up *before* the run script, because that script launches
    // the app, and an app that starts with no bundler listening never retries.
    const metroPort = 8081;
    if (portInUse(metroPort)) {
      throw new Error(`port ${metroPort} is already in use; stop the process on it and re-run`);
    }
    const metroLog = path.join(os.tmpdir(), `bench-metro-${process.pid}.log`);
    const metroOut = fs.openSync(metroLog, 'a');
    const metro = spawn(ctx.pm.name, ['run', 'start', '--', '--port', String(metroPort)], {
      cwd: wtRepo, detached: true, stdio: ['ignore', metroOut, metroOut],
    });
    metro.unref();
    ctx.cleanup(async () => { try { process.kill(-metro.pid, 'SIGTERM'); } catch {} });

    await step('metro-ready', async () => {
      const deadline = Date.now() + 120_000;
      while (!portInUse(metroPort)) {
        if (Date.now() > deadline) throw new Error(`Metro never opened ${metroPort}; see ${metroLog}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    });

    // The run script builds (or installs a cached build), then launches the app.
    await step('run', () =>
      ctx.sh({
        ...projectScript(ctx.pm, 'ios', ['--device', sim.udid, '--no-bundler']),
        cwd: wtRepo,
      })
    );
    worktreeDerivedData = derivedDataDirs(wtProject.scheme).filter((d) => !ddBefore.has(d))[0] ?? null;

    // Installed is not running: the app still has to fetch ~2,300 modules from
    // Metro, which is a real per-workspace cost. Wait until it has.
    // Ask Metro for the bundle directly rather than waiting on the app to do it.
    // The run script opens the app against a LAN address derived from the current
    // network interface, so relying on that makes the measurement depend on the
    // machine's networking rather than on the project. This measures the same
    // transform cost -- roughly 2,300 modules on a cold cache -- deterministically.
    await step('metro-bundle', async () => {
      // Ask the manifest for the bundle URL rather than assuming a path: with
      // expo-router the entry is virtual, so /index.bundle is a 404.
      const base = `http://localhost:${metroPort}`;
      const deadline = Date.now() + 180_000;
      let url = null;
      while (!url) {
        const manifest = capture('curl', ['-s', '--max-time', '20', '-H', 'expo-platform: ios', '-H', 'accept: application/json', base]);
        try {
          const parsed = JSON.parse(manifest);
          url = parsed?.launchAsset?.url ?? parsed?.bundleUrl ?? null;
        } catch {}
        if (!url && Date.now() > deadline) throw new Error(`Metro never published a manifest; see ${metroLog}`);
        if (!url) await new Promise((r) => setTimeout(r, 1000));
      }
      url = url.replace(/^https?:\/\/[^/]+/, base);
      const code = capture('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '170', url]);
      if (code !== '200') throw new Error(`bundle request returned ${code} for ${url}; see ${metroLog}`);
    });

    return {
      commit: head,
      dirtyTreeAtRun: ctx.fingerprint.git.dirty,
      simulator: `${sim.name} (${sim.udid})`,
      carriedUntrackedFiles: carried,
      steps,
    };
  },
};

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function formatMs(ms) {
  if (ms == null) return '-';
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds - minutes * 60).toFixed(1)}s`;
}

class SkipSignal extends Error {}

async function runStage(name, shared) {
  const log = new StageLog(path.join(shared.logDir, `${name}.log`));
  const deadline = Date.now() + STAGE_TIMEOUT_MS[name];
  const cleanups = [];

  const cmdBase = () => ({ log, timeoutMs: Math.max(1000, deadline - Date.now()) });
  const ctx = {
    log,
    pm: shared.pm,
    fingerprint: shared.fingerprint,
    cmdBase,
    cleanup(fn) {
      cleanups.push(fn);
    },
    skip(reason) {
      throw new SkipSignal(reason);
    },
    async sh(spec) {
      const result = await exec({ ...cmdBase(), ...spec });
      const label = [spec.cmd, ...(spec.args ?? [])].join(' ');
      if (result.spawnError) throw new Error(`\`${label}\` could not start: ${result.spawnError}`);
      if (result.timedOut) throw new Error(`\`${label}\` exceeded the ${formatMs(STAGE_TIMEOUT_MS[name])} stage timeout`);
      if (result.code !== 0) {
        throw new Error(`\`${label}\` exited with code ${result.code}${result.signal ? ` (${result.signal})` : ''}`);
      }
      return result;
    },
    async xcodebuild(project, sim) {
      const metroBefore = pgrepPids(METRO_PATTERN);
      try {
        return await ctx.sh({
          cmd: 'xcodebuild',
          args: [
            '-workspace',
            project.workspace,
            '-scheme',
            project.scheme,
            '-configuration',
            'Debug',
            // A concrete simulator udid keeps this an arm64-only build; the generic
            // `platform=iOS Simulator` destination also builds an x86_64 slice,
            // which does not compile for this project.
            '-destination',
            `platform=iOS Simulator,id=${sim.udid}`,
            'build',
          ],
          cwd: project.root,
          // Stop the "Start Packager" build phase from leaving a Metro instance
          // behind after the harness exits.
          env: { RCT_NO_LAUNCH_PACKAGER: 'true' },
        });
      } finally {
        reapNew(METRO_PATTERN, metroBefore, log, 'Metro');
      }
    },
    builtApp(project, sim) {
      return appPathFromLog(log.file) ?? appPathFromBuildSettings(project, sim);
    },
  };

  const record = { name, status: 'pass', ms: null, prepMs: null, cleanupMs: null, log: path.relative(REPO_ROOT, log.file) };
  // Destructive setup (rm -rf of node_modules, Pods, caches) is timed separately
  // from the work being benchmarked, so `ms` stays comparable between runs whose
  // trees differ in size.
  ctx.purge = (fn) => {
    const start = process.hrtime.bigint();
    fn();
    record.prepMs = (record.prepMs ?? 0) + elapsedMs(start);
  };

  try {
    const started = process.hrtime.bigint();
    let meta;
    try {
      meta = await stages[name](ctx);
    } finally {
      record.ms = elapsedMs(started) - (record.prepMs ?? 0);
    }
    Object.assign(record, meta);
  } catch (error) {
    if (error instanceof SkipSignal) {
      record.status = 'skip';
      record.reason = error.message;
      record.ms = null;
    } else {
      record.status = 'fail';
      record.error = error.message;
      record.stderrTail = log.tail();
      log.note(`\nbench: stage failed: ${error.message}`);
    }
  } finally {
    const cleanupStart = process.hrtime.bigint();
    for (const fn of cleanups.reverse()) {
      try {
        await fn();
      } catch (error) {
        log.note(`bench: cleanup step failed: ${error.message}`);
      }
    }
    record.cleanupMs = elapsedMs(cleanupStart);
    log.close();
  }
  return record;
}

function summaryTable(run) {
  const rows = run.stages.map((s) => [
    s.name,
    s.status,
    formatMs(s.ms),
    s.status === 'fail' ? s.error : s.status === 'skip' ? s.reason : detailOf(s),
  ]);
  const headers = ['stage', 'status', 'wall', 'detail'];
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (cells) =>
    cells.map((c, i) => String(c ?? '').padEnd(i === cells.length - 1 ? 0 : widths[i])).join('  ').trimEnd();

  const out = [];
  out.push('');
  out.push(`bench: ${run.label}  ${run.startedAt}`);
  out.push(
    `machine: ${run.machine.cpuModel} | ${run.machine.physicalCores}p/${run.machine.logicalCores}l cores | ` +
      `${(run.machine.totalMemoryBytes / 1024 ** 3).toFixed(0)} GB RAM | macOS ${run.machine.macosVersion} | ` +
      `${run.machine.xcodeVersion ?? 'no Xcode'} | node ${run.machine.nodeVersion}`
  );
  out.push(
    `repo: ${run.machine.git.commit ? run.machine.git.commit.slice(0, 12) : 'not a git repo'}` +
      `${run.machine.git.dirty ? ' (dirty)' : run.machine.git.dirty === false ? ' (clean)' : ''}` +
      ` | pm ${run.machine.packageManager}@${run.machine.packageManagerVersion ?? '?'}`
  );
  out.push('');
  out.push(line(headers));
  out.push(line(headers.map((_, i) => '-'.repeat(widths[i]))));
  for (const row of rows) out.push(line(row));
  out.push('');
  out.push(
    `total ${formatMs(run.totalMs)}  |  ${run.counts.pass} passed, ${run.counts.fail} failed, ${run.counts.skip} skipped`
  );
  out.push(`result: ${path.relative(REPO_ROOT, run.resultFile)}`);
  out.push('');
  return out.join('\n');
}

function detailOf(stage) {
  if (stage.name === 'install') return stage.command ?? '';
  if (stage.name === 'pods') return stage.command ?? '';
  if (stage.name === 'ios-incremental') return stage.touchedFile ? `touched ${stage.touchedFile}` : '';
  if (stage.name === 'metro-cold' && stage.bundleBytes) return `${(stage.bundleBytes / 1024 ** 2).toFixed(1)} MB bundle`;
  if (stage.name === 'android-cold' && stage.apkBytes) return `${(stage.apkBytes / 1024 ** 2).toFixed(1)} MB apk`;
  if (stage.simulator) return stage.simulator;
  return '';
}

function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        only: { type: 'string' },
        skip: { type: 'string' },
        json: { type: 'boolean', default: false },
        label: { type: 'string', default: 'baseline' },
        help: { type: 'boolean', default: false },
      },
      allowPositionals: false,
    });
  } catch (error) {
    process.stderr.write(`bench: ${error.message}\n${HELP}`);
    process.exit(2);
  }
  const { values } = parsed;

  if (values.help) {
    process.stdout.write(HELP);
    return Promise.resolve(0);
  }

  const realCwd = fs.realpathSync(process.cwd());
  if (realCwd !== fs.realpathSync(REPO_ROOT)) {
    process.stderr.write(
      `bench: must be run from the repo root (${REPO_ROOT}), got ${process.cwd()}.\n` +
        'bench: use `npm run bench` from the project root.\n'
    );
    process.exit(2);
  }
  for (const marker of ['package.json', 'ios', 'android']) {
    if (!exists(path.join(REPO_ROOT, marker))) {
      process.stderr.write(`bench: ${REPO_ROOT} does not look like the project root (missing ${marker}).\n`);
      process.exit(2);
    }
  }

  const parseList = (value) =>
    value
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const only = parseList(values.only);
  const skip = parseList(values.skip);
  const unknown = [...only, ...skip].filter((s) => !STAGE_ORDER.includes(s));
  if (unknown.length) {
    process.stderr.write(`bench: unknown stage(s): ${unknown.join(', ')}\nbench: known stages: ${STAGE_ORDER.join(', ')}\n`);
    process.exit(2);
  }

  const selected = STAGE_ORDER.filter((s) => (only.length ? only.includes(s) : true)).filter(
    (s) => !skip.includes(s)
  );
  if (!selected.length) {
    process.stderr.write('bench: no stages selected.\n');
    process.exit(2);
  }

  return runAll({ label: values.label, json: values.json, selected });
}

async function runAll({ label, json, selected }) {
  const safeLabel = label.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run';
  const startedAt = new Date();
  const runId = `${startedAt.toISOString().replace(/[:.]/g, '-')}-${safeLabel}`;
  const logDir = path.join(RESULTS_DIR, 'logs', runId);
  fs.mkdirSync(logDir, { recursive: true });

  const pm = detectPackageManager();
  const shared = { pm, fingerprint: fingerprint(pm), logDir };

  const notify = (text) => process.stderr.write(text);
  notify(`bench: ${selected.length} stage(s): ${selected.join(', ')}\nbench: logs -> ${path.relative(REPO_ROOT, logDir)}\n`);

  const runStart = process.hrtime.bigint();
  const results = [];
  for (const name of selected) {
    notify(`bench: [${results.length + 1}/${selected.length}] ${name} ... `);
    const record = await runStage(name, shared);
    results.push(record);
    notify(`${record.status} ${formatMs(record.ms)}\n`);
  }
  const totalMs = elapsedMs(runStart);

  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const r of results) counts[r.status] += 1;

  const resultFile = path.join(RESULTS_DIR, `${runId}.json`);
  const run = {
    schema: 1,
    label: safeLabel,
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    totalMs,
    counts,
    requestedStages: selected,
    machine: shared.fingerprint,
    stages: results,
    resultFile,
    logDir,
  };
  fs.writeFileSync(resultFile, `${JSON.stringify(run, null, 2)}\n`);

  const table = summaryTable(run);
  if (json) {
    process.stderr.write(table);
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
  } else {
    process.stdout.write(table);
  }

  return counts.fail > 0 ? 1 : 0;
}

const exitCode = await main();
killAllLive('SIGTERM');
process.exitCode = exitCode;
