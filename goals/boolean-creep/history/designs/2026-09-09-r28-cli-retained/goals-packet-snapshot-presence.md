# Instance

- id: `goals-packet-snapshot-presence`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:701`
- symbol: `PacketSnapshot`
- members: `exists`, `files`
- evidence: E4 at `packages/tooling/tool/cli/src/commands/Goals/Adopt.ts:173-174` — a missing directory always produces an empty file list, while an existing directory may be empty or nonempty.

# Current shape

`readPacketSnapshot` stores directory existence beside the complete, ordered packet-file snapshot. The struct admits `exists: false` with nonempty `files`, although its only filesystem writer cannot produce that tuple. `templateFiles` and `templateSnapshotHash` describe the independently read `_template` tree and do not participate in this correlation.

# Cardinality gap

The boolean and file-list emptiness represent four tuples. Three are legal: packet missing, packet present and empty, and packet present with files. Missing with files is incoherent.

# Target schema

Define a private named `PacketSnapshotDisposition` LiteralKit with `missing`, `empty`, and `present`. Replace the pair with a tagged union: only `present` owns a nonempty `files` payload; `empty` owns no files; `missing` owns no files. Keep `PacketSnapshot` as the exported decoded schema identity and migrate its constructors and readers atomically. Preserve file order, text, digest, mode, path, and every other file value exactly. Decode rejects only false/nonempty.

# Migration inventory

- `Bootstrap.schemas.ts:667-709` — add the local literal and union cases, retain the exported `PacketSnapshot` type/schema name, and update its example.
- `Adopt.ts:165-183` — classify the directory read directly as missing, empty, or present without writing a parallel boolean.
- `Adopt.ts:221-241,296-342,426-442` — match the disposition; preserve archetype inference, packet-not-found text, manifest parsing, retained-file order, missing-template calculation, reflection validation, and seeded-manifest inputs.
- `test/goals-bootstrap-plan.test.ts:184-260,322-395,577` — migrate construction/assertions for all three cases and retain digest/order/idempotence checks.
- The `Bootstrap.schemas.ts` and `Adopt.ts` command exports remain the owners; targeted barrel search found no second schema owner.

# Guard-deletion accounting

Delete the `exists` field, its two constructor writes, the `if (!snapshot.exists)` guard, and tests that coordinate `exists` with file emptiness. The tagged match replaces that guard. Keep directory probing, filesystem errors, manifest guards, and template-file emptiness checks because they describe independent behavior.

# Encoded-side impact

There is no encoded boundary: `PacketSnapshot` is transient, and adopt JSON contains the compiled materialization plan rather than this snapshot. Migrate the decoded TypeScript shape atomically. `templateFiles` and `templateSnapshotHash` remain independent and byte-for-value unchanged.

# Test impact

Add schema construction and schema-derived arbitrary coverage for all three cases. Retain missing packet, empty directory, manifest-less packet, corrupt manifest, template overlay, file ordering/digests, preservation, and deterministic index tests.

# Risk and sequencing

Land with the serial Tier 1 packet-model batch. The main risk is treating an empty existing packet as missing or narrowing the independent template snapshot. Preserve the exact packet-not-found branch and all file ordering.
