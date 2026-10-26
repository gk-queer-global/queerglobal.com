// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorized, onRequest } from "../functions/_middleware.js";

const hdr = (u, p) => "Basic " + btoa(`${u}:${p}`);

test("rejects when secrets are missing", () => {
  assert.equal(isAuthorized(hdr("a", "b"), undefined, undefined), false);
  assert.equal(isAuthorized(hdr("a", "b"), "a", ""), false);
});

test("rejects missing, malformed and wrong credentials", () => {
  assert.equal(isAuthorized(null, "a", "b"), false);
  assert.equal(isAuthorized("Bearer x", "a", "b"), false);
  assert.equal(isAuthorized("Basic !!!", "a", "b"), false);
  assert.equal(isAuthorized(hdr("a", "c"), "a", "b"), false);
  assert.equal(isAuthorized(hdr("x", "b"), "a", "b"), false);
});

test("accepts the right credentials, including a colon in the password", () => {
  assert.equal(isAuthorized(hdr("a", "b:c"), "a", "b:c"), true);
});

test("onRequest returns 401 without auth and passes through with it", async () => {
  const env = { BASIC_AUTH_USER: "a", BASIC_AUTH_PASS: "b" };
  const next = async () => new Response("ok", { status: 200 });
  const denied = await onRequest({ request: new Request("https://x.test/"), env, next });
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get("WWW-Authenticate"), /^Basic /);
  const allowed = await onRequest({
    request: new Request("https://x.test/", { headers: { Authorization: hdr("a", "b") } }),
    env,
    next,
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("X-Robots-Tag"), "noindex, nofollow");
});