# Security review: open queerglobal.com PRs (#5–#10)

**Review date:** 2026-10-27 (UTC)  
**Reviewer:** Cloud Agent security pass (Mark-requested pre-merge review, Oct 27 2026)  
**Site:** Cloudflare Pages project `queerglobal-grandkru` (production hostname `queerglobal-grandkru.pages.dev`; custom domain `queerglobal.grandkru.com` per product intent)

## Frameworks applied

| Framework | Version / source | How used |
|-----------|------------------|----------|
| OWASP ASVS | 5.0 Level 1 (all PRs); Level 2 for authentication and session handling (PR #5 middleware, PR #9 deploy/smoke) | Control-by-control pass/fail/n/a in tables below |
| OWASP Top 10 | 2021 (2025 not used; no final 2025 release referenced at review time) | Mapped to relevant categories per PR |
| OWASP Top 10 CI/CD Security Risks | CI/CD Top 10 (2022) | PR #9, #10 workflow and scripts |
| GitHub Actions security hardening | [GitHub Docs: Security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions) | Workflow `permissions`, secrets usage, third-party actions |
| Cloudflare Pages Functions | [Pages Functions middleware](https://developers.cloudflare.com/pages/functions/middleware/) | PR #5 middleware behavior and deploy bundling |

**Not used (and why):**

- **OWASP Top 10 2025:** Not cited as a finalized standard at review time; 2021 mapping used instead.
- **Full ASVS Level 2/3:** Static marketing site with HTTP Basic Auth at the edge; only auth-related Level 2 controls were in scope.
- **DAST / authenticated crawling:** No credentials in the review environment; see [Known gaps](#known-gaps).
- **Production custom domain black-box:** `queerglobal.grandkru.com` did not resolve from the review environment (DNS); Pages default hostname and branch previews were tested instead.

## Planned merge order (per team)

#5 → #9 → #10 → #6 → #7 → #8 (each retargeted to `main` as described in PR bodies).

## Per-PR verdict summary

| PR | Title (short) | Verdict | Blocking findings |
|----|----------------|---------|-------------------|
| [#5](https://github.com/gk-queer-global/queerglobal.com/pull/5) | Staging basic-auth middleware | **Fail** (merge blocked) | CI deploy excludes `functions/`; next `main` deploy can drop middleware until #9 merges |
| [#9](https://github.com/gk-queer-global/queerglobal.com/pull/9) | Fix Pages deploy workflow | **Pass** | None |
| [#10](https://github.com/gk-queer-global/queerglobal.com/pull/10) | Fail CI on absolute internal links | **Pass** | None |
| [#6](https://github.com/gk-queer-global/queerglobal.com/pull/6) | Root-relative `/assets/` paths | **Pass** | None |
| [#7](https://github.com/gk-queer-global/queerglobal.com/pull/7) | Restore `revisions/web19201.css` | **Pass** (with pending authenticated checks) | None |
| [#8](https://github.com/gk-queer-global/queerglobal.com/pull/8) | Stop publishing revisions zip | **Pass** (with pending authenticated checks) | None |

---

## PR #5 – `functions/_middleware.js` (staging password gate)

**Branch:** `staging-password-gate`  
**Black-box base URL:** `https://queerglobal-grandkru.pages.dev/` (401 without credentials; middleware present). No live branch preview found for `staging-password-gate.*.pages.dev` (404).

### OWASP ASVS 5.0 (selected controls)

| ID / topic | Level | Result | Reason | Evidence |
|------------|-------|--------|--------|----------|
| V2.2.1 Session/auth mechanism | 2 | Pass | HTTP Basic validated on every request before `next()` | [`functions/_middleware.js` L45–48](https://github.com/gk-queer-global/queerglobal.com/blob/staging-password-gate/functions/_middleware.js#L45-L48) |
| V2.2.2 Fail closed | 2 | Pass | Missing `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` denies | [`functions/_middleware.js` L29–30, L46–47](https://github.com/gk-queer-global/queerglobal.com/blob/staging-password-gate/functions/_middleware.js#L29-L30) |
| V2.2.3 Constant-time compare | 2 | Pass | `safeEqual` bitwise OR over padded bytes | [`functions/_middleware.js` L19–26](https://github.com/gk-queer-global/queerglobal.com/blob/staging-password-gate/functions/_middleware.js#L19-L26) |
| V2.2.4 Colon in password | 2 | Pass | Split on first `:` only | Test: `tests/middleware.test.mjs` "colon in the password" |
| V3.3.1 Logout / session end | 2 | n/a | Stateless Basic Auth | — |
| V14.4.1 Security headers | 1 | Partial | 401: `Cache-Control: no-store`, `X-Robots-Tag`; no CSP/X-Frame-Options on gate | curl 2026-10-27 vs `queerglobal-grandkru.pages.dev` |
| V14.5.1 Unauthorized caching | 1 | Pass | `Cache-Control: no-store` on 401 | Same curl output |

### OWASP Top 10 2021

| Risk | Result | Reason | Evidence |
|------|--------|--------|----------|
| A01 Broken Access Control | **Fail (deploy path)** | Middleware code is sound; **CI deploy omits `functions/`** | [`.github/workflows/ci.yml` rsync exclude](https://github.com/gk-queer-global/queerglobal.com/blob/staging-password-gate/.github/workflows/ci.yml) (see PR #9 diff) |
| A02 Cryptographic Failures | Pass | Credentials only over TLS (Pages); secrets in env | Black-box HTTPS only |
| A05 Security Misconfiguration | Fail (deploy) | Wrong Pages project `qg-site` and auto-create on main | Same workflow file on branch |
| A07 Identification and Authentication Failures | Pass (runtime) | No bypass in black-box tests | See [Black-box tests](#black-box-tests-2026-10-27) |

### CI/CD + Cloudflare

| Check | Result | Reason | Evidence |
|-------|--------|--------|----------|
| CICD-SEC-03 Dependency chain | Pass | Pinned `html-validate@9.7.1`; `npm test` no new deps | `package.json` on branch |
| CICD-SEC-06 Insufficient CD hardening | **Fail** | Deploy bundle excludes middleware | rsync `--exclude=functions` |
| Pages Functions bundling | **Fail** | Deploy from `$RUNNER_TEMP/site` without `functions/` | workflow deploy step |
| GHA least privilege | Pass | `permissions: contents: read` on workflow | workflow top |

### Local testing (wrangler)

| Test | Result | Evidence |
|------|--------|----------|
| `wrangler pages dev` + `.dev.vars` | Pass | 401 without auth, 200 with valid Basic, `X-Robots-Tag` on 200 | Local run 2026-10-27, port 8791 |
| `npm test` middleware | Pass | 4/4 tests | CI run [40386043514](https://github.com/gk-queer-global/queerglobal.com/actions/runs/40386043514) |

**Blocking finding:** Merge **#5 alone** allows the existing `main` deploy job (on this branch) to publish static files **without** middleware to whatever project `qg-site` resolves to, and even after retargeting, excludes `functions/` until **#9** merges. **Do not merge #5 without #9’s workflow changes landing before the next production deploy.**

---

## PR #9 – Pages deploy workflow

**Branch:** `cursor/fix-pages-deploy-workflow-d902`  
**Preview:** No dedicated preview URL responded (404 for guessed hostnames). Assessment is code + CI.

| Check | Result | Reason | Evidence |
|-------|--------|--------|----------|
| ASVS V2 deploy enforcement | Pass | `functions/` included in rsync; smoke expects 401/200 | [`.github/workflows/ci.yml`](https://github.com/gk-queer-global/queerglobal.com/blob/cursor/fix-pages-deploy-workflow-d902/.github/workflows/ci.yml) |
| CICD-SEC-05 Insufficient PBAC | Pass | No `project create`; `ensure-pages-project.sh` read-only verify | `scripts/ensure-pages-project.sh` |
| GHA secrets in logs | Pass | Smoke uses `-u` via env; script does not echo secrets | `scripts/smoke-basic-auth.sh` |
| Workflow injection | Pass | Project name from fixed env `PAGES_PROJECT`, not `github.event` input | workflow `env` |
| Third-party actions | Pass | `actions/checkout@v4`, `wrangler-action@v3` pinned major | workflow |

**Verdict:** Pass. Required to unblock #5’s production safety.

---

## PR #10 – Absolute internal link CI check

**Branch:** `cursor/reject-absolute-internal-links-7223`  
**Preview:** `https://cursor-reject-absolute-inter.queerglobal-grandkru.pages.dev` (401 without auth)

| Check | Result | Reason | Evidence |
|-------|--------|--------|----------|
| CICD-SEC-01 Flow control | **Fail on `main` today** | `rg` missing on `ubuntu-latest` → step passes | Simulated `PATH=/usr/bin:/bin` + [main workflow L26–31](https://github.com/gk-queer-global/queerglobal.com/blob/main/.github/workflows/ci.yml#L26-L31) |
| CICD-SEC-01 after fix | Pass | `reject-absolute-internal-links.sh` uses `grep`, exits non-zero on match | `scripts/reject-absolute-internal-links.sh` |
| Script safety | Pass | No user-controlled shell; optional root dir only | script header |
| Unit tests | Pass | Fixture fails, site tree passes | `scripts/tests/test_reject_absolute_internal_links.py` |

**Verdict:** Pass.

---

## PR #6 – Root-relative asset paths

**Branch:** `cursor/fix-section-assets-paths-853f`  
**Preview:** None available (404).

| Check | Result | Reason | Evidence |
|-------|--------|--------|----------|
| ASVS / Top 10 | n/a | Static path fix only; no auth or secrets | HTML/CSS diff |
| A03 Injection | Pass | No new dynamic output | File changes |
| Open redirect | n/a | No redirects added | — |

**Verdict:** Pass (static correctness; regression test `tests/section-assets-paths.test.mjs` in CI).

---

## PR #7 – Revisions stylesheet

**Branch:** `cursor/fix-revisions-css-a3cc`  
**Preview:** `https://cursor-fix-revisions-css-a3c.queerglobal-grandkru.pages.dev`

| Check | Result | Reason | Evidence |
|-------|--------|--------|----------|
| Information disclosure | Pass | Adds public CSS only (same content as zip) | `revisions/web19201.css` |
| Access control | Pass | Preview returns 401 without credentials for `/revisions/web19201.css` | Black-box 2026-10-27 |

**Verdict:** Pass. Authenticated 200 + byte match pending (no credentials).

---

## PR #8 – Remove published archive

**Branch:** `cursor/block-published-archives-7c08`  
**Preview:** `https://cursor-block-published-archi.queerglobal-grandkru.pages.dev`

| Check | Result | Reason | Evidence |
|-------|--------|--------|----------|
| A01 Exposure | Pass (intent) | Zip removed from tree; guard in `npm test` | Diff removes `revisions/web19201.zip` |
| Unauthenticated zip fetch | Pass | `/revisions/web19201.zip` → 401 on preview | Black-box 2026-10-27 |

**Verdict:** Pass. Authenticated **404** for zip pending (no credentials).

---

## Black-box tests (2026-10-27)

**Policy:** Non-destructive requests only; no credentials; hosts under our control.

### Hosts tested

| Host | Role |
|------|------|
| `https://queerglobal-grandkru.pages.dev` | Production Pages URL (middleware active) |
| `https://cursor-fix-revisions-css-a3c.queerglobal-grandkru.pages.dev` | PR #7 preview |
| `https://cursor-block-published-archi.queerglobal-grandkru.pages.dev` | PR #8 preview |
| `https://cursor-reject-absolute-inter.queerglobal-grandkru.pages.dev` | PR #10 preview |

**Not tested:** `queerglobal.grandkru.com` (DNS NXDOMAIN from review VM), PR #5/#6/#9 branch previews (404).

### Unauthenticated access (expect HTTP 401)

All tests below returned **401** unless noted.

| Category | Request | Result |
|----------|---------|--------|
| Method | `GET /` | 401 |
| Method | `HEAD /` | 401 |
| Method | `OPTIONS /` | 401 |
| Method | `POST /` | 401 |
| Header | `X-Forwarded-For: 127.0.0.1` | 401 |
| Header | `X-Original-URL: /` | 401 |
| Header | `X-Rewrite-URL: /index.html` | 401 |
| Header | `X-Real-IP: 10.0.0.1` | 401 |
| Path | `//aboutus//` | 401 |
| Path | `/aboutus/../index.html` | 401 |
| Path | `/ABOUTUS/` | 401 |
| Path | `/aboutus` (no trailing slash) | 401 |
| Path | `/assets/ellipse40.png` | 401 |
| Path | `/revisions/web19201.zip` | 401 |
| Path | `/revisions/web19201.css` | 401 |
| Path | `/functions/_middleware.js` | 401 |
| Path | `/%2e%2e/` | **400** (Cloudflare edge; not a bypass) |

### Security headers on 401 (`queerglobal-grandkru.pages.dev`)

| Header | Present |
|--------|---------|
| `WWW-Authenticate: Basic realm="QueerGlobal staging"` | Yes |
| `Cache-Control: no-store` | Yes |
| `X-Robots-Tag: noindex, nofollow` | Yes |
| `Content-Security-Policy` | No |
| `X-Frame-Options` / `frame-ancestors` | No |
| `Strict-Transport-Security` | Not on 401 body (TLS still enforced by HTTPS) |

---

## Known gaps

### Authenticated checks (pending)

No `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` in the review environment. After merge, run:

```bash
export BASE="https://queerglobal-grandkru.pages.dev"
export AUTH="USER:PASS"   # from Doppler / Pages secrets

# Security headers on real HTML
curl -sS -D - -o /dev/null -u "$AUTH" "$BASE/"

# Revisions stylesheet (PR #7)
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" -u "$AUTH" "$BASE/revisions/web19201.css"

# Zip must 404 after PR #8
curl -sS -o /dev/null -w "%{http_code}\n" -u "$AUTH" "$BASE/revisions/web19201.zip"
```

### GitHub PR comments

The review token could not post comments on PR #5 (`Resource not accessible by integration`). The blocking finding for #5 is recorded here and in the Linear result comment.

### XSS / robots

No dynamic user input on static HTML; XSS probes were not applicable. `X-Robots-Tag` on 401 confirmed; authenticated HTML `noindex` behavior not re-checked without credentials.

---

## Follow-up nits (non-blocking)

1. Add rate limiting or Cloudflare WAF rule on repeated 401s (Basic Auth brute force).
2. Add baseline security headers (CSP, `X-Frame-Options` or CSP `frame-ancestors`) on authenticated responses.
3. Document local `wrangler pages dev` with `.dev.vars` for `BASIC_AUTH_*` (review used this successfully).
4. Align workflow `STAGING_HOST` (`staging.queerglobal.grandkru.com`) with production custom domain naming if intentional.
5. Confirm GitHub secrets `QUEERGLOBAL_BASIC_AUTH_*` exist before merging #9 (not verifiable from agent token).

---

## CI evidence (all PRs)

HTML validity and deploy-script jobs **passed** on the latest runs for PRs #5–#10 (2026-10-27). Deploy job skipped on PR builds (expected).
