// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** HTML pages in subdirectories (not site root). */
async function sectionHtmlFiles() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const indexPath = path.join(ROOT, ent.name, "index.html");
    try {
      const st = await stat(indexPath);
      if (st.isFile()) files.push(indexPath);
    } catch {
      // no index.html in this directory
    }
  }
  return files.sort();
}

/** Folder-relative assets/ in HTML or linked CSS (not /assets/). */
const FOLDER_RELATIVE_ASSET =
  /(?<![/"'])\bassets\/[A-Za-z0-9_.-]+/g;

function linkedStylesheets(html, pageDir) {
  const hrefs = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const hrefM = /\bhref=["']([^"']+)["']/i.exec(tag);
    if (hrefM) hrefs.push(path.resolve(pageDir, hrefM[1]));
  }
  return hrefs;
}

async function collectViolations(filePath) {
  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  return [...content.matchAll(FOLDER_RELATIVE_ASSET)].map((m) => m[0]);
}

test("section pages use root-relative /assets/ paths", async () => {
  const pages = await sectionHtmlFiles();
  assert.ok(pages.length >= 6, `expected section index.html pages, found ${pages.length}`);

  const violations = [];
  for (const htmlPath of pages) {
    const pageDir = path.dirname(htmlPath);
    const rel = path.relative(ROOT, htmlPath);
    const sources = [
      { label: rel, path: htmlPath },
      ...(await readFile(htmlPath, "utf8").then((html) =>
        linkedStylesheets(html, pageDir).map((p) => ({
          label: path.relative(ROOT, p),
          path: p,
        })),
      )),
    ];

    for (const { label, path: srcPath } of sources) {
      const hits = await collectViolations(srcPath);
      for (const hit of hits) {
        violations.push(`${label}: ${hit}`);
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `folder-relative assets/ found:\n${violations.join("\n")}`,
  );
});
