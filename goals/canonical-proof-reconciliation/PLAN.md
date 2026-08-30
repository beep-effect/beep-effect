# Canonical Proof Reconciliation Plan

## Status

Status: `pending` — blocked on `architecture/slice-audit` from
[`goals/slice-topology-audit`](../slice-topology-audit/README.md).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm the audit baseline exists on `main`; read `architecture.audit-baseline.jsonc` to fix the slice order; enumerate the lab's manifest paths and the 7 `.rpc.ts` files; design the `Contract` kit (schema → service → impl) and the codemod contract. | Slice order, kit design, and codemod plan recorded; the proof's finding list matches exploration `synthesis/15` §2. |
| P1 Implement | pending | PR-1 manifest + lab (+ `Contract` kit, `TemplateRetarget` shrink, fixtures); then PR-2..PR-8 one per slice, each a codemod + `audit --write-baseline`. | Each PR's acceptance rows in `SPEC.md` are met; baseline strictly shrinks per PR. |
| P2 Verify | pending | Per PR: `audit` delta, v1 replay test, `package-verify` for touched packages, `docgen:local`; golden-diff tests for every codemod. | Evidence recorded under `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish each PR through yeet and drive it to mergeable: required checks green, every review thread answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads; `merge-ready: yes`. |
| P4 Close | pending | Write the closeout reflection; flip packet state; leftovers named in `follow_ups` with owners. | Packet status and evidence are updated; a closeout reflection exists. |

## Sequencing notes

- PR-1 before any slice PR: `add concept` must stop propagating drift first.
- Slice order is by descending baseline count (exploration estimate:
  epistemic, law-practice, documents, workspace, ontology, agents, shared,
  architecture-lab leftovers); re-derive it from the real baseline in P0.
- Member renames and deep-import rewrites are one codemod, one PR; never
  split symbol and consumers.
- The `move concept --kind` helper is written only when the first
  reclassification appears; until then it stays NET-NEW.
- Record friction receipts in the exploration's ledger as they happen.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. Confirm every `follow_ups` row has an owner and a note.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Exploration packet: [`explorations/v3-consistency-audit`](../../explorations/v3-consistency-audit/README.md) — `synthesis/15`
  (proof divergences), `synthesis/22` BN-20–BN-24 (member + contract
  evidence), `synthesis/40` R3, R6a, R6b, R12 (mechanisms), `DECISIONS.md`
  *namespace member vocabulary* (the member table).

## Verification Commands

```sh
test "$(wc -m < goals/canonical-proof-reconciliation/GOAL.md)" -le 4000
jq . goals/canonical-proof-reconciliation/ops/manifest.json
rg -n "canonical-proof-reconciliation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/canonical-proof-reconciliation
git diff --check -- goals/canonical-proof-reconciliation
bun run beep architecture audit --slice architecture-lab --json
```
