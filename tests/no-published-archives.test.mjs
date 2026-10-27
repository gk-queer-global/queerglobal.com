// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Same path names omitted from the static Pages upload as CI rsync. */
const PUBLISH_EXCLUDED_NAMES = new Set(["scripts", "tests", "node_modules"]);

const ARCHIVE_SUFFIXES = [".zip", ".tar", ".gz", ".tgz", ".7z", ".rar"];

function isArchiveFileName(name) {
  const lower = name.toLowerCase();
  return ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

async function listPublishedFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (PUBLISH_EXCLUDED_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPublishedFiles(full)));
    } else if (entry.isFile()) {
      if (entry.name === "package.json") continue;
      files.push(full);
    }
  }
  return files;
}

test("published static tree contains no archive files", async () => {
  const published = await listPublishedFiles(repoRoot);
  const archives = published.filter((filePath) => isArchiveFileName(path.basename(filePath)));

  assert.deepEqual(
    archives.map((f) => path.relative(repoRoot, f)),
    [],
    archives.length
      ? `Archive file(s) would be published to the public site:\n${archives
          .map((f) => `  - ${path.relative(repoRoot, f)}`)
          .join("\n")}`
      : undefined,
  );
});
