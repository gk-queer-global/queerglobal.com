# Standards — queerglobal.com

This file lists the external and Grand Kru standards that apply to this repository, what was checked, and the results. It follows [Cite external standards in every review, plan, and build](https://github.com/mnyon-grandkru/standards/blob/main/cite-external-standards.md). Security detail lives in [SECURITY.md](../SECURITY.md), which follows the [security review standard](https://github.com/mnyon-grandkru/standards/blob/main/security-review.md).

## Repository

| Field | Value |
|---|---|
| **What this is** | Static marketing site (HTML/CSS) deployed to Cloudflare Pages |
| **Primary audience** | Staging reviewers and operators; production launch is future work |
| **Last standards pass** | 2026-10-27 ([GKT-1651](https://linear.app/gkt/issue/GKT-1651)) |
| **Next review** | After the next security- or deploy-affecting change, or quarterly per Grand Kru cite-external-standards |

## Project documentation map

| Document | Status | Purpose |
|---|---|---|
| [README.md](../README.md) | This PR | Entry point and links |
| [SECURITY.md](../SECURITY.md) | This PR | Controls, frameworks, gaps, test evidence |
| **docs/STANDARDS.md** (this file) | This PR | Standards inventory and check results |
| Architecture / ADRs / runbook / CHANGELOG | Not yet | Static brochure site; add when behavior or ops grow |

## Grand Kru standards

| ID / name | Link | Applies how | Oct 27, 2026 result |
|---|---|---|---|
| Cite external standards | [cite-external-standards.md](https://github.com/mnyon-grandkru/standards/blob/main/cite-external-standards.md) | Name frameworks, versions, pass/fail/n/a, and explain omissions | **Pass** — this file + SECURITY.md |
| Security review | [security-review.md](https://github.com/mnyon-grandkru/standards/blob/main/security-review.md) | Record review method, evidence, and open gaps | **Pass** — SECURITY.md |
| Review readiness S1–S6 | [review-readiness.md](https://github.com/mnyon-grandkru/standards/blob/main/review-readiness.md) | Pre-merge checklist on PRs #5–#10 | S1 pass, S3 pass, S4 pass in code (deployment gap in SECURITY.md), S5 pass, S2/S6 N/A |

## External standards by domain

### Security

| Standard | Version / source | Scope here | Result | Evidence |
|---|---|---|---|---|
| OWASP ASVS | 5.0.0 — L1; L2 for V6/V7 on auth | Login gate + deploy (#5, #9) | Pass with nits; **Medium** deployment gap (old Pages URLs) | SECURITY.md; GKT-1651 RESULTS |
| OWASP Top 10 | 2025 | All open PRs #5–#10 | Pass in code; A02 nits (headers) | Same |
| OWASP Top 10 CI/CD | CICD-SEC-1…10 | Deploy workflow | Pass with nits (SHA pin, environment gate) | Same |
| GitHub Actions secure use | docs.github.com (2026-10-27) | `ci.yml` deploy job | Pass with nits | Same |
| OWASP WSTG / penetration test | — | — | **Not run** | Non-destructive review only; schedule before production |
| OWASP Secure Headers | headers_add.json (2026-10-18) | — | **Not applied** | No CSP/HSTS yet; see SECURITY.md gap 3 |

### Accessibility

| Standard | Version | Scope | Result | Why |
|---|---|---|---|---|
| WCAG | 2.2 | Public marketing pages | **Not assessed** | No accessibility audit in GKT-1651; schedule before production launch |

### Engineering and delivery

| Standard | Version | Scope | Result | Notes |
|---|---|---|---|---|
| Conventional Commits | 1.0.0 | Git history | **Partial** | Team uses descriptive messages; not enforced by bot |
| Semantic Versioning | 2.0.0 | Releases | **N/A** | No versioned package releases |
| Twelve-Factor App | — | Static site + Pages | **Partial** | Config in Pages secrets/Doppler (III); no backing services |
| HTML | WHATWG / W3C validator via html-validate | CI on `main` | **Pass** | CI workflow on merged PRs |

### Documentation

| Standard / guide | Scope | Result |
|---|---|---|
| Grand Kru documentation standard (GKT-1652 / standards #11) | Project-level README, SECURITY, STANDARDS | **In progress** — this PR |
| Diátaxis | Structure of docs | **Partial** — how-to lives in PR bodies and scripts; reference is SECURITY/STANDARDS |

## Summary of the Oct 27, 2026 review (PRs #5–#10)

- **Method:** Diff review, CI log review, and non-destructive black-box tests on our own Pages hosts only. Not a penetration test.
- **Code verdict:** No exploitable vulnerability in the reviewed PRs. All six PRs are merge-safe; **#9 should land immediately after #5** so deploys always include `functions/`.
- **Deployment finding:** Two pre-middleware Pages deployment URLs still serve the site without a login (including a published zip). Cloudflare cleanup or Access is required — see SECURITY.md known gap 1.
- **CI integrity:** Link check using `rg` was a silent no-op until #10; fixed on the #10 branch.
- **Full evidence:** Per-control tables, log URLs, and black-box transcripts are in the GKT-1651 RESULTS bundle on [Linear](https://linear.app/gkt/issue/GKT-1651). This repo does not duplicate that file to avoid drift; SECURITY.md summarizes outcomes.

## Standards deliberately not used

| Standard | Reason |
|---|---|
| ASVS L3 | Staging gate on a static site; L1 + targeted L2 is enough |
| ASVS API / OAuth / session chapters | No API, cookies, or OAuth |
| SLSA / OpenSSF Scorecard | No build provenance program yet |
| WCAG 2.2 (this pass) | Out of scope for GKT-1651; track for launch |
| Load / fuzz testing | Explicitly excluded from the review charter |

Silence is not allowed for future reviews: if a standard in the Grand Kru frameworks list applies and is skipped, record why here or in SECURITY.md.

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Initial project STANDARDS.md for GKT-1651 / GKT-1652 |
