# GOAL: Ship the patent document schema

Repo root: the current beep-effect checkout.

Outcome: `@beep/law-practice-domain` owns typed patent sections and claim
structure, and the existing practice-KG claims batch consumes them.

Read `README.md`, `SPEC.md`, `PLAN.md`, `ops/manifest.json`, the source
exploration's BRIEF/MAP/DECISIONS, and repo instructions first.

Scope:

- In: law-practice domain schemas, Md heading normalization, the smallest
  practice-KG consumer seam, fixtures, tests, and normative documentation.
- Out: PO/SPAR/FOLIO/MCP work, AST rhetoric tags, runtime reasoning, and
  unrelated law-practice changes.

Start with P0 live-source and normative-reference confirmation. Implement the
smallest schema-first vertical slice, prove invalid/cyclic claim cases, then
publish through Yeet and close with a reflection.

Done only when the SPEC acceptance criteria pass and the PR is merge-ready, or
a named stop condition is reported with evidence.
