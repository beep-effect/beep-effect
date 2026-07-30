# GOAL: deliver eyecite capability parity as an Effect-native citation engine

Work from the current `beep-effect` checkout and use repo-relative paths.

Outcome: ship an attributed, schema-first, Effect-native engine with observable
capability parity to pinned Free Law Project eyecite 2.7.6, exact verified
source evidence, lawful schema transforms, and only proven TypeScript-port
extensions.

Read `AGENTS.md`, `CLAUDE.md`, applicable architecture/skill instructions, both
prerequisite contracts, then this packet in the order defined by
`goals/README.md`. Packet prose never overrides repository law.

Behavior oracle: official eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`. A live clone is optional
maintainer evidence configured with `EYECITE_ORACLE_ROOT`; committed fixtures
and accounting are the portable gate. `eyecite-ts` and `eyecite-js` are
differential/extension references only.

Blocked by:

- `goals/citation-verified-span-substrate`
- `goals/court-reporter-vocabulary`

P0 accounting may proceed. Before P1, both prerequisite contracts must be
available and `history/evidence/prerequisite-compatibility.md` must record their
exact symbols, public imports, versions, compatibility, and approved
adaptations. Until then, separation/removal decisions are binding but target
field/import/version details are provisional.

Required interpretation:

1. Port behavior and exhaustive coverage, not donor classes or file layout.
2. Reconcile a static source inventory with runtime oracle cases. The portable
   checker must reject every missing, duplicate, nonterminal, unlicensed, or
   unexplained row.
3. Give every TypeScript-port export/test behavior one evidenced disposition:
   adopted, subsumed, rejected, or follow-up. Donor installs require explicit
   authorization and frozen lockfiles.
4. Freely replace provisional citation schemas. Separate semantic citations,
   verified mentions, document-local mention/authority IDs, resolution data,
   document relationships, and run diagnostics. Reserve shared
   `LawPractice.CitationId` for a persisted entity.
5. Publish semantic schemas from law-practice domain; the raw-text request,
   closed errors, ports, and `CitationEngine` `Context.Service` from
   `@beep/law-practice-use-cases/server`; test fixtures from `/test`; and the
   live Layer from `@beep/law-practice-server/layer`. Publish no client surface
   unless a safe consumer is proved.
6. Every service method has `R = never`. Named modes are schema data; callable
   cleaners/tokenizers are injected server services, never function-valued
   request fields.
7. The `Citation` schema is its own structured codec; do not add a redundant
   wire model. `BluebookFromFullCitation` must accept
   `FullCitation.Type` in the exact `S.decodeEffect(...)(citation)` call and
   declare separate information and directional-totality laws.
8. Ambiguous, unresolved, and unknown citations are data. Boundary failures
   use a closed tagged error union. Enforce schema-owned resource limits,
   interruptibility-aware regex safety, clock-controlled timing, and
   privacy-safe spans.
9. Case/Id./supra/35 U.S.C./37 C.F.R. are the first internal slice, not the
   completion boundary. Classify 35 U.S.C. under canonical `FullLawCitation`;
   audit 37 C.F.R. before calling any residual behavior an extension.
10. Deliver packet, implementation, corpus, proof, reflection, and lifecycle
    update in one PR. Use phase-local green commits and do not freeze a public
    completion claim until all accounting and quality gates pass.

Stop rather than weaken scope when a prerequisite is incompatible, exhaustive
parity cannot be proved, safety/fidelity needs an unrecorded divergence, or the
one-PR constraint cannot remain reviewable.
