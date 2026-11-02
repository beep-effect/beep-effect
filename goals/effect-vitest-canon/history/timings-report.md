# Timings report — effect-vitest-canon (2026-11-02)

The PLAN P3 deliverable: per-package before/after test durations, slowest-file
deltas and the hosted Coverage Regression percentile. Every number below is
derived from files in this packet or from GitHub Actions job records read on
2026-11-02; the derivation scripts are described inline so the tables can be
regenerated. Lane speed was measured, never promised (D1).

## 1. Scope and provenance

- **Before captures:** `ops/inventory/timings/baseline/*.json`, 128 packages,
  all captured 2026-09-11 (P1 census) with the `node-vitest` runner.
- **After captures:** `ops/inventory/timings/after/*.json`, 99 packages with
  `package`/`files` rows, captured 2026-09-24 to 2026-10-05 as each P2 wave
  closed (plus 28 raw Vitest summary files for the `-bun` variants, which carry
  no per-file rows and are not paired here).
- **Paired packages:** 95 (same `package` key in both directories). 33 baseline
  packages have no after capture (their waves recorded timing in the per-wave
  `*-batch-before` and `final/` directories or landed after the capture
  tooling stopped), and 4 after-only packages (`@beep/graph-3d`,
  `@beep/infra`, `@beep/ontology-client`, `@beep/qa-capture`) have no baseline
  row. Neither set is in the tables.
- **Hosted lane:** `Heavy / Coverage Regression` jobs of `check.yml` on `main`
  push runs, read with `gh api .../actions/workflows/check.yml/runs` and
  `.../runs/<id>/jobs`. `bun run beep ci lane-timings --window` refused the
  census ("Ruleset 10240248 version 54940515 is not a ratified admission
  population"), so the job records were read directly; see
  `research/OPPORTUNITIES.md` (2026-11-02).
- **Caveats:** before and after captures ran on the same workstation but
  weeks apart, on different Effect/Vitest cohorts (4.0.0/4.0.1 after versus
  the rc.113 census before) and with the test counts changed by the waves
  themselves (748 files before, 826 after, 738 common). The hosted lane also
  changed between the windows (coverage sharding, runner fleet), so the
  percentile drop is an observation about the lane, not an attribution to
  this goal alone.

## 2. Per-package totals (paired packages)

| Measure | Before (2026-09-11) | After (2026-09-24 to 2026-10-05) | Delta |
| --- | --- | --- | --- |
| Paired packages | 95 | 95 | — |
| Sum of `totalMs` | 1,684,535 ms | 1,440,201 ms | −14.5% |
| Packages faster / slower | — | 76 / 19 | — |

| Package | Before ms (2026-09-11) | After ms | After captured | Tests before → after | Delta |
| --- | --- | --- | --- | --- | --- |
| @beep/agents-client | 5,858 | 4,889 | 2026-09-27 | 23 → 23 | -17% |
| @beep/agents-domain | 5,802 | 4,756 | 2026-09-27 | 22 → 22 | -18% |
| @beep/agents-server | 6,621 | 4,156 | 2026-09-27 | 24 → 27 | -37% |
| @beep/agents-tables | 6,292 | 3,872 | 2026-09-27 | 5 → 6 | -38% |
| @beep/agents-use-cases | 4,493 | 4,926 | 2026-09-27 | 33 → 33 | +10% |
| @beep/api-docs | 3,766 | 3,631 | 2026-09-28 | 5 → 5 | -4% |
| @beep/architecture-lab-client | 4,269 | 3,910 | 2026-09-27 | 2 → 2 | -8% |
| @beep/architecture-lab-domain | 7,652 | 3,905 | 2026-09-27 | 8 → 17 | -49% |
| @beep/architecture-lab-proof | 7,123 | 4,107 | 2026-09-27 | 2 → 2 | -42% |
| @beep/architecture-lab-server | 5,993 | 5,823 | 2026-09-27 | 8 → 8 | -3% |
| @beep/architecture-lab-tables | 6,388 | 5,006 | 2026-09-27 | 4 → 4 | -22% |
| @beep/architecture-lab-ui | 6,032 | 3,734 | 2026-09-27 | 6 → 7 | -38% |
| @beep/architecture-lab-use-cases | 5,594 | 4,040 | 2026-09-27 | 13 → 26 | -28% |
| @beep/box | 7,116 | 3,861 | 2026-09-28 | 28 → 40 | -46% |
| @beep/box-provisioning | 4,142 | 4,571 | 2026-09-28 | 53 → 104 | +10% |
| @beep/codegen-kit | 4,166 | 3,390 | 2026-09-25 | 17 → 17 | -19% |
| @beep/colors | 3,654 | 2,939 | 2026-09-25 | 15 → 15 | -20% |
| @beep/cosmos | 3,656 | 5,948 | 2026-09-25 | 7 → 8 | +63% |
| @beep/data | 703 | 329 | 2026-09-25 | 34 → 34 | -53% |
| @beep/db-admin | 12,844 | 11,194 | 2026-09-28 | 22 → 22 | -13% |
| @beep/doc-text | 5,256 | 2,914 | 2026-09-27 | 9 → 9 | -45% |
| @beep/dock | 4,578 | 3,536 | 2026-09-27 | 112 → 112 | -23% |
| @beep/dock-react | 5,640 | 4,442 | 2026-09-27 | 30 → 30 | -21% |
| @beep/documents-domain | 10,778 | 3,116 | 2026-09-27 | 27 → 27 | -71% |
| @beep/documents-server | 6,612 | 5,686 | 2026-09-28 | 94 → 97 | -14% |
| @beep/documents-tables | 4,520 | 4,182 | 2026-09-27 | 17 → 21 | -7% |
| @beep/documents-use-cases | 4,834 | 4,134 | 2026-09-27 | 37 → 37 | -14% |
| @beep/ecfr | 3,872 | 4,401 | 2026-09-27 | 10 → 10 | +14% |
| @beep/editor | 11,465 | 9,530 | 2026-09-27 | 447 → 450 | -17% |
| @beep/epistemic-client | 4,591 | 4,968 | 2026-09-28 | 17 → 17 | +8% |
| @beep/epistemic-config | 4,011 | 5,100 | 2026-09-28 | 10 → 20 | +27% |
| @beep/epistemic-domain | 13,225 | 5,277 | 2026-09-27 | 82 → 94 | -60% |
| @beep/epistemic-server | 7,509 | 4,046 | 2026-09-28 | 83 → 38 | -46% |
| @beep/epistemic-tables | 5,137 | 4,071 | 2026-09-27 | 39 → 50 | -21% |
| @beep/epistemic-ui | 8,019 | 5,367 | 2026-09-28 | 13 → 19 | -33% |
| @beep/epistemic-use-cases | 4,538 | 6,640 | 2026-09-28 | 43 → 50 | +46% |
| @beep/fc-runs | 408 | 443 | 2026-09-25 | 8 → 8 | +9% |
| @beep/ffmpeg | 17,747 | 3,723 | 2026-09-27 | 45 → 46 | -79% |
| @beep/file-processing | 5,404 | 3,109 | 2026-09-27 | 27 → 27 | -42% |
| @beep/gov-legal-mcp | 16,954 | 4,925 | 2026-09-27 | 18 → 32 | -71% |
| @beep/govinfo | 5,173 | 4,741 | 2026-09-27 | 8 → 8 | -8% |
| @beep/identity | 682 | 1,144 | 2026-09-24 | 110 → 115 | +68% |
| @beep/langextract | 5,572 | 4,690 | 2026-09-27 | 97 → 98 | -16% |
| @beep/law-practice-domain | 27,096 | 3,538 | 2026-09-27 | 69 → 69 | -87% |
| @beep/law-practice-server | 16,713 | 15,926 | 2026-09-28 | 72 → 87 | -5% |
| @beep/law-practice-tables | 4,900 | 4,714 | 2026-09-27 | 45 → 45 | -4% |
| @beep/law-practice-use-cases | 6,546 | 6,456 | 2026-09-28 | 60 → 70 | -1% |
| @beep/lejeune-bolt-workbench | 10,622 | 11,735 | 2026-09-28 | 28 → 28 | +10% |
| @beep/lexical-schema | 19,793 | 4,232 | 2026-09-27 | 71 → 71 | -79% |
| @beep/libpff | 22,209 | 5,619 | 2026-09-27 | 69 → 69 | -75% |
| @beep/lint-rules | 20,905 | 13,080 | 2026-09-27 | 66 → 80 | -37% |
| @beep/m365-mcp | 5,431 | 3,008 | 2026-09-27 | 6 → 23 | -45% |
| @beep/n3 | 3,547 | 3,527 | 2026-09-27 | 6 → 6 | -1% |
| @beep/nlp-mcp | 4,233 | 4,304 | 2026-09-27 | 37 → 37 | +2% |
| @beep/nlp-processing | 5,256 | 4,058 | 2026-09-27 | 84 → 84 | -23% |
| @beep/obs | 3,614 | 4,072 | 2026-09-25 | 20 → 21 | +13% |
| @beep/oip-web | 5,934 | 4,935 | 2026-09-27 | 54 → 57 | -17% |
| @beep/onepassword-cli | 16,425 | 3,718 | 2026-09-27 | 6 → 7 | -77% |
| @beep/ontology | 4,989 | 3,732 | 2026-09-27 | 70 → 70 | -25% |
| @beep/ontology-config | 393 | 274 | 2026-09-25 | 6 → 6 | -30% |
| @beep/ontology-domain | 529 | 535 | 2026-09-27 | 8 → 8 | +1% |
| @beep/ontology-server | 5,278 | 5,975 | 2026-09-28 | 26 → 28 | +13% |
| @beep/ontology-ui | 7,064 | 6,075 | 2026-09-28 | 9 → 9 | -14% |
| @beep/ontology-use-cases | 4,650 | 4,519 | 2026-09-27 | 59 → 61 | -3% |
| @beep/openclaw | 9,611 | 15,215 | 2026-09-27 | 65 → 67 | +58% |
| @beep/oxigraph | 16,695 | 3,468 | 2026-09-27 | 3 → 3 | -79% |
| @beep/pacer | 4,216 | 3,687 | 2026-09-28 | 23 → 26 | -13% |
| @beep/pandoc-ast | 17,465 | 3,965 | 2026-09-27 | 97 → 97 | -77% |
| @beep/pglite | 5,038 | 5,063 | 2026-09-25 | 8 → 9 | +1% |
| @beep/phoenix | 5,872 | 3,827 | 2026-09-27 | 9 → 30 | -35% |
| @beep/practice-kg-mcp | 7,928 | 4,197 | 2026-09-28 | 6 → 12 | -47% |
| @beep/pretext | 4,877 | 3,516 | 2026-09-27 | 25 → 25 | -28% |
| @beep/rdf | 5,271 | 4,155 | 2026-09-27 | 89 → 104 | -21% |
| @beep/rdf-canonize | 12,401 | 3,601 | 2026-09-27 | 7 → 7 | -71% |
| @beep/repo-ai-metrics | 19,815 | 12,394 | 2026-09-27 | 333 → 390 | -37% |
| @beep/repo-cli | 915,025 | 973,604 | 2026-10-05 | 3748 → 5264 | +6% |
| @beep/repo-docgen | 9,948 | 6,617 | 2026-09-27 | 100 → 107 | -33% |
| @beep/schema | 5,966 | 5,226 | 2026-09-25 | 717 → 725 | -12% |
| @beep/semantic-web | 3,919 | 3,788 | 2026-09-27 | 31 → 31 | -3% |
| @beep/semantica | 11,969 | 11,833 | 2026-09-28 | 131 → 133 | -1% |
| @beep/shacl | 5,837 | 3,665 | 2026-09-27 | 4 → 4 | -37% |
| @beep/shared-tables | 6,511 | 3,871 | 2026-09-27 | 4 → 4 | -41% |
| @beep/skill-contract | 6,968 | 4,398 | 2026-09-27 | 46 → 47 | -37% |
| @beep/tailscale | 3,662 | 3,808 | 2026-09-25 | 19 → 20 | +4% |
| @beep/test-utils | 88,029 | 19,874 | 2026-09-25 | 285 → 255 | -77% |
| @beep/tika | 6,817 | 3,059 | 2026-09-27 | 70 → 70 | -55% |
| @beep/trustgraph-workbench | 4,872 | 3,833 | 2026-09-27 | 2 → 2 | -21% |
| @beep/ui | 4,547 | 3,775 | 2026-09-27 | 47 → 52 | -17% |
| @beep/uspto-mcp | 5,568 | 3,799 | 2026-09-28 | 11 → 41 | -32% |
| @beep/utils | 1,711 | 503 | 2026-09-25 | 178 → 189 | -71% |
| @beep/wink | 7,002 | 4,502 | 2026-09-27 | 47 → 48 | -36% |
| @beep/workspace-domain | 6,290 | 3,118 | 2026-09-27 | 12 → 26 | -50% |
| @beep/workspace-server | 7,716 | 5,490 | 2026-09-27 | 27 → 28 | -29% |
| @beep/workspace-tables | 4,149 | 4,136 | 2026-09-27 | 7 → 8 | -0% |
| @beep/workspace-use-cases | 4,027 | 5,007 | 2026-09-27 | 13 → 24 | +24% |

## 3. Slowest files

The fifteen slowest test files in the before capture (among the 738 files present in
both captures), with their after duration:

| Test file | Before ms | After ms | Delta |
| --- | --- | --- | --- |
| `packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` | 86,589 | 19,258 | -78% |
| `packages/tooling/tool/cli/test/lint-workers.test.ts` | 22,118 | 21,727 | -2% |
| `packages/tooling/policy-pack/lint-rules/test/oxlint-rules.test.ts` | 19,304 | 12,678 | -34% |
| `packages/tooling/tool/cli/test/quality-scheduler.test.ts` | 16,862 | 16,608 | -2% |
| `packages/tooling/tool/cli/test/native-runtime-prefix.test.ts` | 15,319 | 12,566 | -18% |
| `packages/tooling/tool/cli/test/corpus-command.test.ts` | 14,738 | 13,845 | -6% |
| `packages/tooling/tool/cli/test/yeet.test.ts` | 13,505 | 13,383 | -1% |
| `packages/tooling/library/ai-metrics/test/ingest.test.ts` | 9,906 | 6,530 | -34% |
| `packages/law-practice/server/test/PracticeKg.projections.test.ts` | 9,326 | 10,262 | +10% |
| `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts` | 8,967 | 7,428 | -17% |
| `packages/tooling/tool/cli/test/ai-metrics-command.test.ts` | 8,295 | 3,850 | -54% |
| `packages/tooling/tool/cli/test/tmpfs-reap.test.ts` | 7,365 | 8,323 | +13% |
| `packages/tooling/test-kit/test-utils/test/integration/SqlTest.pglite.test.ts` | 6,984 | 3,633 | -48% |
| `apps/labs/semantica/test/Reasoning.test.ts` | 6,738 | 7,029 | +4% |
| `apps/labs/lejeune-bolt-workbench/test/Bundle.test.ts` | 6,406 | 6,844 | +7% |

Largest absolute moves in either direction (eight each):

| Test file | Before ms | After ms | Delta ms |
| --- | --- | --- | --- |
| `packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` | 86,589 | 19,258 | -67,331 |
| `packages/tooling/policy-pack/lint-rules/test/oxlint-rules.test.ts` | 19,304 | 12,678 | -6,626 |
| `packages/tooling/tool/cli/test/ai-metrics-command.test.ts` | 8,295 | 3,850 | -4,444 |
| `packages/tooling/library/ai-metrics/test/ingest.test.ts` | 9,906 | 6,530 | -3,376 |
| `packages/tooling/test-kit/test-utils/test/integration/SqlTest.pglite.test.ts` | 6,984 | 3,633 | -3,351 |
| `packages/tooling/tool/cli/test/native-runtime-prefix.test.ts` | 15,319 | 12,566 | -2,753 |
| `packages/tooling/tool/cli/test/create-package-lab.test.ts` | 2,767 | 624 | -2,143 |
| `packages/drivers/libpff/test/Libpff.pffexport.test.ts` | 3,819 | 1,749 | -2,070 |
| `packages/tooling/tool/cli/test/worktree-fleet.test.ts` | 5 | 1,711 | +1,706 |
| `packages/tooling/library/ai-metrics/test/archive.test.ts` | 50 | 2,980 | +2,929 |
| `packages/tooling/tool/cli/test/quality-tasks.test.ts` | 3,178 | 6,611 | +3,433 |
| `packages/tooling/tool/cli/test/worktree-command.test.ts` | 3,026 | 7,842 | +4,815 |
| `packages/tooling/tool/cli/test/agent-effectiveness-eval-scorer.test.ts` | 1,333 | 7,495 | +6,162 |
| `packages/tooling/tool/cli/test/cache-pilot-orchestration.test.ts` | 1,392 | 8,151 | +6,760 |
| `packages/tooling/tool/cli/test/yeet-monitor-check-registration.test.ts` | 96 | 10,095 | +10,000 |
| `packages/tooling/tool/cli/test/doctest-lane.test.ts` | 1,572 | 44,590 | +43,018 |

## 4. Hosted Coverage Regression percentile

`Heavy / Coverage Regression` on `main` push runs of `check.yml`, successful
jobs only, duration = `completed_at − started_at`:

| Window (UTC) | Runs | Jobs | Successful | Median | p95 | Max |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-04 to 2026-09-11 (P1 census week, before the first wave) | 93 | 69 | 59 | 1,616 s | 1,854 s | 1,900 s |
| 2026-10-26 to 2026-11-02 (waves 16–21 and the day after wave 21) | 225 | 94 | 68 | 554 s | 617 s | 762 s |

One 2026-11-01 record (`bb2134fcb9`) reports `completed_at` before `started_at`
and is excluded; 24 failures and 1 cancelled job in the later window are the
inherited S11 reds of 2026-10-31/11-01 and are not durations of a passing lane.

The last migration wave (#1875 w21, #2463) merged on 2026-11-01, so the full
"following week" after it ends 2026-11-08. The week measured here is the week in
which waves 16 to 21 landed; the closeout is scoped to this window by the
2026-11-02 Decision Log row in `SPEC.md` section 9. Re-running the two `gh api`
reads for 2026-11-01 to 2026-11-08 extends the table without changing the
packet.

## 5. Regeneration

1. Pair `ops/inventory/timings/baseline/*.json` with `after/*.json` on the
   `package` key; sum `totalMs`, and join `files[]` on `file` for the per-file
   deltas.
2. List `check.yml` runs on `main` (`event=push`, `status=completed`) for the
   window, then read each run's jobs and keep the job named
   `Heavy / Coverage Regression`; take successful jobs with a positive duration
   and compute the median and the linear-interpolated p95.
