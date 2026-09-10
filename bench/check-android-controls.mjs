// Light-theme Pixel screenshots captured with agent-device, not resized previews.
// Usage: node bench/check-android-controls.mjs header|filter /absolute/screenshot.png
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pngjs from 'pngjs';

const [check, screenshot] = process.argv.slice(2);
assert.ok(['header', 'filter'].includes(check) && screenshot, 'Pass header|filter and a screenshot path');
const { width, height, data } = pngjs.PNG.sync.read(readFileSync(screenshot));

if (check === 'header') {
  // Only the wordmark is green in the top 13% of the light-theme Trails screen.
  const columns = [];
  for (let y = 0; y < height * 0.13; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (Math.abs(data[offset] - 47) < 12 &&
          Math.abs(data[offset + 1] - 107) < 12 &&
          Math.abs(data[offset + 2] - 79) < 12) columns.push(x);
    }
  }
  assert.ok(columns.length > 100, 'Trailhead wordmark must be visible');
  const center = (Math.min(...columns) + Math.max(...columns)) / 2;
  assert.ok(Math.abs(center - width / 2) <= width * 0.01,
    `Logo center ${center}px must match screen center ${width / 2}px`);
} else {
  // Below the buttons, but above the Android gesture bar, the sheet must cover
  // the tab bar at both edges and the center. A floating sheet exposes the scrim.
  for (const fraction of [0.02, 0.5, 0.98]) {
    const offset = (Math.floor(height * 0.98) * width + Math.floor(width * fraction)) * 4;
    assert.ok([0, 1, 2].every((channel) => data[offset + channel] >= 245),
      `Sheet must reach the bottom at x=${fraction * 100}% (RGB ${[...data.subarray(offset, offset + 3)]})`);
  }
}
console.log(`PASS: Android ${check} layout (${width}x${height})`);
