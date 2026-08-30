# GOAL: Wire shared memory + code-KG into all four coding agents

> **Historical — MUST NOT be executed (superseded 2026-08-29).** This launcher
> built the basic-memory + codegraph plane that was later removed entirely;
> following it would reintroduce removed tooling. See
> `standards/memory-architecture/04-decision-log.md`. Record only.

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative unless prefixed with `~`.

Outcome: Claude Code, Codex CLI, Grok CLI, and Cursor all read/write one shared
basic-memory store (project `beep-shared`, machine-local) and query one codegraph
code-KG for this repo, keyless end-to-end; cognee is retired from the durable
dev-memory role and `standards/memory-architecture/` + `AGENTS.md` say so.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/shared-memory-code-kg-wiring/README.md`
- `goals/shared-memory-code-kg-wiring/SPEC.md`
- `goals/shared-memory-code-kg-wiring/PLAN.md`
- `goals/shared-memory-code-kg-wiring/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and
`standards/memory-architecture/`. External evidence (read-only):
the machine-local codebase-graph/memory bake-off dossier `BAKEOFF.md` and
`_research/bakeoff/` beside it. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the shared `beep-shared` store (create; machine-local), `.mcp.json`, `.gitignore`,
  `standards/memory-architecture/`, `AGENTS.md` Agent Memory section,
  machine-local MCP registration for Codex/Grok/Cursor, `goals/INDEX.md`
  regeneration.
- Out: Effect-native memory implementation, cognee/graphiti data migration,
  product surfaces, corpus/OIP material, deleting user-level cognee config.

Hard rules: zero metered API keys on any hot path; codegraph runs with
`DO_NOT_TRACK=1` and `CODEGRAPH_NO_UPDATE_CHECK=1`; store notes carry
`author:` frontmatter; the store dir is a git repo; no client-confidential OIP
content in the store, ever.

Workflow:

1. Inspect referenced files and current repo state (P0 inventory per PLAN).
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Archive round-trip and query evidence under `history/`; update packet
   status as readiness changes.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/shared-memory-code-kg-wiring/GOAL.md)" -le 4000
jq . goals/shared-memory-code-kg-wiring/ops/manifest.json
git diff --check -- goals/shared-memory-code-kg-wiring
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
