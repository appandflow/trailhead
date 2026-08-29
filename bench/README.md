# Trailhead loop benchmark

`bench/bench.mjs` times the seven things an AI coding agent has to wait for when it
builds, implements, validates and ships a change in this repo. It has no
dependencies beyond Node 20+ built-ins.

Compare runs against **your own earlier baseline**, not against someone else's
numbers. Machines vary enough that absolute seconds mostly measure hardware. Run
the harness once before you change anything, keep that JSON, and compare every
later run against it.

## Running it

```bash
# from the repo root, before you optimise anything
npm run bench -- --label day0

# later, after optimising
npm run bench -- --label after-ccache

# just the loop-shaped stages
npm run bench -- --only ios-incremental,metro-cold

# everything except the two slowest
npm run bench -- --skip android-cold,worktree-to-running
```

| flag | meaning |
| --- | --- |
| `--only <a,b>` | run only these stages |
| `--skip <a,b>` | drop these stages (applied after `--only`) |
| `--label <name>` | goes in the result filename; default `baseline` |
| `--json` | print the result JSON on stdout, summary table on stderr |
| `--help` | usage |

`BENCH_SIM_UDID=<udid>` pins a specific simulator instead of letting the harness
pick one.

A full run is slow — expect the better part of an hour, most of it in
`ios-cold`, `android-cold` and `worktree-to-running`. Close Xcode, quit other
builds, and plug the laptop in first; thermal throttling and a competing build
both show up as noise in the numbers.

The harness must be run from the repo root. `npm run bench` always does that.

## Output

- `bench/results/<timestamp>-<label>.json` — the full record.
- `bench/results/logs/<timestamp>-<label>/<stage>.log` — the complete stdout and
  stderr of every subprocess that stage ran.
- A summary table on stdout.

`bench/results/logs/` is gitignored; the result JSON is not. **Commit your
baseline** so later runs have something to compare against:

```bash
npm run bench -- --label baseline
git add bench/results && git commit -m "chore: day-0 baseline"
```

## The stages

Run in this order, because each one leaves the tree in the state the next one
needs to start cold.

### `install`
`rm -rf node_modules`, then a cold install. The package manager is detected from
`package.json`'s `packageManager` field, then from the lockfile
(`package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm,
`bun.lockb`/`bun.lock` → bun). With a lockfile present it uses the frozen-lockfile
form (`npm ci`, `yarn install --immutable`/`--frozen-lockfile`,
`pnpm install --frozen-lockfile`, `bun install --frozen-lockfile`). The resolved
manager, its version and the exact command are recorded in the result.

This is what an agent pays every time it starts from a clean checkout.

### `pods`
`rm -rf ios/Pods ios/build`, then a CocoaPods install: `bundle exec pod install`
if there is a Gemfile that mentions cocoapods, otherwise `pod install`, otherwise
`npx pod-install`.

### `ios-cold`
A debug simulator build from a purged state: every
`~/Library/Developer/Xcode/DerivedData/Trailhead-*` directory is deleted first,
on top of the `ios/Pods` and `ios/build` purge the `pods` stage already did.

The harness does **not** pass `-derivedDataPath`. `ios/build` holds React
Native's codegen output, so pointing derived data there breaks the build (see
`AGENTS.md`), and deleting `ios/build` obliges another `pod install` — which is
exactly why `pods` runs before this stage and this stage leaves `ios/build`
alone. Using Xcode's default hashed location also means these timings share a
cache with whatever `expo run:ios` the rest of your loop does, rather than
measuring a cache nobody else benefits from.

The built `.app` is located by parsing the script-phase environment xcodebuild
echoes into the log, falling back to `xcodebuild -showBuildSettings -json`.

The destination is a concrete simulator UDID
(`platform=iOS Simulator,id=<udid>`), never `generic/platform=iOS Simulator`. The
generic destination also builds an x86_64 slice, which does not compile for this
project. The harness prefers an already-booted iPhone, otherwise the first iPhone
on the newest installed iOS runtime.

`RCT_NO_LAUNCH_PACKAGER=true` is set so the "Start Packager" build phase does not
leave a Metro process behind.

### `ios-incremental`
Appends a comment to one JS/TS source file (`app/_layout.tsx` if it exists), runs
the same build again, then restores the file's exact bytes and mtime.

This is the number that separates a smart loop from a dumb one: it is what the
agent waits for on every edit-check cycle, and it is dominated by fixed
per-build overhead — script phases, dependency scanning, linking, code signing —
rather than by compilation. Note that a debug build does not embed the JS bundle
(Metro serves it at runtime), so this stage measures the native rebuild floor,
not JS transform time. `metro-cold` covers the JS side.

Skipped if there is no derived data for the scheme yet, since that would
silently measure a cold build instead.

### `android-cold`
Deletes `android/build`, `android/app/build`, `android/app/.cxx`, **and every
`node_modules/*/android/build` and `.cxx`**, then `./gradlew assembleDebug`, all
inside the timed region.

That last part matters. Autolinked libraries build inside their own package
rather than under `android/`, so purging only `android/` leaves most of the
native work intact and a "cold" build can come back many times faster than it
should. Gradle's own cache in `~/.gradle` is *not* purged, so this is cold for
the project, not for the machine.

It does not use `./gradlew clean`. Under the new architecture, `clean` still
configures CMake, which fails with `Cannot specify link libraries for target
react_codegen_* which is not built by this project` whenever generated codegen is
stale -- exactly the state the preceding cold `install` leaves behind. Removing
the directories is more reliable and a truer cold start, because it also drops
the `.cxx` configure cache that `clean` keeps. `reactNativeArchitectures` is left at whatever `android/gradle.properties`
says — narrowing it is a legitimate optimisation, so the harness does not do it
for you.

If no Gradle daemon was running before the stage and one is running after, the
harness started it and runs `./gradlew --stop` to shut it down.

### `metro-cold`
Deletes `$TMPDIR/metro-cache`, `node_modules/.cache`, `.expo/metro` and
`.expo/cache`, then times

```
expo export:embed --platform ios --dev false --reset-cache --bundle-output … --assets-dest …
```

into a temp directory that is removed afterwards. `CI` is explicitly unset for
this stage because `expo export:embed` ignores `--reset-cache` when `CI` is set,
which would quietly turn a cold measurement into a warm one. The resulting
bundle size is recorded.

### `worktree-to-running`
The metric that matters most for parallel work: how long from "fresh checkout of this
commit" to "app installed on a simulator".

1. `git worktree add --detach <tmp> HEAD`
2. copy over the gitignored files the build needs but git does not carry, such as
   `ios/.xcode.env.local`; without them a fresh worktree can fail in ways your
   main checkout never does. If a `.worktreeinclude` exists, its patterns are
   added to that list.
3. cold dependency install in the worktree
4. `pod install` in the worktree
5. boot the simulator
6. `xcodebuild` debug build against that simulator
7. `xcrun simctl install`

Then the worktree is removed and pruned, its hashed derived data directory is
deleted (it is keyed on the worktree path, so nothing else would ever reclaim
it), and the simulator is shut down again if the harness was the one that booted
it. Per-step timings land in the result JSON under `steps`, so you can see which
part of the cold path you actually fixed.

This installs a build with the same bundle id as your normal dev build, so it will
replace the app already on the simulator.

If this stage cannot run — not a git repo, no commits, no simulator — it is
recorded as `skipped` with a reason rather than failing the run.

## Reading the result JSON

```jsonc
{
  "label": "day0",
  "startedAt": "…",
  "totalMs": 2145300.4,          // wall time for the whole harness
  "counts": { "pass": 6, "fail": 0, "skip": 1 },
  "machine": { /* fingerprint, see below */ },
  "stages": [
    {
      "name": "ios-cold",
      "status": "pass",          // pass | fail | skip
      "ms": 603912.1,            // the measured work
      "prepMs": 1840.2,          // rm -rf of caches/artifacts, excluded from ms
      "cleanupMs": 12.0,         // teardown, excluded from ms
      "log": "bench/results/logs/…/ios-cold.log",
      "simulator": "iPhone 17 Pro (…)"
    }
  ]
}
```

`ms` deliberately excludes `prepMs`. The purge is the harness setting up the
measurement, not the thing being measured, and its cost scales with how much
junk is on disk — including it would reward shipping fewer files rather than
building faster. A failed stage still reports `ms`, plus `error` and
`stderrTail` (the last 40 lines).

The fingerprint records hostname, CPU model, physical and logical core counts,
total RAM, macOS version and build, Xcode version and path, CocoaPods version,
Node version, package manager and version, Java version, free disk space on the
volume holding the repo, and the git commit plus whether the tree was dirty.
Compare runs only within one machine — that is the whole point of scoring on
relative speedup.

## Behaviour under failure

Every stage is independently guarded. A stage that fails or times out records the
failure, the tail of its output and its elapsed time, and the harness moves on to
the next stage. One broken stage never aborts the run. Each stage has its own
timeout (20–90 minutes depending on the stage); hitting it is recorded as a
failure, not a hang.

## Process hygiene

Leaked processes and stale artifacts skew later runs, so the harness cleans up
after itself:

- every subprocess is spawned detached in its own process group, so a timeout or
  a `Ctrl-C` kills the whole tree rather than orphaning `xcodebuild`, `gradlew`
  or `npx` children;
- `SIGINT`/`SIGTERM` terminate every live child (`SIGTERM`, then `SIGKILL` after
  two seconds) before the harness exits;
- Gradle daemons started by the harness are stopped with `./gradlew --stop`;
  daemons that were already running are left alone;
- iOS builds run with `RCT_NO_LAUNCH_PACKAGER=true` so the "Start Packager" build
  phase never spawns one, and any Metro process that appears during a build
  anyway is terminated afterwards — same before/after diff as the Gradle daemons;
- temporary bundle output directories, the benchmark worktree and its derived
  data are always removed, including when the stage failed;
- a simulator the harness booted is shut down again; one that was already booted
  is left alone.

If you find the harness leaking a process, that is a bug in the harness — report it.
