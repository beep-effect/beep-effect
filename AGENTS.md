# Agent Guide

Canonical rules for all coding agents. Claude Code loads this via the
`CLAUDE.md` symlink (edit `AGENTS.md`, never the symlink); Codex reads it
directly. Laws only — architecture lives in `standards/ARCHITECTURE.md`,
workflows in skills.

## 1Password MCP

- Treat the `op` CLI session and the 1Password MCP connection as separate
  authentication surfaces. `op whoami` can succeed in the operator's terminal
  while failing inside an agent process because `OP_SESSION_*` is shell-local.
  An agent-side failure does not prove that the desktop app or operator shell is
  signed out.
- Enabling the MCP server in the 1Password desktop app does not register it with
  every agent client. For Codex, first verify that `1password-mcp` is on `PATH`
  and that `codex mcp get 1password` succeeds. If the registration is missing,
  run `codex mcp add 1password -- 1password-mcp`.
- MCP tools are fixed when an agent session starts. After adding or enabling the
  server, start a fresh task/session and approve its desktop connection; an
  already-running session will not hot-load the new tool. Do not respond to a
  missing MCP tool by repeatedly asking the operator to unlock 1Password or run
  `op signin`.
- For a pre-existing `op://`-backed env file, test the exact operation with
  output suppressed: `op run --env-file=<path> -- true >/dev/null`. That wrapper
  can obtain desktop authorization and succeed even when agent-side
  `op whoami` fails; do not use `op whoami` as a gate for the wrapper.
- Never copy, print, or inject `OP_SESSION_*` values to bridge the process gap.
  Once exposed, use the 1Password MCP tools and keep secret values inside
  1Password.

## Code Laws

- Use schema-first domain models; prefer typed errors and tagged unions.
- Prefer effect helper modules (`String`, `Equal`, ...) over native helpers;
  keep root `effect` imports for core combinators.
- Prefer match helpers over conditional chains; prefer service composition
  over global state; keep service boundaries explicit.
- Prefer the tersest equivalent helper form when behavior is unchanged: direct
  helper refs over trivial lambdas, `flow(...)` over passthrough `pipe(...)`
  callbacks, shared thunks already in scope.
- Prefer named schema building blocks, derived `S.is(...)` guards, and
  `LiteralKit` internal domains over ad-hoc predicate helpers. Do not add
  `as const` to inline arrays passed to `LiteralKit(...)` — it uses const
  type parameters already.
- Apply schema defaults when safe. Keep changes focused and testable.
- JSDoc on exported symbols uses titled `**Example** (Title)` and
  `**Details**`/`**Gotchas**` prose sections — never `@example` or `@remarks`
  tags. Law: `.patterns/jsdoc-documentation.md`.
- In `packages/**/test/**/*.{ts,tsx}`, import package source through
  `@beep/*` aliases instead of relative paths into any workspace `src/`;
  relatives only for local helpers, fixtures, snapshots, and other
  non-`src` test files.

## Discovery & Reuse

- Before recreating a shared helper, schema, utility, model, or known symbol,
  search live source (`packages/**/src/**`) and package barrels
  (`**/src/index.ts`) first with targeted ripgrep.

## Quality Operator

- Yeet is the canonical repo-quality path: `bun run beep yeet repair`,
  `... verify`, `... publish --message "..."`, `... monitor`. Keep those
  commands green.
- Heavy admitted work runs in `agent-run-<ticket>.scope` under
  `agent-runs.slice` when the user manager allows it; `scheduler reap --apply`
  stops scopes backed by dead leases. A loaded scope without a dead lease is
  left alone because it may belong to an admission racing with the reaper.
  Without the installed slice file, systemd uses a transient slice with defaults.
- `main` is PR-only. Do not commit saving/wip/tmp checkpoints to shared
  branches; publish from a feature branch through Yeet and let hosted required
  checks gate the merge. GitHub merge/squash commit messages are also
  server-side commitlint input; keep body lines wrapped under 100 characters.
- Docgen: `bun run docgen:local` for edit loops (bounded to
  `origin/main...HEAD` + dirty files); full `bun run docgen` only for the
  repo-wide proof.
- Attribute verification failures before repairing — introduced / inherited /
  unrelated / environment-only; attribution decides fix vs rebase vs report,
  not blind rerun.
- “Mergeable” describes the complete PR state, not GitHub's structural
  `MERGEABLE` field alone. It requires both of the following:
  - no outstanding PR comments or nits unless they are marked resolved, marked
    outdated, or have received a response; and
  - no failing CI jobs except Vercel deployments failing only because they were
    rate limited.
- PR closeout: run `bun run beep yeet monitor` until it reports
  `merge-ready: yes`. Unanswered review threads are a hard merge gate — answer
  every one and resolve every actionable one via `bun run beep yeet reply`
  (drafts in `.beep/yeet/reply-drafts.json`); never ask the operator to relay
  them.
- Package handoff: any agent or sub-agent that edits a workspace package runs
  `bun run beep quality package-verify <@beep/package>` before handing the work
  back. Use `--quick` only when the touched surface justifies the lint+check
  subset. The default runs the package audit and docgen; failures arm the same
  checkout P0 inbox used by Yeet.
- Full git checkouts and tool clones never go under `/tmp` (tmpfs is zram-backed
  memory): agent worktrees belong in the sibling `-worktrees` root, disposable
  installs under `~/.cache/beep/`. `beep quality tmpfs-reap` is the janitor;
  retire a lane with `bun run beep worktree remove <name> --archive [--delete-branch]`.

## Touch → Skill / Command

If you touch this, load or run this first. Do not hand-author around it.

| Touch | Load / run |
| --- | --- |
| New workspace package | `bun run beep create-package` (do not `mkdir`) |
| New slice / concept / role file | `bun run beep architecture` |
| `packages/*/domain` or schemas | schema-first-development skill |
| Effect service / Layer | effect-first-development skill |
| JSDoc on exports | `.patterns/jsdoc-documentation.md` |
| Gesture-bearing UI | browser-qa-loop skill |
| PR publish / checks | yeet skill |

## Dev Servers

- Dev servers run only through the portless-wrapped package scripts
  (`http://<name>.beep.localhost:1355`). Never launch raw `vite`/`next`/
  `storybook dev` or test numeric localhost ports; `PORTLESS=0` is
  diagnostic-only.

## Browser QA

- Gesture-bearing UI milestones run the `browser-qa-loop` skill with recorded
  evidence via `bun run beep qa` (record → extract → judge); judge inventories
  are schema-validated (`qa-inventory/v1`).

## Docs & Knowledge

- `docs/` is tracked authored documentation (`docs/README.md` has the layout);
  `docs/_internal/` is private and must never be committed — this repo is
  public.
- Top-level `research/` is the nightly research routine's machine-generated
  intel surface (laws in `research/README.md`): packets are immutable, truth
  is per-packet `claims.jsonl` + single-writer `research/ledger/`, and the
  machine proposes via `SUGGESTED_ACTIONS.md` — agents never auto-append to
  `explorations/INBOX.md` or `goals/` from research output.
- same-PR packet-state flips: flip goal manifest/lifecycle status and land the
  closeout reflection in the same PR as the final work.
- Friction is a first-class output: when work is slower, harder, or riskier
  than it should be, record a receipt — what you were doing, the evidence
  (command, error text, PR/file), what would have prevented it — in the
  active packet's ledger (`research/OPPORTUNITIES.md`) at the moment it
  happens, never saved for closeout. This repo is public: before recording,
  redact secrets/tokens/credentials, replace absolute home paths with `~`,
  drop session/machine ids, and quote only the minimal identifying error text.

## Agent Memory

- File memory is the memory layer: each agent's own durable files
  (`CLAUDE.md` / `MEMORY.md` auto-memory) plus repo docs. There is no shared
  external memory service and no code-KG index; basic-memory and codegraph
  were removed on 2026-08-29 (`standards/memory-architecture/04-decision-log.md`).
  Do not reintroduce either or wire a successor without a new decision there.
- If context is missing, fall back to repo-local docs, code search, and this
  file.

## Tool Routing

- effect v3↔v4 differences: validate against the Effect reference checkout
  (`.repos/effect`, a machine-local symlink provisioned by
  `scripts/setup-effect-ref.sh`), never training-data priors.
- shadcn: editor app = app workspace, shared UI package = shared base; prefer
  the shadcn skill + shadcn MCP for registry discovery and installs.
- UI motion evidence comes from `bun run beep qa` artifacts. There is no QA
  MCP server; the `chrome-devtools` MCP is slim and default-disabled, for
  perf-trace/computed-style introspection during QA sessions.
- Codex Cloud security findings: export the CSV from the signed-in findings
  view, then `bun run beep codex findings ingest --from <export.csv>`; prefer
  the `codex-findings` skill. Never hand-build the packet.

## Context Economy

- Keep the MCP/tool surface stable within a session; settle `.mcp.json` and
  enabled tools before working, not mid-task.
- Always-loaded files (this file, skill frontmatter, settings) are the prompt
  cache prefix: batch edits to them, keep them lean; durable cross-session
  knowledge belongs in file-memory, not here.
- Continue related follow-ups on an existing subagent (SendMessage) instead
  of spawning fresh ones.
- Durable on-disk handoffs: agent/session transitions exchange deliverables as
  files on disk (packet `research/`, scratchpad), never chat-only summaries.
