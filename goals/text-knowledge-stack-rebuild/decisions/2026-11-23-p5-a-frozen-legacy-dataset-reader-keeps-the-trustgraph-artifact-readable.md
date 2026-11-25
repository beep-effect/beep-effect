---
title: "P5: a frozen legacy dataset reader in the trustgraph verify script keeps the committed history artifact readable across the Literal and Dataset change"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Teach the live Literal decoder the legacy datatype and language encoding as a read transform, by a decision file before the Literal commit lands"
---

Independent review of the P5 design, finding on a stored reader the maps missed. `goals/trustgraph-doc-ontology/history/outputs/beep-effect-documentation-seed.dataset.json` is a committed, immutable history artifact holding 303 literals in today's wire shape `{ datatype, termType, value }`. `goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts` decodes it with the live `Dataset` schema (`:11`, `:129`), hands the raw JSON to `ShaclValidationRequest` (`:138-139`) and reads `dataset.quads.length` (`:179`); the packet's verify command runs it (`goals/trustgraph-doc-ontology/ops/manifest.json:40`). Adding `Literal.form` and making `quads` a set breaks that read.

1. The artifact's bytes never change.
2. In the commit that changes `Literal` and `Dataset`, the script declares a frozen legacy dataset schema beside `FrozenEvidenceProjection` (`:13-14`), the precedent it already set for its evidence file. It decodes the artifact with the frozen schema, converts each literal through `Literal.fromParts` (Simple for `xsd:string` with no language, LangTagged with a language, Typed otherwise), builds the live `Dataset`, passes that to the SHACL request, and counts with `HashSet.size`.
3. The live `Literal` decoder does not learn the legacy shape: no table stores a `Literal`, and one script is the only legacy reader.
4. That commit's gate runs `bun goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts`.
