# Opportunities — friction receipts

Record friction the moment it happens: what you were doing, the evidence (command, error text, PR or
file), and what would have prevented it. Redact secrets, rewrite home paths to `~`, drop session and
machine identifiers; this repository is public.

## 2026-11-09 — efficiency plans lived outside the repo

- **What was happening:** briefing the phase 1 readers on prior art.
- **Evidence:** two 2026-11-09 efficiency plans (lint; test and coverage) with ranked, contested and killed
  sections existed only in session scratchpads under `~/.cache/claude-tmp/`, reachable only through
  agent-memory pointers. A reader that lacked the pointer would have re-derived a 70-minute baseline.
- **What would have prevented it:** this packet. Plans with killed and contested sections belong under a
  packet's `research/` from their first draft.

## 2026-11-09 — a docs-only packet PR triggers three Vercel preview builds

- **What was happening:** opening this packet's draft PR (#3016, 14 Markdown and JSON files under
  `explorations/`) through `yeet open`.
- **Evidence:** within a minute the Yeet inbox held three P1 rows, Vercel `oip-web`, `oip-web-staging` and
  `todox`, each failed on the build rate limit; all three acknowledged environment-only. None of the three
  apps can be affected by a change under `explorations/`, and no `ignoreCommand` is configured in their
  `vercel.json` files.
- **What would have prevented it:** a Vercel `ignoreCommand` bound to the same docs-only classifier the
  hosted admission uses, or path-scoped project settings; phase 2 area L1 owns the lever.

## 2026-11-09 — the economics report misattributes first reds

- **What was happening:** reading `bun run beep yeet economics` to rank the first-red lanes.
- **Evidence:** `actionableLane` falls back to `verdict.failedStepId`, so 46 of 46 local (182 fleet)
  "head-install-preflight" first reds are 2026-08-26 proof-lock handler errors in which the preflight never
  ran; the preflight passed 153 of 153 locally. One phase 1 lever (Y1) was built on that artifact before the
  deps-toolchain reader caught it.
- **What would have prevented it:** a `failureKind` guard in `Economics.ts` before the fallback, and a
  fixture with a handler-error attempt whose first plan step never started.

## 2026-11-09 — absolute home paths reached main through a review-only grep

- **What was happening:** landing the phase 2 brief (#3017), which recorded the clone's absolute path.
- **Evidence:** `git grep` for the operator's home prefix found 42 lines in 30 tracked files (this brief,
  and goal evidence in `citation-extraction-engine` and `claim-check-performance`). The only check was an
  orchestrator verify script that greps a diff for home prefixes; no hosted or cheap gate ran it, so every
  lane that skipped that script merged the path. Thirteen of the files are digest-sealed archives that
  can no longer be redacted without breaking their seals.
  Widening the scan to the dash-encoded form agent scratchpads use (`/tmp/claude-1000/-home-<user>-...`)
  found 136 more lines in 19 goal evidence files and one rewrite-rules file. A first seal census compared
  only full sha256 and git blob hashes and missed that two of those files, the openclaw spike-4
  `gen-A`/`gen-B` configs, are pinned by 16-hex sha256 prefixes in `logs/v2-setup.log` and the v3
  adjudication; review caught it and both were restored to their sealed bytes. The census now searches
  full digests, 8-hex prefixes of sha256, git blob, md5 and sha1, and base64 sha256 prefixes.
- **What would have prevented it:** a tracked-text law that hosted CI runs on every diff. Heavy /
  Lint Policy skips docs-only diffs and `yeet open` runs no local gate, so the cheap-gates lane alone would
  not have blocked #3017. `bun run beep laws private-home-paths --check` (`lint:private-home-paths`) now
  runs in the cheap gates and in hosted Repo Sanity, which runs for docs-only diffs; for a packet-prose
  (`goals_only`) diff Repo Sanity skips its lane body and runs only this law. The law passes only
  placeholder users, limits fleet accounts to the files that already name them, holds the sealed archives
  to exact counts, and decodes NUL-bearing files instead of skipping them.
