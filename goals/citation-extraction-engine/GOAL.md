# GOAL: deliver eyecite capability parity as an Effect-native citation engine

Repo root is the current `beep-effect` checkout. Use repo-relative paths.

Outcome: an attributed, schema-first, Effect-native implementation has
observable parity with pinned Free Law Project eyecite 2.7.6, adopts only proven
TypeScript extensions, preserves verified source evidence, and exposes lawful
schema transformations including a Bluebook-style proof.

Read first:

- the packet's `README.md`, `SPEC.md`, `PLAN.md`, and `GOAL.md`
- `ops/manifest.json` and all files under `research/`
- `AGENTS.md`, `CLAUDE.md`, dependency contracts, and named standards

Normative oracle:

- Official Python eyecite commit
  `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e` (version 2.7.6).
- Default read-only clone:
  `/home/elpresidank/YeeBois/research/law_stuff/repos/eyecite`.
- `eyecite-ts` and `eyecite-js` are differential/extension references only.

Blocked by:

- `goals/citation-verified-span-substrate`
- `goals/court-reporter-vocabulary`

P0 source/accounting work may proceed. Do not freeze or implement public engine
contracts until both dependencies are public and compatible.

Required interpretation:

1. Port behavior and coverage, not Python classes or file layout.
2. Account for every canonical capability and upstream test case. No canonical
   row may be rejected or deferred.
3. Give every unique TypeScript-port capability an evidenced disposition:
   adopted, subsumed, rejected, or follow-up. Adopt only licensed, tested,
   coherent extensions that preserve bounded deterministic execution.
4. Rebuild existing provisional schemas freely. Keep durable legal concepts;
   remove copied implementation shapes and parallel truth.
5. Separate semantic citations, source mentions/anchors, resolution, document
   grouping, and run diagnostics.
6. Model public/inter-stage data as annotated Effect schemas. Extraction is an
   Effect API, not a reversible codec.
7. Bidirectional transforms require round-trip equality; canonicalizing
   transforms prove semantic equivalence; lossy/partial directions fail typed.
8. Replace the static best-effort Bluebook formatter with structured
   `BluebookCitation`, `BluebookFromFullCitation`, and text transformations.
   This proves supported transformations, not full manual compliance.
9. Use case/Id./supra/35 U.S.C./37 C.F.R. as the first internal slice; complete
   canonical parity and accepted extensions before publishing.
10. Deliver packet, code, corpus, transforms, proof, and closeout in one PR.
    Use reviewable local commits; publish after local gates are green.

Acceptance:

- [ ] Every canonical capability/test row is ported or intentionally subsumed
      with equivalent proof; none is unreviewed, rejected, or deferred.
- [ ] Every unique TypeScript extension has a final evidenced disposition.
- [ ] Schema-disposition and transformation-law gates pass.
- [ ] Exact UTF-16 source anchors, resolution, cleaning, extraction, annotation,
      regex safety, property laws, docs, and differential parity pass.
- [ ] No runtime Python, `eyecite-js`, `eyecite-ts`, hosted-parser, raw
      vocabulary, or native Hyperscan dependency exists.
- [ ] The one implementation PR is mergeable through Yeet and includes the
      packet state change plus reflection.

Stop rather than weaken scope when a dependency contract is unavailable,
proven parity cannot be reproduced, or safety/fidelity would require an
unrecorded divergence.
