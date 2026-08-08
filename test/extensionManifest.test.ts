import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("package contributes a default custom readonly DST editor", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));
  const editor = pkg.contributes.customEditors.find(
    (item: { viewType: string }) => item.viewType === "mydigitizerDstPlayer.viewer"
  );

  assert.equal(editor.displayName, "DST Player");
  assert.equal(editor.priority, "default");
  assert.deepEqual(editor.selector, [{ filenamePattern: "*.dst" }, { filenamePattern: "*.DST" }]);
  assert.ok(pkg.activationEvents.includes("onCustomEditor:mydigitizerDstPlayer.viewer"));
});

test("package supports untrusted workspaces for read-only DST viewing", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));

  assert.equal(pkg.capabilities.untrustedWorkspaces.supported, true);
});
