# worktree-idle-reading

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/2. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `IdleReading` at `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts:90`,
with members `failed`, `hours`.
Storage/exposure: derived/internal; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-idle-reading.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

Private IdleReading at Reap.service.ts:88-91 has hours:Option<number> and failed:boolean. readIdleHours:198-233 probes latest commit seconds and the HEAD-file path, then stat mtime, takes their newest timestamp and clamps negative age to zero. Every failed command/parse/stat branch213,218,228 returns None/true; success232 returns Some(hours)/false. Incoming NUL listing failure occurs before assessments at636-643 and does not add a private reading case.

# Cardinality gap

Four representable tuples, two legal: failed(true,None) and measured(false,Some(hours)). Zero is measured success. E3 pairs failure with absence; E2 at365-375 selects the failure warning before reading hours. Magnitude of a required successful number is payload, not an axis.

# Target schema

Use named annotated schema classes for payload-bearing cases, a LiteralKit for each finite discriminator domain, and schema-derived matching through `S.toTaggedUnion`. Keep schemas in the existing owner module and preserve complete payload types. Exact local Effect v4 references: `.repos/effect/packages/effect/SCHEMA.md:3135-3163`, `src/Schema.ts:5366-5390` (`decodeTo`), `:6105` (`toTaggedUnion`), `:1868` (`encodeUnknownEffect`), `:12848-12851` (`OptionFromNullOr`), and `src/SchemaTransformation.ts:333-340` (fallible bidirectional transformations). The local reference hashes are in the impact receipt; these API references are separate from corpus source pins.

Use private annotated LiteralKit-backed cases failed and measured({hours:number}) in Reap.service.ts, with schema-derived Type and matching. Preserve the existing number contract and producer arithmetic; do not add an unproved integer/positive restriction. Keep public candidate idleHours on its current OptionFromNullOr(S.Finite) boundary.

# Migration inventory

- Reap.service.ts:88-91,198-233: replace all four return sites and preserve probe ordering, trimming/parsing, stat/mtime Option flow, newest timestamp, nonnegative clamp and Duration.toHours.
- Reap.service.ts:332-375: match failure to the exact idle-probe-failed skip/warning370; measured creates the existing probed EvidenceProbe with idleHours:Some(hours). Keep earlier GitHub and Git failure precedence.
- Reap.service.ts:378-389,441-479: preserve age threshold comparison, first skip priority, liveness prober input and candidate payload projection. No redesign of EvidenceProbe or candidate fields is required by this record.
- Reap.service.ts:636-643 retains --porcelain -z, effectful parsing and typed command error before candidate work. Reap.service assess/apply and removal safety are downstream preserved dependencies.
- Reap.schemas.ts:123-137 preserves all candidate fields; Reap.command.ts:29-32 renders hours and21,122-123 schema-encodes the report. Worktree/index.ts:27,34,41 exposes public report/workflow; private reading stays private.
- worktree-reap.test.ts retains idle/young/missing evidence, warning, recheck and size behavior; its incoming fixture69-72 uses repo-worktrees to satisfy removal's managed-root check.

# Guard-deletion accounting

Delete failed and the private Option hours pairing. Replace the idle.failed branch with one case match and the successful Option read with the measured payload. Keep every external command/parse/stat failure branch, nonnegative clamp, eligibility threshold, warning and target-security check. No standalone coherence validator exists to delete.

# Encoded-side impact

Tier 1 internal. No IdleReading serialization. Public candidate idleHours encodes explicit null for missing and the exact finite number for measured, including0; keys and worktree-reap/v1 remain unchanged. Keep the existing warning and human one-decimal formatting.

# Test impact

At implementation time cover each command/parse/stat failure, zero/positive hours, future timestamp clamp, newest commit versus HEAD mtime, exact warning and too-young threshold. Verify the full schema-encoded candidate/report and preserve incoming NUL-parser command failure. Use the public reaper seam and required CLI package verification; no tests ran in this P2 task.

# Risk

Do not convert zero to failure or introduce a second optional measurement phase. Keep clock selection and first-failure ordering. Land in Tier 1E with serial Reap.service changes; candidate-retirement remains a separate Tier 2 singleton and independent P3 is pending.
