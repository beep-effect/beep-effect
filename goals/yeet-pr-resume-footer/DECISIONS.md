# Yeet PR resume footer — ratified decisions

Ratified by Benjamin 2026-09-03 in a `/grill-with-docs` session (Fable
orchestrator; three-lens design panel red-teamed by a Codex-finding simulator
and an operator-failure critic, then judged). Binding for the packet; changes
require a new ratification line with a date.

Prior art: PR #637 added the footer, #650 tokenized the home prefix
(CSF-005), #685 restricted the public footer to branch + harness (CSF-007,
"Yeet PR footer leaks local paths and AI session IDs"). The Codex findings
pipeline offers only `Already fixed` or evidence-backed `False positive`, so
every public field below must be defensible as not-a-leak, not merely low risk.

1. **Public block = PR number only.** The fence is exactly
   `bun run beep yeet resume <n>`; a local registry keyed by repository and PR
   number resolves harness, session id, and the session home. No `cd`, path
   template, env-var name, or harness resume command appears in the PR.
   Rejected: `cd "$BEEP_PROJECTS/<clone>" && …` (a path template plus a resume
   command is CSF-007's literal wording; wrong when the session home differs
   from the work clone and for Codex worktrees under `the Codex worktree root`);
   native `claude --from-pr` as the only mechanism (Claude-only; its index is
   last-wins per session, so #946 became unreachable once the same session
   opened #950). `BEEP_PROJECTS` is not introduced.
2. **Labels.** Claude display names of `user` and `derived` source are
   published when they pass the slug schema (`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`,
   no `..`, no `.lock`, no UUID shape, no ≥16-hex run); Codex names are never
   published because `codex resume <name>` resolves them as keys; git config
   `beep.provenance.labels=off` mutes the field. Rationale: `claude --resume`
   accepts only a UUID, so a Claude display name is a picker filter, not a
   resume key. Rejected: user-named only (most sessions are derived-named, so
   most PRs would show no agent); no labels.
3. **Scope.** PR 1 = exact-identity detection (fixes the live bug where
   `CODEX_COMPANION_*` env made Claude publishes render `Harness: codex`),
   append-only XDG registry, footer v2 with a bulleted agent ledger, post-create
   stamp, `yeet resume`, re-assert on `monitor`, boundary property test,
   CSF-007 follow-up note, changeset, packet. PR 2 = `yeet link`, verify/repair
   rows, re-assert on reply/closeout/merge, Codex-lane `--add-dir` recipe.
   Rejected: everything in one PR; minimal bookmark without re-assertion (PR
   #947 lost its footer to a later `gh pr edit`).
4. **Packet.** This goal packet graduates speed-loop OPPORTUNITIES #79; grill
   decisions live here; packet-state flips land in the same PR as the work.
5. **`yeet resume` default = exec with live guard.** If the recorded session is
   alive (`the Claude session index` with matching `sessionId` and a live
   `/proc/<pid>`), print window name, workspace, and pid and stop; `--force`
   overrides. Otherwise spawn the harness in the recorded session home with
   inherited stdio (`claude --resume <id>` / `codex resume <thread>`).
   `--print` shows the resolved command for the terminal only; `--list` shows
   every recorded agent. Rejected: print by default (one paste becomes two).
6. **Model in the ledger.** The latest assistant `model` from the session
   transcript is published as a validated slug (`unknown` when unreadable).
   A model id is public information and answers "which agent" more precisely
   than harness alone under the operator's model-routed sessions.
7. **Stamp on monitor.** Any PR that `yeet monitor` touches gets a `monitored`
   ledger row and the footer (re-)asserted, so hand-created PRs become bookmarks
   too. Default resume target = newest `created|pushed` row, else the newest row
   of any role. Rejected: only yeet-created PRs.

Fable calls (not grilled; revisit if they bite):

- Workspace label = basename of the main clone (`git rev-parse --git-common-dir`
  parent); override via `git config beep.workspace.label`. Linked-worktree
  names are not published (the branch identifies them; `yeet resume --list`
  shows them locally).
- Registry = append-only JSONL, one file per repository, under
  `${BEEP_YEET_STATE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/beep/yeet}/pr-sessions/`,
  directory 0700 and file 0600 on create, kept forever; each row is mirrored
  to `.beep/yeet/runs/<run-id>/provenance.json`.
- `findRecentClaudeSession` (mtime heuristic) is deleted; no exact id means
  harness `unknown`.
- The ledger renders as bullets (never a GFM table), distinct sessions, newest
  first, cap 4.
- Post-create stamp = `gh pr edit --body-file` right after `gh pr create`
  returns the URL; non-fatal, logged.
- Footer splice is marker-bounded (`<!-- yeet-provenance:start/end -->`),
  replaces a legacy v1 `## Provenance` block, else appends; registry rows are
  the only source.
- Review round 1 (2026-09-03, `history/2026-09-03-review-round-1.md`): a UUID
  or long hex run inside the branch name is not a footer leak because the head
  ref is already public on the PR page, so branches are published unchanged;
  the boundary property varies every public field and asserts the UUID/hex
  exclusions after removing branch occurrences. `PrProvenanceModel` rejects
  UUID shapes and ≥16-hex runs like labels do (rejected values render as
  `unknown`). The Claude `pr-link` fallback is scoped to the current repository.
