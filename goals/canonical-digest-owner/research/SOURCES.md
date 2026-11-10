# Canonical Digest Owner — Sources & Provenance

- **Source exploration:** `explorations/protocol-as-value` — primary ledger:
  `explorations/protocol-as-value/research/SOURCES.md`. This file carries
  only what the goal implements against; the exploration's ledger keeps the
  wider corpus (session types, content-addressed languages, transparency
  logs), none of which this goal ports.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| encoder-differential-2026-11-10 | Differential run of four in-repo canonical-JSON encoders over 20,000 plain-JSON values | this repo | `explorations/protocol-as-value/research/encoder-differential-2026-11-10.md` | byte equality on JSON; divergence off it | reuse (method becomes the slice A property test) |
| inventory-2026-11-10 | Shape-review inventory of encoders, digest grammars and Effect modules in use | this repo | `explorations/protocol-as-value/RESEARCH.md` (2026-11-10 section) | census seed | extend into the tracked census |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| none | n/a | n/a | No upstream code is ported. `JsoncFingerprint` is already in-tree, promoted from the effected kit on 2026-10-21. |

## 3. External research sources

- RFC 8785, JSON Canonicalization Scheme (JCS), IETF, June 2020:
  <https://www.rfc-editor.org/rfc/rfc8785>. The specification
  `JsoncFingerprint` implements and the byte form this goal names.

## 4. In-repo capability references

- `packages/foundation/modeling/jsonc/src/JsoncFingerprint.ts` — the owner:
  `canonicalizeResult`, `canonicalize`, `hashResult`, `hash`, typed
  `JsoncCanonicalizeError` codes.
- `packages/foundation/modeling/schema/src/Sha256.ts` — `Sha256Hex` and its
  codecs; the prefixed grammar lands beside it.
- `packages/foundation/capability/file-processing/src/Artifact/Artifact.schema.ts`
  — `ContentDigest`, one of the two existing `sha256:` schemas.
- `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts` —
  `SourceTextDigest`, the other.
- `packages/foundation/modeling/epistemics/src/internal/CanonicalJson.ts` —
  encoder behind `canonicalDetectionJson`.
- `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketDigest.ts` —
  `canonicalJsonText`, `canonicalJsonTextPretty`, `packetEventDigest`.
- `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketEventStore.ts`
  — the read-time digest check the replay reuses.
- `packages/execution-authority/domain/src/entities/ExecutionRecord/ExecutionRecord.model.ts`
  — `verifyExecutionDecisionChain`, the seal recomputation the replay reuses.
- `apps/labs/semantica/src/corpus/Canonical.ts` — lab encoder.
- `packages/party/domain/src/values/PartyKey/PartyKey.behavior.ts` — PartyKey
  v1 canonical bytes, pinned by the party-slice specification.
- `packages/drivers/openclaw/src/OpenclawRender.ts` — an indented document
  renderer, recorded as a renderer.
- `packages/drivers/box-provisioning/src/internal/canonical.ts` — the one
  existing consumer of the owner.
- `packages/tooling/policy-pack/lint-rules/rules/` — the GritQL rules the
  guard joins.

## 5. Cross-links & provenance

- `explorations/protocol-as-value/DECISIONS.md`, 2026-11-10 entry: the
  operator-approved shape.
- `explorations/protocol-as-value/MAP.md`: the gated candidates this goal
  must not activate.
- `goals/oracle-loop-poc/QUESTION-BINDING.md`: told to find the canonical
  identity owner before implementation; this goal is that owner.
