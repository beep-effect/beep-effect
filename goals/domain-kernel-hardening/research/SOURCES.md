# Domain Kernel Hardening — Sources & Provenance

Source exploration: `explorations/domain-layer-hardening/`; its decisions and
syntheses are grounding by reference. This lane reads no external corpus and
copies no upstream implementation. All sources below are present in this checkout.

## In-repo references

| Path or recorded change | What it grounds | Disposition |
| --- | --- | --- |
| `explorations/domain-layer-hardening/BRIEF.md` | Kernel scope; excludes slice migration and enforcement. | reference |
| `explorations/domain-layer-hardening/DECISIONS.md` | G1 never-overwrite, G2 lineage, G12 recoverable trash. | reference |
| `explorations/domain-layer-hardening/MAP.md` | Kernel first; siblings and deferred value objects. | reference |
| `explorations/domain-layer-hardening/synthesis/10-shared-kernel-audit.md` | Historical competing audit bases and missing soft-delete. | reference |
| `explorations/domain-layer-hardening/synthesis/19-phase1-crosscutting.md` | Cross-slice scope and ranked gaps. | reference |
| `standards/architecture/02-shared-kernel.md` | Extend the promoted contract; avoid zero-consumer exports. | reference |
| `standards/architecture/04-rich-domain-model.md` | Pure schema-first domain and typed failures. | reference |
| `standards/architecture/09-errors-across-boundaries.md` | Direct TaggedError, role files, declared field equivalence. | reference |
| `standards/ARCHITECTURE.md` | Domain role vocabulary and public surfaces. | reference |
| `.patterns/jsdoc-documentation.md` | Titled examples and compilable exported documentation. | reference |
| #720, `1e9d946750` (local Git history) | Entity-stack rewrite deleted DomainModel and EntitySchema. | reference |
| `.changeset/housekeeping-entity-stack.md` | Recorded migration to effect-drizzle and legacy deletion. | reference |
| `packages/shared/domain/src/entity/EntityKit.ts` | Canonical column packs and capabilities. | extend |
| `packages/shared/domain/src/entity/BaseEntity.ts` | Timestamp/version tier. | reuse |
| `packages/shared/domain/src/entity/AuditEntity.ts` | Canonical audit lineage. | reuse |
| `packages/shared/domain/src/entity/OrgEntity.ts` | Tenant capability on audited tier. | reuse |
| `packages/shared/domain/src/entity/ProductEntity.ts` | Full product contract and fields projection. | extend |
| `packages/shared/domain/src/entity/Principal.ts` | Rich actor union and nullable defaults. | reuse |
| `packages/shared/domain/src/entity/EntityRef.ts` | Existing invariant error and stable diagnostics. | extend |
| `packages/shared/domain/README.md` | Existing ProductEntity promotion record. | extend |
| `packages/shared/domain/test/SchemaParity.test.ts` | Effect codecs and schema-derived property tests. | reuse |
| `packages/shared/domain/test/TaggedError.equivalence.test.ts` | Opaque actualId equivalence regression. | reuse |
| `packages/epistemic/domain/src/values/ClaimLifecycle/ClaimLifecycle.errors.ts` | Smart constructor and error union convention. | reference |
| `packages/ecosystem/effect-drizzle/README.md` | Metadata-only nullable kit extension. | reuse |
| `packages/_internal/db-admin/AGENTS.md` | Generated migration ownership and bundle resync. | reference |
| `node_modules/effect/dist/schema/Model.d.ts` and `.repos/effect/packages/effect/src/schema/Model.ts` | Installed and reference GeneratedByApp/FieldOption semantics. | reference only |
| `goals/_template/research/SOURCES.md` | Sources ledger rules. | reference |

No external URL is asserted. Effect reference source is used to verify API
semantics; no code is vendored from it. The packet SPEC Decision Log records the
chosen changes and reversal paths.
