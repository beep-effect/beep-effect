# Reflection lint runtime preparation

Status: applied; current evidence is in `cli-reflection-bootstrap-runtime-proof.md`.
The notes below record the pre-application preparation.

The existing CLI inventory identifies ten open runtime boundaries in
reflection-lint.test.ts. All ten historical rows match uniquely by original
line/evidence and callback title. A private draft removes those boundaries,
uses a public serial testLayer fixture and fresh per-case TestConsole, and
consumes the shared scoped temporaryWorkingDirectory constructor directly.
All ten 20-second callback timeouts and 13 assertion trees remain unchanged.
The original suite already requires serial execution because it changes cwd.

The unchanged baseline passes all ten cases on Node and Bun, with stable source
hashes and no isolated temporary residue. Whole-command observations are Node
5.373 seconds and Bun 3.219 seconds. The preceding CLI package proof overlaps
these measurements, so they do not support causal performance comparisons.

The inspected reflection handler reads goals, manifests and reflection files,
decodes frontmatter, then reports through Console and the reported-exit helper.
Its exercised path does not acquire packet locks or schedule retries/timers;
the draft retains the test clock. Native service construction remains in the
shared fixture. The native-platform provenance review stays open.

Preview detection removes all ten EV001 findings and introduces no findings.
The draft is not applied and no ledger rows are closed. Actual migration still
requires Node/Bun runs, diagnostic artifact inspection, root policy gates,
per-case console/cwd failure/interruption controls and grouped package proof.
