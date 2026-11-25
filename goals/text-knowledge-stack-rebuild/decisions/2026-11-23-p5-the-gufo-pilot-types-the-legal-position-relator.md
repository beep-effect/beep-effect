---
title: "P5: the gUFO schemas live in @beep/ontology and the LegalPositionRelator typing rows in law-practice under a new law-practice namespace; Mode leaves the instance categories"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Type a different relator, or restore Mode with gUFO IntrinsicMode and ExtrinsicMode terms, by a decision file before the gUFO commit lands"
---

Map questions T12, T13 and S12. `LegalPositionRelator` (`packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts`) is confirmed as the pilot. It is the one relator whose role pair drives a check: `LegalPositionRelatorPolicy.screenForOpposition` (`packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts:24-40`, `:59-80`, `:183-217`).

The schemas live in `@beep/ontology`: `GufoClassType`, `GufoInstanceCategory`, `GufoTyping`, `GufoTypings` (an `S.HashMap` keyed by `TermIri`), `TypedHierarchy`, `OntoViolation` and `audit`. That satisfies "a record keyed by term IRI in @beep/ontology" (PLAN P5) without legal names in foundation. The pilot's rows are law-practice data. A new internal registry shard, `law-practice` (`https://beep-effect.com/ns/law-practice/`), declares four terms:
- `LegalPositionRelator`: Kind, instance category Relator, mediating the two roles;
- `PositionBearer` and `PositionCounterparty`: RoleMixin, each specializing `Party`;
- `Party`: Category.

The roles are mixins because natural and juristic persons, which are different kinds, both play them (`LegalRole` admits both party kinds). A typed `Kind` is therefore not owed, and the audit is sound on that shape. The rows and specialization edges are exported by a typing leaf beside the relator in the domain package. A use-cases test audits them and binds the policy's two role fields to the mediated terms.

`GufoInstanceCategory` drops `Mode`. gUFO 1.0.0 declares no `Mode` class, only IntrinsicMode and ExtrinsicMode (decision `2026-11-20-p1-namespace-pins-live-tree-calls` point 5), the pilot needs none, and every literal must name a declared `gufo:` term (`identity/registry/namespaces/gufo.json`). Chapter 16's list follows. `TypedHierarchy` is `{ typing, specializes }`, and the sketch's `terms` map is dropped as redundant. `audit(hierarchy)(term: TermIri)` reports `RoleWithoutKind` only when the reflexive-transitive supertypes contain no `Kind` and no untyped term, because an untyped supertype could be a Kind and soundness forbids guessing. `RigidSpecializesAntiRigid` covers typed pairs only, and `Mixin` is semi-rigid. `RelatorUndermediated` covers a relator whose mediation cardinalities sum to less than two. `GufoTyping.mediates` is a `HashMap<TermIri, MediationCardinality>` (a positive integer), because a set of type IRIs cannot record that a marriage mediates two spouses of one role type; that model is planted as a no-violation example. The pilot mediates each of its two roles with cardinality 1. `GufoTypings` encodes its entries sorted by term IRI. The typing leaf builds its term IRIs through the identity `Registry`, never as spelled strings, which keeps the public-origin rule (`bun run beep laws retired-iri-authorities --check`) green. The audit runs as a function in P5. Running it as a lint over agent-proposed terms is L7 work for P6.
