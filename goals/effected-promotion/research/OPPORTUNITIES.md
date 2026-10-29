# Friction receipts

- 2026-10-28, PR #2329 takeover: hosted Heavy / Lint Policy ran for 1,091 seconds before reporting `goals doctor` failure `ops-script-duplicate` for `ops/github-reporting-gfm-differential.ts`. Running `bun run beep goals doctor` after manifest merge would have caught the duplicate before publication. Removed the second identical registration and reran the focused check.
