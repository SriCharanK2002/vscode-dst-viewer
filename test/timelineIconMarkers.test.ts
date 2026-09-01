import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(__dirname, "../..");

test("timeline markers use distinct jump, trim, and color-change iconography", () => {
  const playerJs = readFileSync(join(root, "media/player.js"), "utf8");
  const playerCss = readFileSync(join(root, "media/player.css"), "utf8");
  const webviewHtml = readFileSync(join(root, "src/webviewHtml.ts"), "utf8");

  assert.match(playerJs, /createMarkerIcon/);
  assert.match(playerJs, /aria-label/);
  assert.match(playerJs, /Trim at event/);
  assert.match(playerJs, /Jump at event/);
  assert.match(playerJs, /Color change at event/);
  assert.match(playerCss, /\.timeline-marker-icon\.trim/);
  assert.match(playerCss, /\.timeline-marker-icon\.jump/);
  assert.match(playerCss, /\.timeline-marker-icon\.color_change/);
  assert.match(webviewHtml, /timelineLegend/);
  assert.match(webviewHtml, /legend-icon trim/);
  assert.match(webviewHtml, /legend-icon jump/);
});
