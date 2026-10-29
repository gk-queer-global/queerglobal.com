#!/usr/bin/env node
/**
 * Smoke-test the staging custom host from CI: unauthenticated probes must look gated.
 * Strict 401 + authorized 200 checks stay on the pages.dev URL (smoke-basic-auth.sh).
 *
 * Usage: node scripts/verify-staging-gate.mjs <base-url>
 *
 * Env:
 *   SMOKE_PATHS  space-separated paths (default "/ /aboutus/ /blog/")
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {'gated' | 'ungated' | 'unexpected' | 'error'} CustomHostVerdict */

/**
 * @param {number} statusCode
 * @returns {{ ok: boolean; verdict: CustomHostVerdict }}
 */
export function evaluateCustomHostWithoutAuth(statusCode) {
  if (statusCode === 401 || statusCode === 403) {
    return { ok: true, verdict: "gated" };
  }
  if (statusCode >= 200 && statusCode < 400) {
    return { ok: false, verdict: "ungated" };
  }
  return { ok: false, verdict: "unexpected" };
}

/**
 * @param {{
 *   url: string;
 *   auth: string;
 *   status: number | null;
 *   verdict: CustomHostVerdict;
 *   ok: boolean;
 * }} probe
 */
export function formatProbeLog(probe) {
  return JSON.stringify({
    event: "staging_gate_probe",
    url: probe.url,
    auth: probe.auth,
    status: probe.status,
    verdict: probe.verdict,
    ok: probe.ok,
  });
}

/**
 * @param {Parameters<typeof formatProbeLog>[0]} probe
 */
export function logProbe(probe) {
  const line = formatProbeLog(probe);
  console.error(line);
  if (!probe.ok) {
    const statusLabel = probe.status === null ? "unknown" : String(probe.status);
    console.error(
      `::error::custom host must be gated without credentials (${probe.url}: HTTP ${statusLabel}, verdict=${probe.verdict})`,
    );
  }
}

/**
 * @param {string} url
 * @returns {{ status: number } | { error: true }}
 */
export function fetchStatusWithoutAuth(url) {
  const result = spawnSync(
    "curl",
    [
      "-sS",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      "--retry",
      "5",
      "--retry-delay",
      "3",
      "--retry-all-errors",
      url,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    return { error: true };
  }
  const status = Number.parseInt(result.stdout.trim(), 10);
  if (Number.isNaN(status)) {
    return { error: true };
  }
  return { status };
}

/**
 * @param {string} baseUrl
 * @param {string[]} paths
 * @returns {number} exit code (0 ok, 1 failed)
 */
export function runCustomHostGateCheck(baseUrl, paths) {
  const base = baseUrl.replace(/\/$/, "");
  let failed = 0;

  for (const path of paths) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const url = `${base}${normalized}`;
    const fetched = fetchStatusWithoutAuth(url);
    if ("error" in fetched) {
      logProbe({ url, auth: "none", status: null, verdict: "error", ok: false });
      failed = 1;
      continue;
    }
    const { ok, verdict } = evaluateCustomHostWithoutAuth(fetched.status);
    logProbe({ url, auth: "none", status: fetched.status, verdict, ok });
    if (!ok) {
      failed = 1;
    }
  }

  return failed;
}

function usage() {
  console.error("usage: verify-staging-gate.mjs <base-url>");
  return 64;
}

function main(argv) {
  if (argv.length !== 1) {
    return usage();
  }
  const pathsRaw = process.env.SMOKE_PATHS ?? "/ /aboutus/ /blog/";
  const paths = pathsRaw.trim().split(/\s+/).filter(Boolean);
  return runCustomHostGateCheck(argv[0], paths);
}

const isCli =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  process.exit(main(process.argv.slice(2)));
}
