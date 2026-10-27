// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      files.push(...(await listHtmlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

function localStylesheetHrefs(html) {
  const hrefs = [];
  const re = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
  for (const tag of html.matchAll(re)) {
    const hrefMatch = tag[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].trim();
    if (/^(?:https?:|\/\/|data:)/i.test(href)) continue;
    if (href.startsWith("/")) continue;
    hrefs.push(href);
  }
  return hrefs;
}

test("every HTML page links only to local stylesheets that exist beside it", async () => {
  const htmlFiles = await listHtmlFiles(repoRoot);
  const missing = [];

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, "utf8");
    const pageDir = path.dirname(htmlPath);
    for (const href of localStylesheetHrefs(html)) {
      const resolved = path.resolve(pageDir, href);
      try {
        await readFile(resolved);
      } catch {
        missing.push(`${path.relative(repoRoot, htmlPath)} → ${href}`);
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    missing.length
      ? `Missing local stylesheet(s):\n${missing.map((m) => `  - ${m}`).join("\n")}`
      : undefined,
  );
});
