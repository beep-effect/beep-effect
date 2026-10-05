# P3 current-main closeout proof

Date: 2026-10-05
Head: `8b7392fe00` (`origin/main`)
Verdict: PASS for the owned acceptance matrix on current main

## Context

The implementation shipped in PR #871 (`feat(langextract): persist
verified-span history and re-anchor proofs`, merged 2026-08-30). The packet
stayed at P2 because the exact-head full verify and hosted merge-ready
receipt were still owed. This closeout re-proves the owned matrix on the
current `main` head after the intervening Effect snapshot bumps and the
`@beep/schema` parity retirements (#1338, #1341, #1346, #1347, #1353, #1371),
then flips the packet to complete.

## Commands and results

```sh
bun run beep quality package-verify @beep/provenance
bun run beep quality package-verify @beep/langextract
```

Both pass audit and docgen (`ok audit`, `ok docgen`).

```sh
cd packages/foundation/modeling/provenance && bun run beep:test
cd packages/foundation/capability/langextract && bun run beep:test
```

| Package | Test files | Tests | Focused verified-span tests |
| --- | --- | --- | --- |
| `@beep/provenance` | 3 | 22 | 14 (`VerifiedTextAnchor.test.ts`) |
| `@beep/langextract` | 7 | 98 | 36 (`VerifiedSpanSpike.test.ts` + `VerifiedSpanHistory.test.ts`) |

```sh
bun run beep lint schema-first          # introduced=0, parity ratchet ok
bun run beep lint reflection-artifacts  # blocking_findings=0 advisory_findings=0
```

## Acceptance matrix on current main

| Criterion | Evidence |
| --- | --- |
| Hostile-text fixture set and locked conversion contract | `history/p0/2026-07-29-hostile-text-contract.md`; `VerifiedSpanSpike.test.ts` still passes on current main |
| Half-open UTF-16 offsets and `source.slice(start, end) === quote` | `VerifiedTextAnchor.test.ts` and `VerifiedSpanSpike.test.ts` |
| Cross-chunk/page straddle, malformed reconstruction fails closed | `VerifiedSpanSpike.test.ts` straddle cases |
| Ambiguous duplicates, foreign offsets, absent text, cross-matter, digest mismatch fail closed | `VerifiedSpanSpike.test.ts` and `VerifiedSpanHistory.test.ts` typed outcomes |
| Source drift never rewrites an anchor; re-anchor links both attempts | `VerifiedSpanHistory.test.ts` stale-source then linked re-anchor |
| Persistence retains required fields; negative attempt persists without entity | `VerifiedSpanHistory.test.ts` `S.fromJsonString` round-trips |
| Focused tests, repo gates, reflection lint, Yeet PR-to-mergeable | This file plus the closeout PR's Yeet receipt |
| No unrelated refactors or formatting churn | Closeout PR touches only this packet |

## Attribution note

The primary clone's `node_modules` predated the catalog bump in #1410, so the
first test run failed with `Cannot find package 'vite'`. A frozen reinstall
fixed it; nothing in the owned packages was at fault.

The publish proof's `quality:coverage` lane failed on the inherited
`@beep/repo-cli` `Quality.osv-ignore.ts` row that hosted `main` already fails
at `c156ca2b3c`; every other pre-push lane passed. The attribution receipt is
in `research/OPPORTUNITIES.md`, and the PR was pushed for hosted gating.
