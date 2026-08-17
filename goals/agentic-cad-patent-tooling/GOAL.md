# GOAL: land the CAD + reference-numeral graph capability

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `apps/professional-desktop` can open the drawings a matter already
has, and the reference-numeral / figure graph is a queryable part of the
knowledge graph, with recorded provenance for every service that touched it.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/agentic-cad-patent-tooling/README.md`
- `goals/agentic-cad-patent-tooling/SPEC.md`
- `goals/agentic-cad-patent-tooling/PLAN.md`
- `goals/agentic-cad-patent-tooling/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards `SPEC.md`
names. Repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/law-practice/domain` (`CadFigure`, `ReferenceNumeral`),
  `packages/shared/domain/src/identity/LawPractice/`, `packages/documents/*`
  (byte read-back), `packages/drivers/*` (new engine wrappers),
  `apps/professional-desktop` (dock panel, RPC, runtime layer),
  `packages/law-practice/use-cases` (`cad_*` MCP tools).
- Out: model generation of any kind, filing-ready `37 CFR 1.84`
  certification, design-patent shading, replacing the human illustrator.

Non-negotiable constraints:

1. **Quality first.** Cloud models and services are permitted and expected
   where they are better. Record provenance and per-matter consent for every
   artefact a service touches; do not build an architectural wall.
2. **No GPL DWG reader** linked, bundled, or shipped — including inside a Web
   Worker. Do not redistribute ODA File Converter.
3. Schema first, then `Context.Service`, then implementation. Effect v4
   validated against `.repos/effect`, never training-data priors.
4. New packages via `bun run beep create-package`; new concepts via
   `bun run beep architecture`. Never `mkdir`.

Workflow:

1. Start at `PLAN.md` P1 — the numeral graph from artwork that already has a
   text layer. It needs no new engine and tests the packet's load-bearing
   assumption.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes; never `git add -A`.
4. Tie every decision to evidence from files, tests, docs, or command output.
5. Prove numeral extraction against real corpus files, not fixtures.
6. Update packet evidence/status if implementation changes readiness.
7. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] `37 CFR 1.84(p)(4)–(5)` bijection is computed and reportable: numerals
      in drawings but not spec, in spec but not drawings, and one numeral
      bound to two parts.
- [ ] A panel can fetch a file it did not just drop (byte read-back exists).
- [ ] DWG files show a preview tile with no GPL code in the binary.
- [ ] A licence audit records every third-party engine and its obligations.
- [ ] `bun run beep yeet verify` is green.
- [ ] Shipped as a PR driven to mergeable via `/yeet`.

Stop and report instead of improvising when:

- The bijection cannot be computed from real corpus files.
- DWG support would require linking GPL code or redistributing a converter
  whose terms forbid it.
- A provider's terms are incompatible with the matter's recorded policy.
- Verification needs unnamed credentials, cost, or destructive side effects.
- The same blocker repeats after reasonable investigation.
