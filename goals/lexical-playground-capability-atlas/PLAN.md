# Lexical Playground Capability Atlas Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Normalize live/source evidence into stable atlas entries; reconcile all registrations and activation paths; lock the minimal descriptor contract. | Atlas has no unexplained features, compatibility gaps are explicit, and descriptor fields are justified by entries rather than speculation. |
| P1 Implement | pending | Add the `@beep/editor` schemas/resolver/command projection, compatibility defaults, Storybook profiles, and synthetic dock panel. | All implementation acceptance criteria and focused tests pass without new document semantics or product persistence. |
| P2 Verify | pending | Run package/app proof and the recorded browser QA loop across keyboard, pointer, responsive/touch, and accessibility scenarios. | Targeted proof and full `bun run beep yeet verify` are green; QA inventory has zero required findings. |
| P3 Yeet: PR to mergeable | pending | Publish intentionally through Yeet and close exact-head hosted checks and review threads. | PR is mergeable with required hosted checks and reviews green. |
| P4 Close | pending | Record final evidence, reflection, packet lifecycle, and Goal B handoff. | Closeout reflection validates; atlas/profile handoff is durable; packet and index are updated in the final PR. |

## P0 Research Checklist

- [x] Read the exploration `CAPTURE`, `RESEARCH`, `DECISIONS`, `BRIEF`, `MAP`,
   both detailed audits, and `research/SOURCES.md`.
- [x] Verify the local Lexical checkout still resolves to pinned commit `a933222`.
   If it moved, audit the pinned commit or explicitly version a new evidence set.
- [x] Create the normative authored `research/capability-atlas.json`
   (`editor-capability-atlas/v1`), `ops/CapabilityAtlas.schemas.ts`, and the
   exact `ops/verify-capability-atlas.ts` verifier named by `SPEC.md`.
- [x] Reconcile root nodes, effective nodes, top-level extensions/plugins,
   settings/query flags, transformers, toolbar/slash/context activation paths,
   document actions, imports/exports, and keybindings.
- [x] Give every entry a disposition, owner, target goal, compatibility row,
   read-only fallback, accessibility/responsive contract, and evidence link.
- [x] Derive the smallest public capability/profile schema from the reconciled
   atlas; record alternatives and migration of current `ComposerFeatures`.
- [x] Exercise every production-eligible user-visible capability and activation
   path through its applicable lifecycle with screenshot/interaction evidence.
   Close every current unverified item or obtain a user-approved, owner-backed
   waiver in the Exception Ledger.
- [x] Stop for user direction if any feature needs a new product/security decision.

## P1 Implementation Checklist

1. Introduce named schemas and derived types for capability IDs, descriptors,
   profiles, commands/bindings, dispositions, and typed resolution errors.
2. Implement deterministic dependency/conflict/keybinding resolution.
3. Project registrations, commands, affordances, and generated help from the
   resolved profile; adapt current fixed behavior through defaults.
4. Add minimal and `document-proof` Storybook fixtures over the same canonical
   `@beep/md` document.
5. Register the synthetic Professional Desktop panel through the existing
   panel registry and dock model; keep it local/synthetic and box-filling.
6. Add focused runtime, schema encode/decode, resolver, and command tests; run
   the editor package's existing `check` and `test` scripts. Do not recreate
   dtslint/tstyche; add a new compile-only regression proof only if an actual
   type-level regression demonstrates the need for one.
7. Document the contract, profile ownership, remount behavior, and Goal B
   consumption path.

## P2 Browser QA Scenarios

- Open the synthetic panel through the real dock UI and prove it fills its box.
- Exercise every exposed command with mouse and keyboard; verify shortcut help
  exactly matches the resolved command set.
- Compare minimal and `document-proof` profiles; verify supported existing
  content stays readable while disabled authoring controls disappear.
- Verify keyboard focus order, focus restoration, accessible names/roles,
  conflict-free bindings, and no unlabeled icon/color controls.
- Verify a narrow viewport and a touch-accessible alternative for overflow and
  hover-only controls.
- Confirm no document open causes remote network egress.
- Re-run the upstream-reference exercise matrix until every user-visible atlas
  entry has evidence or an approved waiver; the initial 17 images are seeds,
  not the final completeness set.

## P3/P4 Closeout Checklist

1. Use the canonical Yeet flow: repair, verify, publish with an intentional
   message, then monitor exact-head checks and review threads to mergeable.
2. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` using the `/reflect`
   skill and validate it with `bun run beep lint reflection-artifacts`.
3. Store the final atlas reconciliation, targeted verification, browser QA
   inventory/artifact paths, and hosted closeout under `history/`.
4. Update `README.md`, this plan, and `ops/manifest.json` in the same final PR.
5. Create or refresh the `configurable-full-document-editor` packet from the
   ratified atlas; do not expand Goal A to implement parity.
6. Synchronize the Notion initiative with the final atlas/screenshot index,
   decisions, packet status, and repo evidence links without duplicating the
   normative spec.

## Execution Notes

- 2026-08-24: P0 completed with the authored
  `editor-capability-atlas/v1`, its Effect v4 schemas, the exact verifier, and
  the approved Exception Ledger. The final evidence states are 154
  `verified-live`, 14 `verified-source`, and 10 `unverified` with user-approved
  waivers. The exercise harness has been hermetic since PR #793, and the user
  approved the 10-row ledger on 2026-08-24. The verifier reconciles 38 root
  nodes, 41 effective rich-text nodes, 29 settings, 73 top-level registrations,
  including query overrides, 23 Markdown transformers, 32 observed
  keybindings, 11 document actions, and 17 screenshots.
- Preserve unrelated worktree changes and inspect current state before edits.
- Use live source/barrel discovery; do not use the retired export catalog.
- Keep `SPEC.md` normative. Record new user decisions in the source
  exploration before changing the contract.
- Upstream reference screenshots are research evidence, not local acceptance
  proof. Local QA artifacts belong under this packet's `history/`.
- Attribute verification failures as introduced, inherited, unrelated, or
  environment-only before repairing.

## Verification Commands

```sh
test "$(wc -m < goals/lexical-playground-capability-atlas/GOAL.md)" -le 4000
jq . goals/lexical-playground-capability-atlas/ops/manifest.json
rg -n "lexical-playground-capability-atlas|GOAL.md|agentLaunchers|packetAnchorDocument" goals/lexical-playground-capability-atlas
git diff --check -- goals/lexical-playground-capability-atlas explorations/full-document-editor
bun run goals/lexical-playground-capability-atlas/ops/verify-capability-atlas.ts
bun run --cwd packages/foundation/ui-system/editor check
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
