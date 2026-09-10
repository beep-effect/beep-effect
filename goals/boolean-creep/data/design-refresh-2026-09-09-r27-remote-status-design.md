# R27 remote status design handoff

Source pin: `HEAD 8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus pin: `origin/main 663904610cce2a38c06b0619a8c414646b69361c`.
The parent froze these references for this bounded design lane. No fetch,
merge, source/test mutation or canonical state change was performed here.

Design: `../designs/yeet-status-remote-check-phase.md`.
Native evidence: `design-refresh-2026-09-09-r27-cli-seed-drift.md`, section
"Expanded YeetStatusRemote phase: retain the stable ID and legacy payloads".
Independent correction:
`sweeps/refresh-2026-09-09-r27-main-663904/r27-cli-yeet-contract-correction1.jsonl`
and its `.execution.json`. The correction completed during drafting; this
lane read the remote record and receipt, which confirm 12/5, the three
members and both exact source pins. The receipt reports exit 0, a completed
turn, an existing valid report, and `formalIndependentReview: false`.
Thus the case has independent census support, but the new design still
requires P3 review. The parent owns canonical integration/status.

## Exact prior-design preservation

Before replacing the active design, copied its exact bytes to:

`../history/designs/2026-09-09-r27-pre-draft-axis-yeet-status-remote-check-phase.md`

- Byte count: `4190`.
- SHA-256: `d1ed296d0b1a38657d4da8f730b7da5933a6e1be7edd974ef81088cf320b8237`.
- Verified byte equality against the still-unmodified active design before
  replacing it. Exclusive creation refused a conflicting archive; replacement
  also checked the active design hash to avoid overwriting another agent.

The old design modeled only available/checked (4/3) and left optional isDraft
as an independent decoded payload. Its historical reasoning is retained;
it is not the design for the expanded 12/5 member set.

## Source findings and resulting decisions

All abbreviated source paths below are under
`packages/tooling/tool/cli/src/commands/Yeet/internal/`; test paths are
relative to `packages/tooling/tool/cli/`.

| Finding | Source | Design consequence |
| --- | --- | --- |
| Draft has absent/false/true alternatives. | `Status.ts:213` | Twelve product states, not eight; five phase literals preserve every legitimate case. |
| Unknown draft on checked-present is explicitly rendered and persisted. | `test/yeet-status-triage.test.ts:153`, `:458`, `:471`; `test/yeet-artifact-writers.test.ts:355`–`:377` | Keep checked-present-draft-unknown; never default it to false or reject it. |
| Non-draft requires explicit false. | `Status.ts:1117` | Only checked-present-not-draft satisfies that criterion; unknown and true stay distinct encoded values. |
| No proven phase/payload ownership rules extend beyond the triple. | `Status.ts:206`–`:237`, consumers `:1006`–`:1049` | Copy every sibling/default/domain without adding requirements or stripping fields. |
| Check rendering gates only on checked. | `Status.ts:1232`–`:1239` | Checked-absent with supplied counts must still render them; only skipped short-circuits. |
| Handler and monitor consume remote siblings through snapshots. | `Handler.ts:1075`, `:1101`; `MonitorLoop.ts:985`, `:996`–`:997` | Preserve rerun/thread enforcement, PR lifecycle terminal handling, head and failed-check behavior. |
| CLI JSON bypasses the snapshot codec. | `Handler.ts:1251`; `packages/tooling/tool/cli/src/internal/cli/Json.ts:15`, `:177`, `:299` | Add a bounded old-value command projection using the same phase inverse, then retain the generic printer. |
| Artifact encoding already uses its schema codec and newline. | `Status.ts:311`, `:1391`, `:1398` | Preserve exact artifact representation separately from command serialization. |

The phases are skipped, checked-absent, checked-present-draft-unknown,
checked-present-not-draft and checked-present-draft. All three selected axes
are removed from decoded Value. The two unavailable phases encode no draft;
all present phases encode available/checked true and restore omission, false
or true. The seven unsupported triples reject through one compatibility
transformation. All 22 siblings retain original schemas/defaults and payloads.

## Additional generic JSON boundary

Following `YeetStatusSnapshot` found
`Handler.ts:1251 -> printCommandJson(snapshot)`. That helper encodes
`UnknownFromJsonString` through
`packages/tooling/tool/cli/src/internal/cli/Json.ts:177`, then writes through
`CommandJsonOutput`. It does not discover the `YeetStatusSnapshotJson`
transformation by inspecting the value.

The unknown schema is intentionally untyped
(`packages/foundation/modeling/schema/src/Unknown.ts:43`, `:75`), and
ordinary Schema class construction does not attach its enclosing artifact
codec (`.repos/effect/packages/effect/src/Schema.ts:13740`). A phase-valued
remote therefore needs an explicit command projection. Replacing the whole
CLI path with artifact encoding would also change pre-existing Option
representations on that output; the design preserves each current boundary.

The command projection has the phase model as Type and the former decoded
remote value as Encoded. It uses `S.toType` on the same legacy source schema
and shares the exact same bidirectional phase transformation. It replaces
only remote before calling the existing generic printer. This adapter has
one real production consumer and is a serialization requirement, not a
compatibility alias or extra domain state. Its fixtures compare captured
pre/post CLI bytes separately from artifact bytes, including Option-rich
payloads, unchanged outer fields, trailing newline and large-output behavior.

## Search coverage and verification boundary

Graft was used first for the remote symbol/pair search, full Status API,
remote/snapshot uses within Status, source-wide snapshot/readiness/render
references, Handler/MonitorLoop field consumers, and shared JSON printer API.
A complementary repository source search found no additional app or static
remote `.fields` consumer. The empty class caller graph was not treated as
evidence of no consumers. Test constructors and real artifact/legacy render
fixtures were read directly after graph discovery.

The design inventories all four production constructors, phase readers,
snapshot collection/codec/writer, generic command adapter, Handler and
monitor sibling consumers, Yeet facade/test kit and three named test files.
Advanced APIs are grounded in local `Schema.ts:2490`, `:5366`,
`SchemaGetter.ts:612` and `SchemaIssue.ts:747`. The composed codec has not
been executed; implementation tests and full package proof remain future
requirements after evidence gates pass.

Manual document verification checks eight exact required section strings,
all five phase names, frozen pins, archive hash and whitespace. Product tests,
package commands, GitHub operations, services and canonical validators are
outside this lane. Authored paths are only the replacement design, this
handoff and the explicitly requested exact-byte prior-design archive.
