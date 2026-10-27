# Security — queerglobal.com (staging)

This file records how the QueerGlobal staging site is protected, which security standards it was checked against, what passed, and what is still open. Update it whenever a security review runs.

**Standard this follows:** [Security review standard — mnyon-grandkru/standards](https://github.com/mnyon-grandkru/standards/blob/main/security-review.md)

## What is protected and how

- **Hosting:** Cloudflare Pages project `queerglobal-grandkru` (production branch `main`). Planned custom staging host: `staging.queerglobal.grandkru.com` (attached by the CI deploy job; not live as of the last review).
- **Login gate:** `functions/_middleware.js` asks for HTTP Basic credentials on every request, every method and every path, including assets. Credentials live in Pages secrets `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` (source of truth: Doppler `grandkru-static-sites` / `prd`, names `QUEERGLOBAL_BASIC_AUTH_USER` / `QUEERGLOBAL_BASIC_AUTH_PASS`). If either secret is missing the site stays closed (401).
- **Comparison:** constant-time, including length. Passwords may contain colons.
- **Indexing:** every response carries `X-Robots-Tag: noindex, nofollow`.
- **Deploys:** GitHub Actions on push to `main` only. The workflow never creates a Pages project, always uploads the middleware, and smoke-tests 401 without and 200 with the login on the deployment URL and the staging host.
- **Never commit** credentials, archives (`.zip`, `.tar`, `.gz`, `.tgz`, `.7z`, `.rar`) or absolute `https://queerglobal.com` links. CI tests enforce the last two.

## Last review

| | |
|---|---|
| Date | Oct 27, 2026 (black-box tests 12:43–12:48 PM ET) |
| Ticket | [GKT-1651](https://linear.app/gkt/issue/GKT-1651) |
| PRs covered | #5 login gate, #6 asset paths, #7 revisions stylesheet, #8 no published archives, #9 deploy workflow, #10 link check |
| Type | Diff review + CI log review + non-destructive black-box tests on our own staging and preview hosts. **Not a penetration test.** |
| Verdict | No code-level vulnerability. All six PRs merge-safe (#9 must land right after #5). One deployment finding open (below). |

## Frameworks and versions

| Framework | Version | How it was used | Result summary |
|---|---|---|---|
| OWASP ASVS | 5.0.0 — L1, plus L2 for V6 Authentication and V7 Session | Item-by-item on the login gate and deploy changes | Pass, except 6.1.1 / 6.3.1 (no brute-force throttling, nit) and 6.3.4 (old deployments bypass the gate, see Known gaps) |
| OWASP Top 10 | 2025 | Mapped per PR | A01 pass in code (deployment gap below); A02 nits (no CSP / frame-ancestors on pages); A07 pass |
| OWASP Top 10 CI/CD Security Risks | CICD-SEC-1…10 | Deploy workflow (#5, #9, #10) | Pass on PPE, artifact integrity, logging; nits on flow control (no environment gate) and dependency chain (actions not SHA-pinned) |
| GitHub Actions secure-use guide | docs.github.com, read Oct 27 2026 | Deploy workflow | Pass: least-privilege token, no script injection, no `pull_request_target`. Nits: SHA pinning, environments, Dependabot for actions |
| Grand Kru standards S1–S6 | `review-readiness.md` | Every PR | S1 pass, S3 pass, S4 pass in code, S5 pass (no new deps), S2/S6 N/A |

For the full per-control tables with file references and CI log links, see the [GKT-1651 review record](https://linear.app/gkt/issue/GKT-1651) (RESULTS bundle attached to the ticket). A short summary of frameworks and gaps also lives in [docs/STANDARDS.md](docs/STANDARDS.md).

## Test evidence (Oct 27, 2026)

- 49 bypass probes per host (HTTP methods, `//`, `/./`, `%2e`, encoded slashes, case changes, `/functions/_middleware.js`, `/.well-known/`, `/robots.txt`, malformed `Authorization` headers, `X-Forwarded-*`, `X-Original-URL`, `X-Rewrite-URL`) on the main alias and the #10 preview: every probe that reached the site returned 401; the rest were rejected by Cloudflare's edge (400/403).
- With the correct login: 200 on `/`, `/aboutus/`, `/blog/`, `/revisions/`. Wrong user or wrong password: 401.
- Repo-only files (`/.github/…`, `/package.json`, `/functions/…`, `/tests/…`, `/scripts/…`) are not served; requests get the normal page fallback.
- The 401 response leaks nothing: fixed 23-byte body, `no-store`, `noindex`.

## Known gaps (open)

1. **Old deployments bypass the gate (Medium).** Two deployments made before the middleware existed (`00da7931…` and `a7c2afaa….queerglobal-grandkru.pages.dev`) still serve the old site without a login, including `revisions/web19201.zip`. Fix: delete those deployments in Cloudflare Pages or add Cloudflare Access to `*.queerglobal-grandkru.pages.dev`. Needs Mark's go.
2. No brute-force throttling on 401s. The 28-character password makes guessing impractical; add a Cloudflare rate-limit rule.
3. No CSP, `frame-ancestors` or HSTS on pages. `.pages.dev` is HSTS-preloaded; the `grandkru.com` staging host will need HSTS once attached. Consider a `_headers` file.
4. CI runs no secret, code or dependency scanners, and GitHub secret scanning and push protection are off on this public repo.
5. GitHub Actions are pinned by tag, not commit SHA, while the deploy job holds the Cloudflare token. The deploy job has no `environment:` approval gate.
6. Smoke script passes the login on the curl command line (ephemeral runner; low risk).
7. `queerglobal.com` DNS returned SERVFAIL (lame delegation) on Oct 27, 2026. `staging.queerglobal.grandkru.com` does not exist yet.
8. `qg-site.pages.dev` belongs to an unrelated third party. It was never ours; ignore it.

## Standards not used, and why

- **Penetration test / OWASP WSTG:** not run. The review was limited to non-destructive checks. Schedule one before production launch.
- **ASVS L3:** not targeted; staging gate on a static brochure site.
- **ASVS V4 API, V9 tokens, V10 OAuth, V17 WebRTC, V7 session tokens:** not applicable. There is no API, no cookies or sessions, and no OAuth.
- **OWASP Secure Headers Project:** not applied to this site yet (it was applied to the activism Worker). Use it when headers are added (gap 3).
- **SLSA / OpenSSF Scorecard:** not run; no build provenance yet. Partly covered by CICD-SEC-3 and CICD-SEC-9.
- **GitHub branch protection and environment rules:** could not be read with the review's read-only access. Confirm by hand.
