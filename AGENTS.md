# Trailhead

A hike recording and trail browsing app. Expo SDK 58 canary, React Native 0.87,
TypeScript, expo-router.

## Layout

```
app/                    expo-router routes
  _layout.tsx           providers: gesture handler, safe area, react-query, db init
  (tabs)/               Trails, Record, History, Settings
  trail/[id].tsx        trail detail
  hike/[id].tsx         recorded hike detail
src/
  theme/                useTheme(), palettes, spacing, radius
  data/trails.ts        200 seed trails with route geometry (trails.json)
  db/                   expo-sqlite + drizzle: schema, client, seed
  lib/                  geo math (haversine, gain, splits) and unit formatting
  store/                zustand stores (settings, in-progress recording)
  components/           shared presentational components
  features/             screen-specific hooks and pieces
bench/                  benchmark harness (npm run bench)
ios/  android/          committed native projects
```

## Conventions

- `@/` resolves to the repository root.
- Colors come from `useTheme()`. Every screen supports light and dark mode.
- Units come from `useSettingsStore().units` and are rendered through `src/lib/format`.
- Trail data is static and bundled. Hike data is in SQLite and seeded on first launch.

## Native setup

This project is in the bare workflow: `ios/` and `android/` are committed and
`expo prebuild` is **not** part of the build. Native configuration is changed by
editing the native projects directly, or by changing `app.json` and re-running
prebuild deliberately — which will overwrite local native edits, so check what is
already in the native projects first.

Android map tiles need a Google Maps API key in `.env` as
`GOOGLE_MAPS_API_KEY`. Copy `.env.example` to `.env` to supply one.
`android/app/build.gradle` reads the environment variable first, then the
repo-root `.env`. The app builds without a key and shows blank map tiles.

## Running

```bash
npm ci
bundle install
npx expo run:ios       # or: npx expo run:android
```

The repository pins Ruby 3.3.4 and CocoaPods 1.16.2. Run CocoaPods commands
through Bundler, for example `cd ios && bundle exec pod install`.

This public test app does not contain EAS configuration. Use only local builds
and simulator sessions.

Note that `-derivedDataPath ios/build` collides with React Native's codegen output
in `ios/build/generated`. Use a derived data path outside `ios/build`, and re-run
`pod install` after deleting `ios/build`.

## Mobile agent loop

Before running or validating the app, read `docs/mobile-agent-loop.md`. UI changes
and visible bug fixes require before-and-after evidence collected with
`agent-device` and included in the pull request. For non-visual bugs, include the
narrow failing command output and its passing result instead.
