# codex-findings-packet-commit-kind

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/2. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `writePacket.commitKind` at `packages/tooling/tool/cli/src/commands/Codex/Findings.write.ts:297`,
with members `exists`, `replacing`.
Storage/exposure: derived/internal; target: literalkit.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/codex-findings-packet-commit-kind.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

## Current shape

`writePacket` probes whether the destination exists. An existing destination
without force returns the typed `packet-exists` refusal before document scan or
staging. The surviving commit path later derives `replacing` as
`force === true && exists`; because the refusal has already removed the
existing/non-force path, that conjunction is equivalent to `exists` there.

The replacement bit controls moving the old packet aside, restoring it if
promotion fails, and deleting the backup after promotion. A new packet skips
all three actions. The separate `dryRun` return occurs before staging and before
the commit-kind local; it is an independent write policy.

## Cardinality gap

At the actual observation point where both locals coexist, two booleans expose
four pairs and exactly two are reachable:

| exists | replacing | commit kind |
| --- | --- | --- |
| false | false | create |
| true | true | replace |

False/true is impossible by construction. True/false belongs only to the
earlier refusal path and never reaches the `replacing` declaration. The raw
Round 26 count of 4/3 incorrectly combined that earlier control-flow outcome
with the later local pair. Refusal remains a supported function outcome, but it
is not a third value of this commit carrier.

## Target schema

Define a private `PacketCommitKind = LiteralKit(["create", "replace"])` in
`Findings.write.ts`. After the existing refusal, content scan, dry-run return,
and staging setup, select `replace` when the already-probed destination exists
and `create` otherwise. Use the LiteralKit-derived guard for the three backup
operations.

Do not absorb `force` or `dryRun` into this schema. They are function policy
inputs outside this local carrier. Do not add a `refuse` literal because that
path exits before commit staging and has no `replacing` value.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Codex/Findings.write.ts:17` — reuse
  the existing `LiteralKit` import and keep the owner private to this module.
- `Findings.write.ts:222-256` — preserve the public function options, optional
  force behavior, existence error mapping, refusal precedence, and exact error
  reason/message.
- `Findings.write.ts:258-277` — preserve content scanning before dry-run,
  no-write dry-run results, temporary-directory location, and staging errors.
  The incoming scanner refinement at163-170 suppresses spreadsheet-formula hits
  for .md documents only; imported CSV still receives its full upstream scan,
  other private-content hits still refuse, and report-policy documents retain
  their existing reporting behavior. Do not restore the old Markdown refusal
  or bypass scanning on dry run.
- `Findings.write.ts:279-341` — replace `replacing` with `commitKind`, then use
  the replace guard for move-aside, restore-on-promotion-failure, and final
  backup cleanup. Preserve staging/promotion order and exact return payload.
- `packages/tooling/tool/cli/src/commands/Codex/Findings.command.ts:272-280` —
  no shape change; retain the sole production call and its independently
  copied required dryRun/force values. This real request object is a separate
  D1 owner. The excluded anonymous callee parameter is not a census owner.
- `packages/tooling/tool/cli/test/codex-findings-write.test.ts:43-127,179-278,357-378`
  — retain create, refusal, replacement, forced precommit failure, dry-run, and
  symlink-destination behavior.
- `packages/tooling/tool/cli/test/codex-findings-refresh.test.ts:19,153` — no
  API change; retain the direct test helper call.

Targeted source and barrel search found no other reader of `replacing` and no
other writer of this local commit decision.

## Guard-deletion accounting

Delete `const replacing = options.force === true && exists` and its three
Boolean guards at lines 300, 316, and 328. Replace them with one literal
selection and the derived `replace` guard. Keep the earlier
`exists && force !== true` refusal guard because it enforces a separate public
policy before the commit carrier exists; keep the filesystem existence probe.

## Encoded-side impact

None. `exists`, `replacing`, and the replacement literal are private transient
control state. Preserve `writePacket`'s public TypeScript parameters and result,
the exact `packet-exists` and commit-error payloads, document bytes, directory
names, backup naming, and filesystem operation order. No packet, ledger, JSON,
database, or CLI encoding changes.

## Test impact

Retain tests proving create writes exact documents, non-force existing refuses
without changing bytes, force existing replaces and removes stale files, scan
and staging failures leave the old packet intact, successful replacement
removes the backup, promotion failure restores it, and create failure leaves no
packet or staging directory. Keep dry-run with and without force as a no-write
path and retain the symlinked-destination refusal. No new function-flag census
record or browser QA is required. Preserve the new Markdown-frontmatter/private-
path test43-61 and non-Markdown formula-refusal test130-141. They were read only;
no tests or package commands ran for this impact audit.

## Risk

Tier 1 internal derived refactor. The main risk is selecting the kind before
the refusal or dry-run returns, which would blur the proven two-state commit
boundary, or changing the transactional order around move-aside, promotion,
restore, and cleanup. The packet writer, repository-status probes, tests, and
complete caller graph were rechecked at the exact source SHA above.
