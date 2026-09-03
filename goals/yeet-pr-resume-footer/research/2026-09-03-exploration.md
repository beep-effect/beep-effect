# PR provenance footer revival — exploration facts (2026-09-03)

Owner: the Fable orchestrator session for this packet (a claude-desktop session in the publishing clone).

## History of the feature

| PR | Commit | What |
| --- | --- | --- |
| #637 | `4ec4cd15cd` | `feat(repo-cli): stamp yeet PRs with a provenance footer`. Footer = Clone, Worktree, Branch, Harness, a `sh` code block with `cd <path> && claude --resume <id>` / `codex resume <thread>`, and a `<!-- yeet-provenance {json} -->` twin carrying the full local model (paths + session id + resume command). |
| #650 | `4fe0670d5b` | Home-prefix tokenization (`<home>/...` -> `~/...`). Closed Codex finding CSF-005 (packet `codex-security-findings-2026-08-10`) as already-fixed. |
| #685 | `5745327c2f` | CSF-007 (packet `codex-security-findings-2026-08-13`, Codex ID `14981c9702288191a821494c38525185`, Medium): "Yeet PR footer leaks local paths and AI session IDs. Home-prefix tokenization alone does not make those fields public-safe." Fix: public projection `PublicPrProvenance = {schemaVersion:1, branch, harness}` only. Paths, resume command, session id stay in the local `PrProvenance` model, which nothing consumes any more. |

Codex-findings skill law: on re-detection the only dispositions are `Already fixed` or an evidence-backed `False positive`. **Accepted risk is not available.** So whatever ships must be defensible as not-a-leak, not merely low-risk.

## Current code (main, `88fa371cb0`)

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts` (686 lines): schemas `PrProvenancePath`, `PrProvenanceBranch`, `PrProvenanceHarness` (LiteralKit `claude-code|codex|unknown`), `PrProvenance` (local), `PublicPrProvenance` (public); `tokenizeHomePath`, `findRecentClaudeSession` (mtime heuristic over `~/.claude/projects/<munged>/*.jsonl`, 6h window, wrong-session hazard documented), `resumeCommandFor`, `renderPrProvenance`, `PrProvenanceService` (Context.Service, `detect(cwd, branch)`), `detectCodexEnvironment` (`CODEX` node / `CODEX_THREAD_ID` via ConfigProvider), `detectGitPaths` (`--git-common-dir` + `--show-toplevel`), 2s timeout, unknown fallback.
- Consumer: `PullRequest.ts:205-207` renders the footer into the PR body **only at `gh pr create --body-file`** time. No later re-assertion. `GateStaleness.ts` no longer consumes provenance.
- Tests: `test/yeet-pr-provenance.test.ts` (382 lines, 8 `it`s) via `@beep/repo-cli/test/Yeet` test-kit re-export.
- Live footer today (PR #945): `## Provenance` with Branch + Harness + JSON twin `{schemaVersion, branch, harness}`.
- PR #947 has **no footer at all**: yeet created it, then the agent ran `gh pr edit` twice and rewrote the body. Footer durability is a real gap.

## Harness identity available at publish time (verified in this session's Bash env)

Claude Code (2.1.259 CLI; desktop entrypoint 2.1.255):

- `CLAUDE_CODE_SESSION_ID=<uuid>` — exact session id. Also `CLAUDE_PID`, `CLAUDE_CODE_ENTRYPOINT=claude-desktop|cli|sdk-cli`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_HOST_SESSION_ID`.
- Codex-companion plugin adds `CODEX_COMPANION_SESSION_ID` (= Claude session id) and `CODEX_COMPANION_TRANSCRIPT_PATH=~/.claude/projects/<munged-session-home>/<id>.jsonl` (persisted via `~/.claude/session-env/<id>/`).
- `~/.claude/sessions/<CLAUDE_PID>.json` live index: `{pid, sessionId, cwd, name, nameSource: derived|user, entrypoint, kind, startedAt, bridgeSessionId}`. Names look like `<clone>-<xx>` (derived) or `SHIP_VELOCITY`, `SEMANTICA_CANARY` (user-named via `--name`/rename). Only exists while the process lives.
- Transcript metadata records (durable): `custom-title` (desktop conversation title), `agent-name`, `ai-title`, **`pr-link` `{sessionId, prNumber, prUrl, prRepository, timestamp}`**, `worktree-state`, `bridge-session`.
- **`claude --from-pr <number|url>`** (native): resumes the session linked to a PR. The link is written by `linkSessionToPR` (transcript `pr-link`, telemetry `tengu_session_linked_to_pr`); observed for yeet-created PRs #946, #947, #950 (not #944/#945, which came from Codex). Index semantics are **last-wins per session**: session `<id>` linked #946 then #950, so `--from-pr 946` will not find it. Scope: the picker is per-project like `--resume`, so a `cd` to the session home is still needed.
- `-n, --name <name>` sets display name; `--resume` takes a session ID (picker otherwise).
- Session home vs work clone are distinct (speed-loop #79 design correction): the session is keyed to the directory it started in, which may differ from the clone the work landed in. Resume must `cd` to the **session home**.

Codex (`codex 0.152.1`):

- `CODEX_THREAD_ID` env in Codex sessions. `codex resume <SESSION_ID|name>` — "UUID or session name; UUIDs take precedence"; picker is cwd-filtered, `--all` disables filtering. Session store `~/.codex/sessions/YYYY/MM/DD/*.jsonl` with `{id, cwd, originator, cli_version}` in the header.
- Codex worktrees live at `~/.codex/worktrees/<hash>/<clone>` — **outside** the projects root.

## Workstation layout

- The projects root holds several dozen clones of this repository plus `<clone>-worktrees` siblings per `standards/git-worktrees.md`; clone basenames are the only layout fact the feature needs.
- No `BEEP_PROJECTS`-style env var exists yet in `~/.zshrc`.
- `turbo.json` already passes through `BEEP_AGENT_SESSION_ID`, `CLAUDE_SESSION_ID`, `CODEX_SESSION_ID`, `CODEX_THREAD_ID` — but nothing in the repo reads `BEEP_AGENT_SESSION_ID` or `CLAUDE_CODE_SESSION_ID` today.
- State-dir precedent: ai-metrics uses `${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics`. Yeet run artifacts live in `.beep/yeet/runs/<run-id>/` (repo-local, ignored).

## Doctrine touchpoints

- `06-configuration-boundaries.md`: env through `Config`/`ConfigProvider`, never direct `process.env`.
- `07-non-slice-families.md`: repo-operational code is `tooling`; `@beep/repo-cli` is the owner.
- `standards/git-worktrees.md`: worktree root is `<checkout-root>-worktrees`, sibling to the clone.
- Repo law: schema-first, `LiteralKit` literal domains, `Effect.fn`, HashMap/HashSet only, JSDoc `**Example** (Title)`.
- Yeet subcommands today: verify, repair, publish, monitor, closeout, status, sweep, merge, reply. No `resume`.

## Operator pain (from speed-loop OPPORTUNITIES #79)

"A four-terminal hunt for which session originated #578; the recurring wrong-agent 'fix PR #X' backtrack." Wants: which clone, which agent(s), a copy-pasteable resume block, durability across terminal death.
