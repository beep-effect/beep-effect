# Instance

- id: `codex-findings-packet-commit-kind`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Codex/Findings.write.ts:289`
- symbol: `writePacket.commitKind`
- members: `exists`, `replacing`
- evidence: E4 at `Findings.write.ts:243-289` — the non-force existing
  path returns before `replacing` is declared, so on every path where both
  locals coexist `replacing` and `exists` have the same truth value.

# Current shape

`writePacket` probes whether the destination exists. An existing destination
without force returns the typed `packet-exists` refusal before document scan or
staging. The surviving commit path later derives `replacing` as
`force === true && exists`; because the refusal has already removed the
existing/non-force path, that conjunction is equivalent to `exists` there.

The replacement bit controls moving the old packet aside, restoring it if
promotion fails, and deleting the backup after promotion. A new packet skips
all three actions. The separate `dryRun` return occurs before staging and before
the commit-kind local; it is an independent write policy.

# Cardinality gap

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

# Target schema

Define a private `PacketCommitKind = LiteralKit(["create", "replace"])` in
`Findings.write.ts`. After the existing refusal, content scan, dry-run return,
and staging setup, select `replace` when the already-probed destination exists
and `create` otherwise. Use the LiteralKit-derived guard for the three backup
operations.

Do not absorb `force` or `dryRun` into this schema. They are function policy
inputs outside this local carrier. Do not add a `refuse` literal because that
path exits before commit staging and has no `replacing` value.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Codex/Findings.write.ts:1-40` — add
  the narrow `LiteralKit` import after checking live package barrels; keep the
  owner private to this command module.
- `Findings.write.ts:210-248` — preserve the public function options, optional
  force behavior, existence error mapping, refusal precedence, and exact error
  reason/message.
- `Findings.write.ts:250-269` — preserve content scanning before dry-run,
  no-write dry-run results, temporary-directory location, and staging errors.
- `Findings.write.ts:271-329` — replace `replacing` with `commitKind`, then use
  the replace guard for move-aside, restore-on-promotion-failure, and final
  backup cleanup. Preserve staging/promotion order and exact return payload.
- `packages/tooling/tool/cli/src/commands/Codex/Findings.command.ts:272-280` —
  no shape change; retain the sole production call and its existing force
  projection from the higher-level ingest mode.
- `packages/tooling/tool/cli/test/codex-findings-write.test.ts:42-107,148-247,326-347`
  — retain create, refusal, replacement, forced precommit failure, dry-run, and
  symlink-destination behavior.
- `packages/tooling/tool/cli/test/codex-findings-refresh.test.ts:19,153` — no
  API change; retain the direct test helper call.

Targeted source and barrel search found no other reader of `replacing` and no
other writer of this local commit decision.

# Guard-deletion accounting

Delete `const replacing = options.force === true && exists` and its three
Boolean guards at lines 292, 308, and 320. Replace them with one literal
selection and the derived `replace` guard. Keep the earlier
`exists && force !== true` refusal guard because it enforces a separate public
policy before the commit carrier exists; keep the filesystem existence probe.

# Encoded-side impact

None. `exists`, `replacing`, and the replacement literal are private transient
control state. Preserve `writePacket`'s public TypeScript parameters and result,
the exact `packet-exists` and commit-error payloads, document bytes, directory
names, backup naming, and filesystem operation order. No packet, ledger, JSON,
database, or CLI encoding changes.

# Test impact

Retain tests proving create writes exact documents, non-force existing refuses
without changing bytes, force existing replaces and removes stale files, scan
and staging failures leave the old packet intact, successful replacement
removes the backup, promotion failure restores it, and create failure leaves no
packet or staging directory. Keep dry-run with and without force as a no-write
path and retain the symlinked-destination refusal. No new function-flag census
record or browser QA is required.

# Risk and sequencing

Tier 1 internal derived refactor. The main risk is selecting the kind before
the refusal or dry-run returns, which would blur the proven two-state commit
boundary, or changing the transactional order around move-aside, promotion,
restore, and cleanup. The packet writer, repository-status probes, tests, and
complete caller graph were rechecked at the exact source SHA above.
