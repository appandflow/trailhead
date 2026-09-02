# Mobile agent loop

Use Stim for the worktree, Metro, device, build, install, and launch. Read the
installed Stim skill for its commands and approval rules. This file only defines
Trailhead's validation and pull-request requirements.

## Start from a clean base

`main` is the default branch. Keep its checkout clean and current before it seeds
a worktree. Run `git status --short` first; if it prints anything, stop and ask
before continuing:

```bash
git status --short
git fetch --prune
stim doctor
stim worktree create <name> --base origin/main --carry-ignored --dir .worktrees
cd <printed-path>
git checkout -b @janic/<branch>
stim start
stim ios # or: stim android
```

Use the full device ID from Stim's summary for every device command.
`--carry-ignored` copies safe ignored paths such as dependencies, Pods, native
output, and `.env`, plus uncommitted tracked changes that fit the selected base.
Android builds without `GOOGLE_MAPS_API_KEY`, but map tiles are blank.

Trailhead commits `ios/` and `android/`. Make native changes in those projects;
do not run Expo prebuild. Run `stim ios` or `stim android` again after a native
input changes. JavaScript and TypeScript changes use Fast Refresh.

## Validate before and after

Capture the failing or existing state before editing. Open the app on the exact
device Stim owns, navigate with `snapshot -i` and its returned refs, verify named
expectations with `find`, `get`, `is`, or `wait`, then save the evidence:

```bash
agent-device open com.appandflow.trailhead --platform ios --udid <stim-udid> --session <name> --foreground
agent-device snapshot -i --session <name>
agent-device screenshot /tmp/<name>-before.png --session <name>
```

For Android, use `--platform android --serial <stim-serial>`. After the change,
return to the same screen and state, verify the expected text or selector, and
capture the matching result:

```bash
agent-device snapshot -i --session <name>
agent-device screenshot /tmp/<name>-after.png --session <name>
stim logs --errors
npm run lint
npm run typecheck
agent-device close --session <name>
```

A screenshot alone does not prove a named value or behavior. Pair it with a
targeted agent-device assertion. Use a short recording when interaction or motion
is the change.

## Pull requests

Every UI change or bug fix must include clearly labeled **Before** and **After**
evidence in the pull-request description. Keep the device, route, theme,
orientation, and test data the same so the comparison is meaningful.

For visible behavior, attach screenshots or a recording with the GitHub upload
skill. For a non-visual bug, include the narrow failing output before the change
and the passing output after it, and state why visual evidence does not apply.
Stim launch readiness and clean logs are required runtime checks, but they do not
replace before-and-after evidence.

Ask before removing a worktree. `stim worktree remove` also reclaims its Stim
environment and owned device.
