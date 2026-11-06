# GOAL: deliver eyecite capability parity as an Effect-native citation engine

Ship attributed, schema-first, Effect-native exhaustive observable
parity to Free Law Project eyecite 2.7.6, verified source evidence, lawful schema
transforms, and only proven TypeScript-port extensions.

Read `AGENTS.md`, architecture/skills, prerequisites, and packet in
`goals/README.md` order. Repo law prevails.

Oracle: `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`; optional live clone:
`EYECITE_ORACLE_ROOT`. Committed fixtures/accounting are the portable gate.
`eyecite-ts`/`eyecite-js` are differential/extension references only.

Blocked by:

- `goals/citation-verified-span-substrate`
- `goals/court-reporter-vocabulary`

P0 may proceed. Before P1, both contracts must be available and
`history/evidence/prerequisite-compatibility.md` must record exact symbols,
public imports, versions, compatibility, and approved adaptations. Until then,
separation/removal binds; target fields/imports/versions are provisional.

Requirements:

1. Port behavior and exhaustive coverage, not donor layout/classes.
2. Reconcile static inventory and runtime oracle cases. Portable checks reject
   every missing, duplicate, nonterminal, unlicensed, or unexplained row.
3. Evidence every TypeScript export/test disposition: adopted, subsumed,
   rejected, or follow-up. Donor installs need explicit authorization and frozen lockfiles.
4. Replace provisional schemas as needed. Separate semantic citations,
   verified mentions, document-local mention/authority IDs, resolution data,
   document relationships, and run diagnostics. Reserve
   `LawPractice.CitationId` for persisted entities.
5. Publish semantic schemas from law-practice domain; the raw-text request,
   closed errors, ports, and `CitationEngine` `Context.Service` from
   `@beep/law-practice-use-cases/server`; test fixtures from `/test`; and the
   live Layer from `@beep/law-practice-server/layer`. Client surfaces need a proved safe consumer.
6. Every service method has `R = never`. Modes are schema data; callable
   cleaners/tokenizers are injected server services, never request fields.
7. `Citation` is its own structured codec; no redundant wire model.
   `BluebookFromFullCitation` must accept
   `FullCitation.Type` in the exact `S.decodeEffect(...)(citation)` call and
   declare separate information and directional-totality laws.
8. Ambiguous, unresolved, and unknown citations are data. Boundary failures
   use a closed tagged error union. Enforce schema-owned resource limits,
   interruptibility-aware regex safety, clock-controlled timing, and
   privacy-safe spans.
9. Case/Id./supra/35 U.S.C./37 C.F.R. are the first slice, not completion.
   Classify 35 U.S.C. as `FullLawCitation`; audit 37 C.F.R. before calling
   residual behavior an extension.
10. Deliver packet, implementation, corpus, proof, reflection, and lifecycle
    update in one PR. Use phase-local green commits; claim completion only after
    all accounting and quality gates pass.

Approved 2026-10-29: native HTML resource exhaustion fails without partial
output per `ops/html-safety-exception.json`. Other parity duties remain.

Approved 2026-11-02; draft status later superseded: push ready work using
hosted CI without waiting on verification/local compute. Record
passed/pending checks. Keep PR #2511 ready for review while continuing the full
goal. Draft status is no acceptance gate; review readiness neither claims
completion nor authorizes merging. All acceptance requirements remain.

Approved 2026-11-05: continue unchanged in linked follow-ups when PRs merge,
starting with HTML geometry/quality fixes after #2713. Only one-PR delivery/
reviewability is excepted. Keep prior PR/evidence links and all acceptance duties.
See `decisions/2026-11-05-linked-follow-up-publication.md`.

Stop without weakening scope on incompatible prerequisites, unprovable
exhaustive parity, unrecorded safety/fidelity divergence, or loss of one-PR
reviewability.
