# Design panel synthesis (workflow wf_<id>-97a, 2026-09-03)

## Ranking
- security: 8 — Cleanest public surface (PR number, branch, harness, entrypoint, workspace label, optional session label) and the only design that treats the operator's `cd "$BEEP_PROJECTS/<clone>"` as fileable and functionally wrong (Codex worktrees, session-home != clone). Number-only fence, XDG append-only JSONL registry, records appended from monitor/reply/closeout, transcript pr-link scan as a better-than-native fallback. Its critiques hold but are all incremental: branch-in-fence injection, derived-name suffix unexplained, 'session'/'resume' wording, Codex sandbox cannot write XDG, sessionHome source order, fork-aware pr-link scan, stamp must splice not overwrite.
- architecture: 7 — Best schema -> service -> impl spec (PrSessionLink extends PrProvenance, PrSessionRegistry with tagged error and memory layer, detection/nameSource LiteralKits, index-sessionId-must-match guard, live-session guard, hostHarness, boundary property test as the CSF-007 evidence, Flags precedent, changeset). Loses points on the public surface: it ships the `cd "$BEEP_PROJECTS/<clone-a>" && ...` block (a path template plus resume command, CSF-007's literal wording, and redundant because the resolver already owns cwd), publishes agentLabel by default including Codex names (a verified resume key), renders the branch in a fence at create time, and writes the registry only on `gh pr create` so scenario (g) fails.
- operator: 6.5 — Best answer to 'which agent(s)': an append-only ledger with parentAgent, roles, and the most thoroughly verified failure walk (live desktop sessions, CODEX_COMPANION_* mislabeling Claude publishes as codex on #946, .claude/worktrees transcript dirs, codesmith footer clobbering, exec-originated Codex rollouts). But the design as written has a fresh-PR block with no usable argument (number unknown at create, no post-create edit), treats the PR body as trusted input in the degradation ladder (label -> argv, clone -> cwd, reassert ingests footer rows), publishes free-text session names, uses a GFM table that `|` in a label can spoof, and spawns into live desktop sessions with no guard.

## Synthesis
## Verdict in one line

Take the security design's public surface, the architecture design's schema/service skeleton and live-session guard, and the operator design's multi-agent ledger and failure-walk fixes. Drop every `cd` and every path template from the PR body: the resolver owns cwd from a local registry, so the public block is `bun run beep yeet resume <n>` with the PR number as its only argument, and the footer answers "which clone / which agent(s)" with labels whose schemas structurally cannot hold a path, a UUID, or a harness-native resume command.

## Mechanism

**Publish side** (`PullRequest.ts` `buildPrBody` / `ensurePullRequest`):

1. `PrProvenanceService.detect` reads exact identity through `Config`/`ConfigProvider` only. Codex = exact `CODEX_THREAD_ID`; Claude = exact `CLAUDE_CODE_SESSION_ID`. `CODEX_COMPANION_*` is a Claude signal, never a Codex marker (this fixes the live bug that stamped #946 `Harness: codex` from a Claude session: `detectCodexEnvironment` today treats any `CODEX` config node as Codex). Both ids present -> `harness: codex`, `hostHarness: claude-code`.
2. Session home resolution order, tagged in the record as `sessionHomeSource`: (a) `CODEX_COMPANION_TRANSCRIPT_PATH` if set, else glob `~/.claude/projects/*/<sessionId>.jsonl`, first record's `cwd` (`transcript`); (b) `~/.claude/sessions/<CLAUDE_PID>.json` only when its `sessionId` equals the env id (`index`; also the sole source of `name`, `nameSource`, `entrypoint`); (c) checkout path (`checkout`). Codex: rollout header `cwd` from `~/.codex/sessions/**` and `~/.codex/archived_sessions/**` matched by filename thread id, bounded 2 s, else checkout path; record `originator`. `findRecentClaudeSession` is deleted: with exact ids in the environment the mtime heuristic is only the documented wrong-session hazard, and with no id the honest answer is `unknown`.
3. Git facts as today plus `rev-parse --short HEAD`; workspace label = `git config beep.workspace.label` else basename of the main clone; agent workspace label = same rule applied to the session home's main clone, published only when it differs (scenario a: session in `<clone-b>`, branch in `<clone-b>-pra`).
4. The create-time body renders the Provenance section WITHOUT the fence (number unknown). After `gh pr create` returns the URL, in the same process: parse `owner/repo/number`, append a `created` record to the registry, mirror it to `.beep/yeet/runs/<run-id>/provenance.json`, then `ensureProvenanceFooter(n)`. Verified ordering: with `--start-pr-early` this runs right after the early push, before the proof, so the stamp lands in seconds.
5. `ensureProvenanceFooter`: `gh pr view --json body` -> render from REGISTRY rows only (never ingest footer rows) -> splice strictly within `<!-- yeet-provenance:start -->` / `<!-- yeet-provenance:end -->` (insert before any foreign `<!-- x:footer -->` block when absent, so codesmith's tail survives) -> re-read immediately before `gh pr edit --body-file` -> write only on drift. Non-fatal. Runs after create, on the existing-PR branch of `ensurePullRequest` (which also appends a `pushed` record), at monitor start, after `reply`, in `closeout` and `merge`. Never per poll tick.
6. Every PR-touching Yeet command appends a record with a `role` (`created|pushed|verified|monitored|replied|closed|merged|linked`); `verify`/`repair` append branch-keyed records so Codex implementation lanes become discoverable; new `yeet link [--pr n]` registers a lane that never publishes. Records carry `childSession` (from `CLAUDE_CODE_CHILD_SESSION`) so a subagent publish still resumes the interactive parent.

**Resolve side** (`yeet resume <number|url> [--agent <seq|label>] [--list] [--print] [--exec] [--force] [--all] [--json]`):

1. `PrRef` schema (host allowlist, GitHub owner/repo charset, positive int); repository from the URL or `gh repo view --json nameWithOwner`.
2. Registry lookup; default target = newest `created|pushed` record (monitor/reply rows never win by default); `--list` prints every distinct session with role, harness, entrypoint, label, workspace, `~`-tokenized session home, recordedAt, live?, childSession.
3. Live guard (the common case: today every live index entry is `claude-desktop`): match `sessionId` against `~/.claude/sessions/*.json` AND `/proc/<pid>` exists with matching `procStart`; Codex checks `~/.codex/cross-instance-locks`. If live: print "live in desktop window <name> (workspace <label>, pid N) - open it there or SendMessage it" and stop; `--force` overrides. This alone answers the four-terminal hunt without spawning anything.
4. Dead session: spawn via `effect/unstable/process` argv arrays (no shell) with inherited stdio and `cwd = sessionHome`. Claude -> `claude --resume <id>`; when sessionHome is gone, retry from the clone whose munged project dir is a prefix of the transcript dir (the crossWorktree case the CLI supports). Codex -> `codex resume <threadId>` with cwd falling back to clonePath then HOME (UUID resume is cwd-independent); for `originator: codex_exec` print both `codex resume <id>` and `codex exec resume <id>` and mark the interactive one untested. `--print` emits the exact line to a TTY only, prefixed on stderr with "local-only: never paste into GitHub"; non-TTY prints the list.
5. Degradation ladder when no record exists: (A) Claude: scan `~/.claude/projects/*/*.jsonl` for `pr-link` with `prNumber == n`, keyed on the TRANSCRIPT FILENAME (not the record's sessionId, which forks copy), newest mtime wins, alternatives printed; strictly better than native `--from-pr`, whose index is last-wins per session (#946 lost to #950). (B) Codex: `gh pr view --json headRefName` -> `git worktree list --porcelain` -> match rollout header `cwd` within +/-30 min of the record or PR timeline; offer candidates. (C) Other machine or nothing: exit 4 printing workspace and agent labels decoded from the PR twin through `PublicPrProvenance` (data only: labels are matched by string equality against locally enumerated candidates, never concatenated into a path or passed as argv) plus a `claude --from-pr <n>` hint.

## Local state

Registry: `${BEEP_YEET_STATE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/beep/yeet}/pr-sessions/<host>__<owner>__<repo>.jsonl`, root via `Config` (mirrors `aiMetricsDataRootFlag`), directory 0700 and file opened with mode 0600 on create (no chmod-after window), append-only JSONL so concurrent yeets across 45 clones never read-modify-write; readers fold into `HashMap<number, NonEmptyArray<PrSessionRecord>>`. Append failure (Codex `-s workspace-write` denies `~/.local/state`) is non-fatal but loud with the exact `--add-dir` remedy, records `registryWrite: denied` in the run verdict, and the run-dir mirror is replayed by the next unsandboxed Yeet command that touches the PR. Retention: keep forever; `yeet sweep --prune-pr-sessions <days>` optional. Workstation-local by design, like the transcripts it points at.

Schema (`PrSessionRegistry.ts`): `PrSessionRecord extends PrProvenance` with `schemaVersion: S.Literal(1)`, `repository: {host, owner, name}`, `prNumber: S.OptionFromNullOr(PrNumber)`, `prUrl: Option`, `headSha: GitSha`, `runId`, `role: PrProvenanceRole`, `recordedAt: S.DateTimeUtc`. Local `PrProvenance` gains `sessionHome`, `sessionHomeSource`, `hostHarness`, `hostSessionId`, `entrypoint`, `sessionName`, `nameSource`, `checkoutPath`, `childSession`, `originator`, `detection`; `resumeCommand` leaves the model (`resumeCommandFor` stays a pure formatter for `--print`). Service `PrSessionRegistry` (Context.Service): `append`, `lookup(selector)`, `list`; `PrSessionRegistryError` tagged with `reason: LiteralKit(["io","decode","denied"])`; live layer over FileSystem/Path plus an in-memory layer for tests. All bodies `Effect.fn`.

## Public fields (schemaVersion 2) and why each survives a re-scan

- `pr` (Option<Int>): the page's own identifier.
- `branch`: public head ref, unchanged validation, escaped per context as today.
- `workspace` (`PrProvenanceLabel`: `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`, no `..`, no leading `.`/`-`, no `.lock`, rejects UUID shapes and >=16-hex runs): one path component with no root, separator, home token, or sibling fragment to concatenate with; information content = repository name plus disambiguator, the exposure class of a branch name. Rendered as "Workspace", never "clone"/"checkout". Rebuttal writable and pre-written (see below).
- `agents[]` (distinct sessions, newest first, cap 4): `harness` (LiteralKit claude-code|codex|unknown), `entrypoint` (LiteralKit from real values `claude-desktop|cli|sdk-cli|codex-exec|codex-tui|unknown`), `hostHarness` (Option, category only), `role` (LiteralKit), `workspace` (Option label, only when the session home differs from the PR workspace), `label` (Option `PrProvenanceLabel`).
- `label` policy, decided by the help text I verified: Codex session names are a first-class `codex resume` key, so a Codex row NEVER carries a label. Claude display names are only a picker search term, non-unique, not a store key; publish them only when `nameSource === "user"` and the slug passes; derived names (`<clone>-<xx>`, whose 2-hex suffix neither critic could derive from anything) stay registry-only. Git config `beep.provenance.agentLabel=off` mutes the field. Visible wording is "label", never "session name".
- The fence: `renderResumeFence(pr: PrNumber)` is typed on the integer, so a branch cannot reach a fence by construction; the branch form is accepted by `yeet resume` from the terminal only.

Forbidden by schema, not policy: any path or path template (including `$BEEP_PROJECTS/...`), any `cd`, any `claude --resume`/`codex resume`/`--from-pr`, every session/thread/host/bridge/companion id and any hash or truncation of them, pid, socket, hostname, username, Codex worktree hash, linked-worktree name, free-text titles. `renderPrProvenance` accepts only `PublicPrProvenance`; `toPublicPrProvenance` is the single projection site; the compile-time impossibility of passing `PrSessionRecord` to the renderer plus the boundary test file IS the "Already fixed" evidence.

Explicit statement on identifiers: this synthesis publishes no session UUID and no path anywhere in public text. The two fields an LLM re-scan could misread are `workspace` and a user-named Claude `label`; for both I can and will write the False-positive rebuttal in the CSF-007 follow-up note: (1) `PublicPrProvenance` v2 has no id or path field by construction; (2) `yeet-pr-provenance-boundary.test.ts` proves, property-style over arbitrary local models, that the rendered body contains no `/`- or `~`-rooted path, no `$VAR/`, no `cd `, no `--resume`/`codex resume`/`--from-pr`, no UUID-shaped token, no >=16-hex run, none of the local model's identifier values, no `-->`, and exactly one fence whose body matches `^bun run beep yeet resume [1-9][0-9]*$`; (3) the label resolves only against local stores and only as a non-unique picker filter, the same exposure class as a branch name resolving a local worktree via `git worktree list`; (4) Codex names, which the harness does resolve, are excluded by schema (`label` is constructed only from a Claude `nameSource: user` record). I would not attempt a rebuttal for a published UUID; that is why it is excluded by type.

## Code changes

- `commands/Yeet/internal/Provenance.ts`: LiteralKits `PrProvenanceEntrypoint`, `PrProvenanceRole`, `PrProvenanceDetection`, `PrProvenanceNameSource`, `PrProvenanceSessionHomeSource`; `PrProvenanceLabel`; `ClaudeSessionIndexEntry`; extended local `PrProvenance`; `PublicAgent`, `PublicPrProvenance` v2, `PublicPrProvenanceAny = S.Union(v1, v2)` for reading old footers; `toPublicPrProvenance`, `renderPrProvenance(public)`, `renderResumeFence(PrNumber)`, `parsePrProvenanceFooter`, `splicePrProvenanceFooter`; detection rewritten as above; delete `findRecentClaudeSession`; `git config` reads via `runGitOutput`.
- `internal/SessionIndex.ts` (new): `readClaudeSessionIndexEntry`, `findClaudeTranscriptById`, `findLiveClaudeSession` (index + `/proc` start time), `findCodexRollout`, `findCodexRolloutsByCwd`.
- `internal/PrSessionRegistry.ts` (new), `internal/ProvenanceReassert.ts` (new), `internal/Resume.ts` + `Resume.schemas.ts` (new: `PrRef`, `YeetResumeOptions`, `HarnessResumer` service, ladder, guard, spawn).
- `internal/PullRequest.ts`: fence-less create body; post-create append + mirror + `ensureProvenanceFooter`; existing-PR branch appends `pushed` and reasserts.
- `Yeet.command.ts`: `resume` and `link` subcommands, `publish --agent-label`; Verify/Repair/Monitor/Reply/Closeout/Merge append records with roles; PR-touching ones reassert; `status --json` shows latest link and footer present/missing; Planner gains `publish:pr-provenance-stamp`.
- `internal/cli/Flags.ts` + `EnvConfig.ts`: `yeetStateRootFlag`; Config readers for `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_HOST_SESSION_ID`, `CLAUDE_CODE_CHILD_SESSION`, `CODEX_THREAD_ID`, `CODEX_COMPANION_TRANSCRIPT_PATH`, `BEEP_AGENT_LABEL`. `turbo.json` passthrough for the same.
- Tests: rewrite `yeet-pr-provenance.test.ts` for v2 (companion vars without thread id -> claude-code; index pid mismatch -> checkout source; codex-in-claude -> hostHarness); new boundary property test (above), label schema rejections (`/ ~ $ | \` < > & whitespace .. -x .x`), derived Claude name -> no label, codex -> never a label, hostile twin (`--dangerously-skip-permissions`, `..`, `a|b`) fails decode and never reaches spawn or registry; registry append/lookup under fixture XDG with 0600 mode, denied-write mirror + replay, two PRs one session, corrupt line skipped; reassert splice idempotency and foreign-footer preservation; resume ladder rungs, live guard, `--print` TTY gate, exit 4 on another machine; command wiring; `PrRef` rejects `..`.
- Test-kit `test/Yeet` re-exports; changeset `@beep/repo-cli: minor`; `.claude/skills/yeet/SKILL.md`: `yeet resume`/`link`, Codex lane recipe adds `--add-dir` for the state root, laws "never `gh pr edit --body` over a Yeet PR" and "never paste `--print` output into GitHub"; CSF-007 follow-up note with the rebuttal above in `goals/codex-security-findings-2026-08-13/findings/CSF-007.md`, written in the same PR.
- Handoff: `bun run beep quality package-verify @beep/repo-cli`, `bun run docgen:local`, publish with `bun run beep yeet publish --start-pr-early --monitor --pr`. Validate `effect/unstable/process` spawn, `FileSystem` open-with-mode/append, `S.DateTimeUtc`, and `Prompt` against `.repos/effect` before writing.

## Grafts and accepted critiques

From security: number-only fence, exclusion by schema + negative test, XDG JSONL, entrypoint, transcript pr-link scan, verdict on `$BEEP_PROJECTS`. From architecture: `PrSessionRecord extends PrProvenance`, registry service/error/memory layer, detection LiteralKits, index-sessionId-must-match, live guard with `--force`, `hostHarness`, boundary property test as evidence, Flags precedent, changeset. From operator: distinct-agent ledger with roles and parent harness, run-dir mirror + replay, splice-on-drift, degradation ladder, and the failure-walk facts (CODEX_COMPANION mislabel, live desktop sessions, `.claude/worktrees` transcript dirs, codesmith footer, exec-originated rollouts, fork-copied sessionIds).

Accepted critiques: branch-in-fence injection (all three); derived-name evidentiary hole and Codex-name-is-a-key (security and architecture critics); 'session'/'resume' wording; PR body as untrusted input and reassert never ingesting footer rows; positive-allowlist labels; free-text names gated to user-named Claude only; table spoofing (bullets instead of a table); create-time number gap; Codex sandbox registry denial; monitor rows must not become the default target; sessionHome transcript-first; delete the mtime heuristic; atomic 0600 create; `--print` TTY gate; stale-clone `resume` missing (footer says "up-to-date checkout"; operator-owned shim optional); PrRef validation; exit code for the no-record machine.

Rejected critique points: exec-vs-print default (kept exec, because the live guard removes the dangerous case and one paste landing in the session is the feature); publishing `head`/`publishedAt` in the twin (harmless but adds nothing the PR lacks; the twin stays a lookup key).

## Recommended footer
---

<!-- yeet-provenance:start -->
## Provenance

- Workspace: <code><clone-a></code>
- Branch: <code>feat/time-to-certainty-p0</code>
- Agents (newest first):
  - `claude-code` (desktop) · label <code><USER_LABEL></code> · pushed
  - `codex` (exec, via `claude-code`) · linked
  - `claude-code` (desktop) · workspace <code><clone-b></code> · created

Reopen the publishing agent from any up-to-date beep-effect checkout on the publishing workstation (the local Yeet registry resolves it; nothing in this block is a path or an identifier):

```sh
bun run beep yeet resume 950
```

<!-- yeet-provenance
{
  "schemaVersion": 2,
  "pr": 950,
  "branch": "feat/time-to-certainty-p0",
  "workspace": "<clone-a>",
  "agents": [
    { "harness": "claude-code", "entrypoint": "claude-desktop", "hostHarness": null, "label": "<USER_LABEL>", "workspace": null, "role": "pushed" },
    { "harness": "codex", "entrypoint": "codex-exec", "hostHarness": "claude-code", "label": null, "workspace": null, "role": "linked" },
    { "harness": "claude-code", "entrypoint": "claude-desktop", "hostHarness": null, "label": null, "workspace": "<clone-b>", "role": "created" }
  ]
}
-->
<!-- yeet-provenance:end -->

Notes on the example (not part of the footer): the create-time body carries the same section without the "Reopen..." sentence and fence, with `"pr": null`; the post-create stamp adds both seconds later, and monitor/reply/closeout/merge re-add them if a `gh pr edit` erased the block. `label` appears only for a Claude session the operator named (`claude --name`); derived names and every Codex name stay in the local registry. `workspace` inside an agent row appears only when that session's home differs from the PR workspace (row 3 is scenario a: session started in <clone-b>, branch published from <clone-b>-pra). A single-agent PR renders one bullet. Harness `unknown` renders `unknown` with no entrypoint. Variable strings are `<code>`-wrapped and HTML-escaped; LiteralKit values use backticks.

## Rejected ideas
- `cd "$BEEP_PROJECTS/<clone>"` (or `${BEEP_PROJECTS:?...}`) in the PR body: a path template plus resume command, redundant because the resolver owns cwd, wrong for Codex worktrees and session-home != clone.
- Any branch name inside the sh fence: PrProvenanceBranch admits `$ ( ) ; | & \` and quotes (the repo's own fixture proves it), and the block exists to be pasted; the fence renderer is typed on the PR integer.
- Publishing any session/thread/host/bridge/companion id, or a hash, prefix, or truncation of one: no False-positive rebuttal exists, so exclusion is by type plus negative test.
- Publishing Codex session names: `codex resume` resolves names as keys.
- Publishing derived Claude names by default: the suffix's derivation is unknown, which fails the pipeline's evidentiary burden.
- GFM table rendering of the ledger: `|` in a label spoofs cells; bullets need no escaping regime.
- Per-clone `.beep/yeet/runs` or `~/.cache/beep` as the registry authority: dies with the worktree or is disposable; kept only as a mirror.
- Native `claude --from-pr` as the primary mechanism: last-wins per session (#946 lost to #950), per-project picker still needs a cd, absent for Codex; kept as a printed hint.
- Reassert ingesting footer rows into the registry, or building cwd/argv from footer labels: the PR body is untrusted input; labels are matched by equality against locally enumerated candidates only.
- Keeping `findRecentClaudeSession` as a fallback: the documented wrong-session hazard.
- Splicing 'from `## Provenance` to end of body': clobbers codesmith's appended footer and starts an edit war.
- Spawning `claude --resume` into a live desktop session without a guard: two writers on one transcript and a forked conversation.
- Linked-worktree name as a public field: the branch already identifies it and clone+worktree starts to reconstruct the -worktrees tree; shown in `resume --list` instead.
- Free-text session titles (custom-title, ai-title, agent-name) in the PR: unbounded operator or model text.
- `head`/`publishedAt` in the JSON twin: public already but add nothing the PR lacks; the twin stays a lookup key.
- Print-by-default for `yeet resume`: turns the one-paste bookmark into two pastes; the live guard already removes the case that made exec risky.
- Introducing `BEEP_PROJECTS` in v1 at all: only the no-registry rung would use it, and the pr-link transcript scan plus the Codex session-store cwd scan cover that rung without a dotfile edit; it can be added later strictly as an enumeration root, never concatenated with a footer value.

## Grill frontier (panel-proposed)
### Q1. Public block shape: does the PR body carry any `cd` at all?
- A. `bun run beep yeet resume <n>` only; the resolver owns cwd from the registry; from-any-shell via an operator-owned `~/.local/bin/beep-yeet-resume` shim that never appears in the PR
- B. Your `cd "$BEEP_PROJECTS/<clone>" && bun run beep yeet resume <n>`
- C. `cd "${BEEP_PROJECTS:?export BEEP_PROJECTS=...}/<clone>" && ...` (fails loudly when unset)

Recommended: A

Why: The `cd` is redundant: `yeet resume` spawns the harness with cwd = the recorded session home, and any up-to-date checkout can run it. B and C are a path template plus a resume command, CSF-007's literal wording; they assert one level of clone structure, are functionally wrong for Codex worktrees under ~/.codex/worktrees and for session-home != clone (scenario a), and the shim gives you the same one-paste ergonomics with zero path text in the PR. This decides whether BEEP_PROJECTS exists at all, so it comes first.

### Q2. Agent label policy in the public footer
- A. Publish only Claude labels with nameSource=user that pass the slug schema; derived names and all Codex names stay registry-only; `beep.provenance.agentLabel=off` mutes it
- B. Also publish derived Claude names (`<clone>-<xx>`) with a written False-positive rebuttal
- C. No labels in the PR; harness + entrypoint + workspace only; names via `yeet resume --list`

Recommended: A

Why: Verified help text: `codex resume` takes 'Session id (UUID) or session name', so a Codex name is a real resume key and cannot be defended; `claude --resume [value]` is 'session ID, or picker with optional search term', so a Claude display name is a non-unique local filter and the rebuttal holds. Derived names carry a 2-hex suffix neither critic could derive from anything, so the pipeline's evidentiary burden is not met; if you want at-a-glance names, name the sessions you care about with `claude --name`. C loses the glance you asked for.

### Q3. Workspace label source and default
- A. Default = basename of the main clone, override via `git config beep.workspace.label`
- B. Require the git config; render `unlabeled` otherwise
- C. Yeet-minted opaque id (`o-7f3a`) with the name only in the registry

Recommended: A

Why: A single path component with no root, separator, or sibling fragment answers 'which clone' immediately and has the exposure class of a branch name; the schema forbids everything path-shaped and the boundary test proves no `/` or `~` reaches the body. B is useless until you configure 45 clones; C is bulletproof but loses the glance. C remains a renderer-only swap if the re-scan surprises us.

### Q4. Multi-agent ledger in the footer
- A. Publish distinct sessions (cap 4) as bullets with harness, entrypoint, host harness, role, differing workspace, and label per decision 2
- B. Publish only the latest publisher; full list via `yeet resume --list`
- C. Publish the ledger as a GFM table

Recommended: A

Why: Scenario g (Codex lane + Fable publisher) is your stated pain, and every extra row is the same field class as one row. Bullets over a table because `|` in a label spoofs GFM cells (labels are slug-constrained anyway, but bullets need no escaping regime). B hides exactly the second agent you keep hunting for.

### Q5. How Codex lanes reach the registry under `codex exec -s workspace-write`
- A. `BEEP_YEET_STATE_ROOT` via Config + `--add-dir <state root>` in the lane recipe, non-fatal loud append, run-dir mirror + replay, `yeet link` for non-publishing lanes, and `verify`/`repair` append branch-keyed records
- B. No lane writes; rely on resume-time Codex session-store cwd scan and commit trailers
- C. Parent Fable session harvests a `[yeet] provenance-row:` stdout line from the lane

Recommended: A

Why: A makes the Codex lane a first-class writer in the lane that most often authors the branch; the Codex worktree is ephemeral so the run-dir mirror alone is unreachable later. B and C are kept as fallbacks anyway (the session-store scan is the no-record rung), but they should not be the primary path. Requires one line in the yeet skill's lane recipe; nothing in your dotfiles.

### Q6. `yeet resume` default action
- A. Exec in place with inherited stdio after a live guard (if the session is live, print its window name/workspace/pid and stop; `--force` overrides), `--print` for the terminal-only line
- B. Print the resolved line by default, `--exec` to spawn

Recommended: A

Why: One paste landing in the session is the feature. The live guard removes the dangerous case (today every live session is claude-desktop; forking one into a terminal is wrong), so exec only ever runs into a dead session. The nesting concern (Ink under bun) is the same class as git spawning an editor; `--print` covers the rare hang. B turns one paste into two.

### Q7. Footer re-assertion cadence and splice rule
- A. Stamp after create; re-assert at monitor start, after reply, in closeout and merge; splice only within start/end markers, insert before foreign `<!-- x:footer -->` blocks, re-read before edit, write on drift only, registry rows as the sole source
- B. Stamp after create only; accept #947-style loss
- C. Also re-assert every monitor poll tick

Recommended: A

Why: #947 and #950 already lost their footers to `gh pr edit`; durability is the point. Marker-bounded splicing keeps codesmith's tail intact and never ingests footer rows (the PR body is untrusted input). C burns GraphQL budget for nothing.

### Q8. Registry location and retention
- A. XDG state, one append-only JSONL per repository, keep forever, optional `yeet sweep --prune-pr-sessions <days>`
- B. One JSON file per PR with atomic tmp+rename
- C. `~/.cache/beep/` or per-clone `.beep/` as the authority

Recommended: A

Why: Append-only JSONL never read-modify-writes, so concurrent yeets across 45 clones cannot race; XDG state survives `worktree remove --archive`; ~/.cache is disposable and per-clone dies with the worktree (the run-dir copy stays a mirror only). Files are one line per event; pruning is a valve, not a need.

### Q9. Delete `findRecentClaudeSession` outright?
- A. Delete; with no exact id the harness is honestly `unknown`
- B. Keep as last fallback for headless/SDK launches without CLAUDE_CODE_SESSION_ID

Recommended: A

Why: Exact ids come from the environment now (subagents inherit the parent's), and the mtime heuristic is the documented wrong-session hazard in a 45-clone workstation; an `unknown` row is better than a confidently wrong resume target, and `--from-pr` plus the pr-link scan still cover headless sessions.

### Q10. Ship the CSF-007 follow-up note and the operator shim now?
- A. Write the Already-fixed/False-positive note with the pre-written rebuttal in the same PR; you create `~/.local/bin/beep-yeet-resume` yourself
- B. Wait for the re-scan before writing anything

Recommended: A

Why: The pipeline offers only Already-fixed or evidence-backed False-positive; having the renderer signature, label schemas, and the boundary test file cited before the scan makes the disposition mechanical. The shim is your dotfile territory (agents never edit it unprompted) and is the only thing that makes the paste work from a shell at `~`.

