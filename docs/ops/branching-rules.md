# Branching & Conflicts

- Default: main; features: feat/*, fix/*, chore/*, docs/*
- Rebase onto main before review; use --force-with-lease only
- Merge: squash for small, rebase for linear history
- Require 1 review + passing CI on protected branches

## Open PR ➝ feature branch map (as of 2025-11-17)

| PR # | Title | Feature branch |
| --- | --- | --- |
| 595 | Codex/fix cors header for disallowed origins 2025 10 29 l52e66 | `codex/fix-cors-header-for-disallowed-origins-2025-10-29-l52e66` |
| 594 | Codex/update wrangler.toml for d1 and kv 2025 11 03 | `codex/update-wrangler.toml-for-d1-and-kv-2025-11-03` |
| 593 | Use Web Crypto nonce helper with environment guards | `codex/update-middleware-for-globalthis.crypto-2025-11-03` |
| 590 | Restore API worker schema and documentation | `codex/fix-merge-artifact-in-api-worker-2025-11-17` |
| 588 | jules/clean-foundation | `agent/update-upsert-goldshore-dns.sh-script` |
| 587 | Codex/GitHub mention refactor repo into cloudflare/astro monorepo 2025 11 17 | `codex/github-mention-refactor-repo-into-cloudflare/astro-monorepo-2025-11-17` |
| 586 | Codex/GitHub mention fix goldshore dns ssl 2025 11 17 | `codex/github-mention-fix-goldshore-dns-ssl-2025-11-17` |
| 585 | Codex/fix high priority codex review issues 2025 11 17 | `codex/fix-high-priority-codex-review-issues-2025-11-17` |
| 575 | Fix goldshore dns ssl | `codex/github-mention-fix-goldshore-dns-ssl-2025-11-17-73us46` |
| 574 | Fix RS256 auth test mocking | `codex/fix-rs256-test-to-mock-importkey-correctly-2025-11-17` |
| 571 | Fix API worker routing and durable object exports | `codex/github-mention-codex/fix-critical-bug-in-api-worker-2025-11-2025-11-17` |
| 563 | Revert "Fix DNS and SSL Configuration for goldshore.org" | `revert-534-fix-goldshore-dns-ssl` |
| 562 | Implement RS256 JWT Authentication for API Worker | `fix-goldshore-dns-ssl` |
| 561 | Codex/GitHub mention fix website theme display issue 2025 11 13 | `codex/github-mention-fix-website-theme-display-issue-2025-11-13` |
| 559 | Codex/fix high priority bug in api route handling 2025 11 02 | `codex/fix-high-priority-bug-in-api-route-handling-2025-11-02` |
| 558 | Codex/GitHub mention ensure risk kill switch initializes configur 2025 11 03 | `codex/github-mention-ensure-risk-kill-switch-initializes-configur-2025-11-03` |
| 556 | Codex/resolve merge conflicts 2025 11 01 fon2f9 | `codex/resolve-merge-conflicts-2025-11-01-fon2f9` |
| 555 | Fix goldshore dns ssl | `fix-goldshore-dns-ssl` |
| 552 | Codex/fix critical bug in api worker 2025 11 02 p4483u | `codex/fix-critical-bug-in-api-worker-2025-11-02-p4483u` |
| 551 | Codex/fix high priority codex review issues 2025 11 01 | `codex/fix-high-priority-codex-review-issues-2025-11-01` |
| 550 | Codex/GitHub mention codex/reconnect cloudflare worker to admin a 2025 11 02 p4gyo2 | `codex/github-mention-codex/reconnect-cloudflare-worker-to-admin-a-2025-11-02-p4gyo2` |
| 549 | Codex/pull latest and resolve conflicts 2025 11 02 | `codex/pull-latest-and-resolve-conflicts-2025-11-02` |
| 510 | Codex/standardize secret naming convention 2025 11 03 | `codex/standardize-secret-naming-convention-2025-11-03` |
| 355 | Revert 78 codex/fix cors configuration for access jwt header swoovy | `revert-78-codex/fix-cors-configuration-for-access-jwt-header-swoovy` |
| 344 | Separate worker and Pages Wrangler configs | `codex/github-mention-prevent-production-deploy-from-overriding-pr-2025-10-28` |
| 329 | Prevent production deploy from overriding preview routes | `codex/update-wrangler.toml-at-line-33-2025-10-27` |
| 324 | Codex/set up GitHub actions for goldshore | `codex/set-up-github-actions-for-goldshore` |
| 313 | Codex/fix conflicting dns records in upsert script | `codex/fix-conflicting-dns-records-in-upsert-script` |
| 289 | Clarify router route configuration to protect API subdomains | `agent/fix-high-priority-bug-in-wildcard-routes` |
| 231 | Revert 202 codex/fix high priority codex review issues 148vm5 | `revert-202-codex/fix-high-priority-codex-review-issues-148vm5` |

_Source: `https://api.github.com/repositories/1003699792/pulls?state=open` pulled on 2025-11-17 18:05 UTC._
