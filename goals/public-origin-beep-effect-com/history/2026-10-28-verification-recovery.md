# Verification recovery, 2026-10-28

The implementation shipped in #1946. The failed historical completion receipt
remains in `2026-10-28-original-completion-receipt.json`. Fresh delivery PR
#2319 supplies the outstanding readiness and merge gate.

## Package and focused proof

Full audits and docgen pass for identity, public-site, ontology, skill-contract,
all seven epistemic packages, exiftool, rdf and documents-domain. The public-site
audit includes the authority drift and typed route tests. Ontology, RDF and
documents-domain audits cover the loader, seeds and annotation adapter. The law
rule and command tests pass all 37 cases, including a tracked scratch violation
that fails strict mode. The tracked-file law reports zero findings; Graft finds
zero matches in 8,747 indexed code files.

Repository CLI docgen passes. Its full audit completed with 7,930 passing tests,
six failures and three skipped tests across 377 files. The six failures are one
in `quality-tasks.test.ts`, three in `docgen.test.ts`, and two in
`ci-lane.test.ts`. They assert plain command strings, spawn counts or labels
while the root environment enables cache-secret probes and `op run` wrappers.

## Environment attribution

The unchanged base `ed0c4ec45e7beaed152ca811489ca1030d4b8879` reproduces the
same six failures and 431 passing tests when its root `.env` is explicitly
loaded. Those test files and the cache-planning implementation have no diff
between that base and this closeout. Without root `.env` injection, the same
437 tests pass on both base and closeout. No secret value or reference inventory
is recorded here. The launcher permits separately recorded unrelated failures;
these failures do not establish a regression in the identity migration.

Reproduction, from the CLI package in each checkout:

```sh
bun --env-file=../../../../.env x --bun vitest run test/ci-lane.test.ts test/docgen.test.ts test/quality-tasks.test.ts
bunx --bun vitest run test/ci-lane.test.ts test/docgen.test.ts test/quality-tasks.test.ts
```

The workstation runs these commands through `beep-heavy`. Raw results remain
under `.beep/public-origin-proof/`, with separate base and closeout logs.

## Final-check evidence and subsequent heads

The complete receipt for `5248ae2184156a42e0c5bcfacebd99e935a46673` is
`.beep/yeet/final-check/5248ae2184156a42e0c5bcfacebd99e935a46673.json`.
Lint Policy, Lint, Repo Sanity, Check, Docgen, Fallow and Coverage passed. The
coverage run took 16 minutes 46 seconds and ran the repository CLI suite with
the credential-scrubbed posture. Cheap-gates was the one disclosed skip after
the publication preflight exceeded ten minutes.

`yeet ready` produced the empty reviewer-request commit `27f32b0340`; its tree
and the passed receipt's tree are both
`31ec523554f37b76d5329e407a787467d2ea7e28`. The reviewer then requested that
the README retain the completed CLI result rather than report it as running.
That correction changes only packet evidence. Coverage inputs in source,
tests, configuration and toolchain remain unchanged. The final-head receipt
replays the other gates and explicitly records coverage proof reuse as a skip.
It does not pretend a second coverage run occurred.

Fresh hosted checks, answered review threads, the full review window and merge
facts must bind the final pushed head. No earlier receipt alone closes the goal.
The committed lifecycle stays active; completion refresh verifies achievement.
