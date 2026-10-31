# beep CLI composition Plan

## Status

Status: `in-progress`. P0 is complete: the design grill settled D1 to D20 on
2026-10-28 and an adversarial pass verified the package map
(`research/design-record.md`). Next are the gate fix lanes G1 to G4 and the W0
retirements; W1 waits for `goals/effected-promotion` to close (D16).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Measure the gate cost, map the coupling, grill the design, verify the package map. | D1 to D20 recorded; design record written. |
| P1 Implement | pending | Land the gate fixes and the waves below, one PR each. | Acceptance criteria in `SPEC.md` are met, or the checkpoint stops the program. |
| P2 Verify | pending | Re-run the edge classifier, the command-surface snapshot and the invalidation simulation. | Results recorded under `research/`. |
| P3 Yeet: PR to mergeable | pending | Drive every wave PR to mergeable through yeet. | Each PR merged with zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Wave sequence

Every PR keeps `main` green and the `beep` surface unchanged apart from D11.
Each runs `bun run beep quality package-verify` for every touched package,
`bun run beep lint package-scripts --write`, `bun run beep tsconfig-sync`, the
schema and instrumentation catalogs, the JSDoc ratchet and coverage rekeys,
and rewrites JSDoc example imports in the same change.

| Step | Content | Starts after |
| --- | --- | --- |
| G1 | Done 2026-10-31: parallel vitest projects for repo-cli; the 83 suites that need isolation (cwd changes, module mocks, global stubs) keep a fresh worker per file (D21). Local Bun run 1,512 s to 183 to 502 s (`research/g1-parallel-vitest.md`). | now |
| G2 | Shard the repo-cli coverage run (blob reports, merged lcov) or give it more workers. | now |
| G3 | Argv-first lazy dispatch with a static help manifest in `bin-main.ts` and `commands/Root.ts`, written so it moves to the composition app unchanged. | now |
| G4 | Per-task policy fingerprint from each command's import graph instead of the repo-cli package closure. | now |
| W0 | Retirements after zero-consumer checks: the D11 instruments plus the candidates the map found (`yeet pre-push-hook`, `plan-contract-check`, `fallow-fixture-check`, `goals migrate-conventions`, `goals repair-fork`, `lint goal-packets`, `docs aggregate`). Cache tier B was held for `goals/turborepo-cache-conformance`; recheck it now that that goal has closed. | now |
| W1 | In-package hygiene: a shared entry-path constant for the ten self paths, misfiled subcommands moved (tmpfs-reap and residue-reap under worktree, cache-policy under cache), the schema and engine splits, and the verifier's must-fix list below. Exit gate: zero library-to-tool edges. | effected-promotion close |
| W2 | Leaf libraries in parallel: `@beep/repo-utils` extensions, `@beep/ai-sync` (skills lock closure, model ids), `@beep/qa-capture` (QA inventory schemas). | W1 |
| W3 | `@beep/repo-cli-kit`: the repo-specific CLI helpers left after adopting `@beep/cli-kit`, plus the shared test kits. | W2 |
| W4 | `@beep/repo-run`. | W3 |
| W5 | `@beep/repo-github` and `@beep/repo-coverage`, in parallel. | W4 |
| W6 | `@beep/repo-gates`, with its `/proof` subpath (D17). | W5 |
| W7 | `@beep/repo-packets`. Exit gate: zero cross-tool command edges inside repo-cli. | W6 |
| Check | Re-measure with G1 to G4 in place and record a continue or stop row (D18). | W7 |
| W8 | The composition app: move the bin, dispatcher and manifest, with every route still pointing into repo-cli; repoint the root `beep` script. | Check |
| W9 | The five moved-out apps, in parallel, each with a forwarding route. | W8 |
| W10 | Rename `@beep/repo-docgen` to `@beep/beep-docgen` and absorb the Docgen group. | W8 |
| W11 | The six command tools, one PR each, merged one at a time because they share generated files: harness, workspace, goals, ci, quality, yeet. | W10 |
| W12 | Delete `@beep/repo-cli`: changeset ignore entry, CI partitions, coverage scope owner, `turbo.json`, identity composer, the `AGENTS.md` retire fallback path; remove the transitional doctrine notes. | W11 |

## Verifier must-fix list (W1)

The adversarial pass found these against `main` at 83e7243e9e; recheck each
against current `main` before starting W1.

1. Issue classification and parsing files used by the readiness model belong
   with the proof subpath, not in the yeet tool.
2. The capability graph mermaid, projection and schema trio belongs with the
   packet library, or the mermaid renderer is injected.
3. The docgen analysis subset of the Docgen schemas moves with the analysis
   code into `@beep/repo-utils`.
4. The whole skills-lock schema closure moves into `@beep/ai-sync`, not one
   symbol.
5. Every library file gets a library-owned error instead of
   `YeetCommandError`, and the duplicate `runGitOutput` in the Yeet internals
   is retired in favour of the run-layer one.
6. The Codex security packet file moves to the goals side to break the
   quality and goals cycle.
7. The knowledge semantic-delta probe reads both the old `commands/Root.ts`
   layout and the new manifest, including at historical commits.
8. `shellQuote` moves out of `@beep/repo-ai-metrics` so yeet does not pull in
   DuckDB and Phoenix.
9. The reference-links service is provided on the worktree route and fails
   closed when absent.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/beep-cli-composition/GOAL.md)" -le 4000
jq . goals/beep-cli-composition/ops/manifest.json
rg -n "beep-cli-composition|GOAL.md|agentLaunchers|packetAnchorDocument" goals/beep-cli-composition
git diff --check -- goals/beep-cli-composition
```
