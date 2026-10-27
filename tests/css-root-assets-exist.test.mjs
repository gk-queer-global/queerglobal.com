// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const ROOT_ASSET_URL = /url\(\s*["']\/assets\/([^"')]+)["']\s*\)/gi;

async function listCssFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (ent.name.startsWith(".") || ent.name === "node_modules") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      files.push(...(await listCssFiles(full)));
    } else if (ent.isFile() && ent.name.endsWith(".css")) {
      files.push(full);
    }
  }
  return files;
}

function referencedRootAssets(cssText) {
  const names = new Set();
  for (const match of cssText.matchAll(ROOT_ASSET_URL)) {
    names.add(match[1]);
  }
  return names;
}

test("CSS url(/assets/...) references files present in assets/", async () => {
  const cssFiles = await listCssFiles(ROOT);
  const missing = [];

  for (const cssPath of cssFiles) {
    const relCss = path.relative(ROOT, cssPath);
    const css = await readFile(cssPath, "utf8");
    for (const assetName of referencedRootAssets(css)) {
      const assetPath = path.join(ROOT, "assets", assetName);
      try {
        const st = await stat(assetPath);
        if (!st.isFile()) {
          missing.push(`${relCss}: /assets/${assetName} is not a file`);
        }
      } catch (err) {
        if (err && err.code === "ENOENT") {
          missing.push(`${relCss}: /assets/${assetName}`);
        } else {
          throw err;
        }
      }
    }
  }

  assert.equal(
    missing.length,
    0,
    `missing asset(s) for CSS url(/assets/...):\n${missing.join("\n")}`,
  );
});
