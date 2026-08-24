# Configurable Full Document Editor Plan

## Status

Status: `paused`

All phases remain pending. Goal B is authored but not started.

## Resume gate

Resume only when `goals/lexical-playground-capability-atlas` satisfies its
completion gate and delivers the ratified atlas/profile contract. P0 begins by
refreshing this packet from that contract and enumerating all semantic batches.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Refresh the packet from Goal A's delivered atlas/profile contract and enumerate every semantic batch and covered atlas ID. | The packet is refreshed from the ratified atlas, and the complete semantic-batch map is ratified by the user. |
| P1 Implement | pending | Implement the ratified batches behind the registry, including required canonical schemas, wire codecs, mechanics, projections, compatibility defaults, and focused proof. | Every D13-eligible atlas entry is implemented or has a user-approved, successor-owned exception; focused batch checks pass. |
| P2 Verify | pending | Run projection, package, app, Storybook, accessibility, and recorded browser QA proof across the completed batch set. | Targeted proof and `bun run beep yeet verify` are green; QA inventory has zero required findings. |
| P3 Yeet: PR to mergeable | pending | Publish intentionally through Yeet and close exact-head hosted checks and every review thread. | Yeet reports `merge-ready: yes`; required checks are green and unresolved review threads are zero. |
| P4 Close | pending | Record final evidence, reflection, packet lifecycle, and successor routing without scaffolding gated work. | Closeout reflection validates; packet status and evidence are updated in the final PR. |

## P0 Research checklist

1. Confirm Goal A's completion gate is satisfied and read its final SPEC, atlas,
   profile schemas/resolver contract, compatibility matrix, exceptions, and
   closeout evidence.
2. Refresh Goal B's source anchors against current live packages, barrels,
   tests, Storybook, and Professional Desktop registration seams.
3. Enumerate every production-eligible single-user atlas ID into semantic
   batches. For each batch, name document identity, schema ownership, Lexical
   wire/codec work, authoring paths, read-only fallback, projection behavior,
   accessibility proof, migration needs, and focused commands.
4. Reconcile the batch map against D13. Diagnostics and the seven gated MAP
   successors remain explicitly classified but outside Goal B.
5. Record any unavoidable exception in `SPEC.md` with exact atlas IDs,
   rationale, owner, and removal condition.
6. Present the complete batch order and verification matrix to the user. Do not
   begin P1 until the user ratifies them.

## P1 Implementation protocol

1. Land semantic batches in the ratified dependency order; keep each batch
   focused and independently testable.
2. Add or extend named `@beep/md` schemas before projections. Derive types and
   guards from the schemas and preserve versioned migration behavior.
3. Extend `@beep/lexical-schema` wire models, normalization, and bidirectional
   codecs with explicit loss behavior for the batch.
4. Register nodes, commands, activation paths, bindings, help, and read-only
   behavior through Goal A's resolved capability contract.
5. Keep remote media network-inert, private content out of URLs, and product
   identity/lifecycle outside foundation packages.
6. Add focused schema, codec, resolver, command, component, and regression
   tests plus Storybook fixtures for each batch.
7. Update packet evidence and the compatibility matrix as each batch closes.

## P2 Verification scenarios

- Decode, encode, normalize, and round-trip every new canonical and wire
  semantic across every applicable projection.
- Exercise each authoring mechanic through create, edit, select, undo, redo,
  copy, paste, serialize, reopen, and delete where applicable.
- Verify controls, slash/typeahead entries, shortcuts, keybindings, paste/drop,
  importers, registrations, and generated help agree with the resolved profile.
- Open richer documents under narrower profiles and prove supported content
  remains readable and lossless through the declared fallback.
- Prove keyboard-only use, focus order/restoration, semantic labels, responsive
  layout, and touch alternatives through the recorded browser QA loop.
- Confirm document open causes no unauthorized network egress and no private
  payload enters URLs.
- Reconcile the final implementation against every D13-eligible atlas ID and
  every approved exception.

## P3/P4 closeout checklist

1. Run Yeet repair and verify, publish with an intentional message, then monitor
   exact-head checks and review threads until `merge-ready: yes`.
2. Write `history/reflections/closeout-date-agent.md` using the `/reflect` skill
   and validate it with `bun run beep lint reflection-artifacts`.
3. Store the final batch reconciliation, targeted verification, browser QA
   inventory paths, migration evidence, and hosted closeout under `history/`.
4. Update `README.md`, this plan, and `ops/manifest.json` in the same final PR.
5. Route fired successor gates back through
   `explorations/full-document-editor` at `decompose`; do not scaffold from an
   old MAP row.

## Execution Notes

- Preserve unrelated worktree changes and inspect current state before edits.
- Use live source/barrel discovery and the delivered atlas; do not infer parity
  from toolbar screenshots or a feature count.
- Keep `SPEC.md` normative. Record new user decisions in the source exploration
  before changing the contract.
- Attribute failures as introduced, inherited, unrelated, or environment-only
  before repairing.

## Verification Commands

```sh
test "$(wc -m < goals/configurable-full-document-editor/GOAL.md)" -le 4000
jq . goals/configurable-full-document-editor/ops/manifest.json
rg -n "configurable-full-document-editor|GOAL.md|agentLaunchers|packetAnchorDocument" goals/configurable-full-document-editor
git diff --check -- goals/configurable-full-document-editor explorations/full-document-editor
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
