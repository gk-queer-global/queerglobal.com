import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCustomHostWithoutAuth,
  formatProbeLog,
} from "../scripts/verify-staging-gate.mjs";

test("401 without credentials is gated", () => {
  assert.deepEqual(evaluateCustomHostWithoutAuth(401), { ok: true, verdict: "gated" });
});

test("403 without credentials is gated", () => {
  assert.deepEqual(evaluateCustomHostWithoutAuth(403), { ok: true, verdict: "gated" });
});

test("2xx without credentials is not gated", () => {
  assert.deepEqual(evaluateCustomHostWithoutAuth(200), { ok: false, verdict: "ungated" });
  assert.deepEqual(evaluateCustomHostWithoutAuth(204), { ok: false, verdict: "ungated" });
});

test("3xx without credentials is not gated", () => {
  assert.deepEqual(evaluateCustomHostWithoutAuth(301), { ok: false, verdict: "ungated" });
  assert.deepEqual(evaluateCustomHostWithoutAuth(302), { ok: false, verdict: "ungated" });
});

test("other status codes fail", () => {
  assert.deepEqual(evaluateCustomHostWithoutAuth(404), { ok: false, verdict: "unexpected" });
  assert.deepEqual(evaluateCustomHostWithoutAuth(500), { ok: false, verdict: "unexpected" });
  assert.deepEqual(evaluateCustomHostWithoutAuth(502), { ok: false, verdict: "unexpected" });
});

test("probe log line is structured JSON", () => {
  const line = formatProbeLog({
    url: "https://example.test/",
    auth: "none",
    status: 403,
    verdict: "gated",
    ok: true,
  });
  const parsed = JSON.parse(line);
  assert.equal(parsed.event, "staging_gate_probe");
  assert.equal(parsed.status, 403);
  assert.equal(parsed.verdict, "gated");
  assert.equal(parsed.ok, true);
});
