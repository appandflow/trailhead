# Trailhead

A reusable Expo app for testing local `stim` iOS and Android workflows.

Browse a catalogue of 200 trails with route maps and elevation profiles, record a
hike with live GPS tracking, and review your history with per-month stats and
charts.

<a href="./docs/media/trailhead-demo.mp4"><img src="./docs/media/trailhead-demo.gif" alt="Trailhead demo" width="320"></a>

![Trailhead screens](./docs/media/trailhead-screens.png)

## Screens

| | |
|---|---|
| **Trails** | Searchable, filterable catalogue of 200 trails. Filter by region and difficulty, sort by name, distance or rating. |
| **Trail detail** | Route map with start/end markers and a coverage overlay, stats, description, tags, and an elevation-gain summary with average grade and high/low points. |
| **Record** | Live recording: full-screen map following your position, a draggable stats sheet with duration, distance, ascent and pace, and start/pause/stop. Backed by a background location task; saves the track to SQLite on stop. |
| **History** | Recorded hikes grouped into month sections with per-month distance, lifetime totals, and a bar chart of the last six months. |
| **Hike detail** | The recorded route on a map, an elevation profile, a stat grid, and a per-kilometre splits table. |
| **Settings** | Metric/imperial units applied app-wide, hike reminders, offline map tiles, storage and reset, app version. |

## Stack

Expo SDK 58, React Native 0.88, TypeScript, expo-router. Maps via
`react-native-maps`, charts via `@shopify/react-native-skia`, lists via
`@shopify/flash-list`, storage via `expo-sqlite` with Drizzle, preferences via
`react-native-mmkv`, animation via Reanimated and Gesture Handler.

The native projects are committed; `expo prebuild` is not part of the build.

## Getting started

```bash
npm ci
bundle install
stim doctor
stim start
stim ios       # or: stim android
stim logs --errors
stim stop
```

Install Stim with `npm install --global stim`, or replace `stim` with `npx stim`.

Android builds do not require secrets. To show Android map tiles, copy
`.env.example` to `.env` and add a Google Maps API key.

For direct Expo checks, use `npx expo run:ios` or `npx expo run:android`.
EAS development profiles live in `eas.json`; using them needs membership of
the `appandflow` Expo account.

The repository pins Ruby 3.3.4 and CocoaPods 1.16.2. Run direct CocoaPods
commands through Bundler, for example `cd ios && bundle exec pod install`.

The released SDK 58 dependencies are pinned in `package-lock.json`. Run
`npx expo install --check` to verify SDK compatibility, or
`npx expo install --fix` to realign the dependencies. Worklets' Metro
configuration peer is installed explicitly at the React Native version.
TypeScript uses RN's temporary `react-native-legacy-deep-imports` condition
until the dependencies support the new strict types.

See [AGENTS.md](./AGENTS.md) for how the project is laid out and the native setup
gotchas, and [bench/README.md](./bench/README.md) for the build benchmark harness.
