import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("extension has marketplace metadata and docs", () => {
  const root = join(__dirname, "../..");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  assert.equal(pkg.displayName, "DST Player");
  assert.ok(pkg.description.includes("DST"));
  assert.ok(Array.isArray(pkg.categories));
  assert.ok(pkg.engines.vscode);
  assert.ok(existsSync(join(root, "README.md")));
  assert.ok(existsSync(join(root, "CHANGELOG.md")));
});
