# Approved lossless-boundary inventory entries

The repaired external decoders pass exact live decode/encode round trips, but
`bun run beep lint schema-first` requires inventory entries for these five
`S.StructWithRest` boundaries. `S.Class` has a closed field set and cannot
retain arbitrary extension fields. The existing `LexicalNodeWire`,
`SerializedEditorStateWire`, and `Pandoc` wire exceptions use the same rationale.

The current Effect reference confirms the boundary: `Schema.Class` accepts
`Struct.Fields` or `Struct`, while `StructWithRest` exposes `schema` and
`records` rather than the required `fields`. Its parse options offer only
`onExcessProperty: "ignore" | "error"`; there is no preservation option that
would make the existing closed classes lossless without an open wire schema.

Approved change: add exactly five entries to
`standards/schema-first.inventory.jsonc`; no baseline refresh or lint weakening.

Every entry has:

- `file`: `packages/tooling/tool/cli/src/commands/Models/Models.catalog.schemas.ts`
- `kind`: `object-struct-schema`
- `status`: `exception`
- `owner`: `@beep/repo-cli`

| Symbol | Reason |
| --- | --- |
| `UpstreamThinkingSupport` | Lossless external thinking metadata boundary (R1). Open records preserve future reasoning fields and unknown levels through exact decode/encode round trips; a closed class would discard them. |
| `UpstreamModelEntry` | Lossless upstream model boundary (R1). Unknown provider capabilities and future metadata must survive exact decode/encode round trips; snapshots persist only the separate normalized CatalogModel. |
| `CodexReasoningLevel` | Lossless Codex effort metadata boundary (R10). Unknown ladder metadata survives exact decode/encode round trips; known effort and description fields remain validated. |
| `CodexCacheEntry` | Lossless Codex model cache boundary (R1). Future model fields survive exact decode/encode round trips; known routing fields remain validated. |
| `CodexModelsCache` | Lossless Codex cache envelope (R1). Unknown envelope metadata survives round trips; account-scoped metadata is never projected into persisted catalog snapshots or reports. |

The operator ratified full payload fidelity, normalized-only persistence, and
these five open wire boundaries during the follow-up grill-with-docs interview,
then explicitly requested implementation. This admits the five inventory
entries into the goal scope. See `../DECISIONS.md`; no architecture-wide rule
change or broader inventory refresh is authorized.
