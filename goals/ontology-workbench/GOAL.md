# GOAL: ship the ontology workbench in professional-desktop

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `apps/professional-desktop` gains a fully featured ontology explorer,
editor, and visualizer backed by a new `ontology` vertical slice — open a
Turtle document, explore it (tree, search, GPU-scale graph), edit it
structurally with undo/redo, query it with SPARQL, validate it with SHACL and
apply verified repairs, see bounded inference, and save Protégé/ROBOT-parseable
Turtle.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/ontology-workbench/README.md`
- `goals/ontology-workbench/SPEC.md`
- `goals/ontology-workbench/PLAN.md`
- `goals/ontology-workbench/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/ontology/{domain,use-cases,server,client,ui}` (new slice);
  `packages/drivers/{n3,cosmos,oxigraph,shacl}` (new drivers);
  `apps/professional-desktop` (navigation shell + runtime/RPC wiring only);
  disambiguation notes in the two ontology README files named by `SPEC.md`.
- Out: multi-format import/export, registry fetch (OLS/BioPortal), full OWL 2
  DL reasoning, server-backed workspaces, agent/MCP tool surface (follow-up
  packet), chat-feature refactors, changes to `@beep/ontology` foundation
  models or the identity-as-iri surface.

Hard constraints (details in `SPEC.md`):

- Schema-first domain on `@beep/rdf` values; typed change-op edit model.
- Files as truth (Turtle on disk); file IO sidecar-side via Effect
  `FileSystem` ports.
- Viz: cosmos.gl WebGL2 primary, sigma.js fallback; WebGPU must not be a
  baseline dependency (Tauri Linux webview).
- SPARQL via Oxigraph WASM implementing the existing `@beep/semantic-web`
  contract; reasoning is domain-native structural inference.
- SHACL via the existing `@beep/semantic-web` contract; repairs are verified,
  undoable change ops.
- Agent-ready ops (SPEC 13–16): real batch deltas, query safeguards,
  schema-typed worker protocol, partitioned session indexes.
- Slice `ui` package owns screens; scaffold via `bun run beep architecture`.

Workflow:

1. Inspect referenced files and current repo state.
2. Execute `PLAN.md` phases in order (P0→P6); make the smallest change that
   satisfies `SPEC.md` at each step.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status as phases complete; land each phase through
   `bun run beep yeet` (repair → verify → publish → monitor).
6. At P6 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/ontology-workbench/GOAL.md)" -le 4000
jq . goals/ontology-workbench/ops/manifest.json
git diff --check -- goals/ontology-workbench
bun run beep yeet verify
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Also stop if
cosmos.gl proves non-viable on webkitgtk (pre-approved fallback: sigma.js).

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
