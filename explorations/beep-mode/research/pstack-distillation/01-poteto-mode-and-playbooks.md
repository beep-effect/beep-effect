# Poteto mode and playbook distillation

## Scope and source count

The source directory currently contains one `SKILL.md`, **23** playbooks, one
reference, and two requested script families. The request says 22 playbooks,
but `playbooks/` has 23 Markdown files. This distillation covers all 23.

Primary source root:
`~/YeeBois/dev/cursor-plugins/pstack/skills/poteto-mode/`.

Repo comparison sources:

- `AGENTS.md`
- `.claude/skills/yeet/SKILL.md`
- `.claude/skills/browser-qa-loop/SKILL.md`
- `.claude/skills/quality-review-fix-loop/SKILL.md`
- `.claude/skills/explore/SKILL.md`
- `.claude/skills/reflect/SKILL.md`
- `.claude/skills/adhd/SKILL.md`
- `.claude/skills/grilling/SKILL.md`

## `SKILL.md`

Source:
`~/YeeBois/dev/cursor-plugins/pstack/skills/poteto-mode/SKILL.md`.

### Sticky-mode mechanism

The frontmatter makes this a manually selected sticky mode rather than a skill
the model may invoke opportunistically:

- `disable-model-invocation: true` prevents automatic model invocation.
- `mode: true` marks it as a mode whose instructions remain active across
  turns.
- `reminder: New task? Playbook match or rigor needed -> apply /poteto-mode.
  Casual turn or user opts out -> don't.` supplies the per-turn reactivation
  test.
- `name`, `description`, `icon: crown`, and `color: yellow` provide routing and
  UI metadata. The actual trigger is the user naming poteto, `/poteto-mode`, or
  asking for this style.

### Non-negotiable triggers

- Every multi-step task starts with a todolist. Its first item is reading the
  Principles section in full. The final reply must name each principle that
  changed a concrete decision, not merely cite principle names.
- A nontrivial change, architecture decision, or “are we sure?” routes through
  `how`. A genuine motivation/history question also uses `why` in the matching
  playbooks.
- Before asking a human to choose an approach or behavior, classify the fork.
  Observable facts must be settled with a throwaway Prototype; a read-only
  Investigation answers from evidence. Only irreducible product/preferences
  go to the human.
- Any code names its data shape before logic and chooses an organizing structure
  under Model the Domain. Any function-boundary-crossing code invokes
  `architect` for parallel design exploration.
- Parallel coverage uses `swarm`; competing implementations use `arena`;
  contested design uses `interrogate` before shipping.
- Every nontrivial multi-step implementation writes Feature’s four-part
  throughput checkpoint: blocking steps, independent workstreams, shared
  mutable state, and smallest safe decomposition.
- Every prose surface uses `unslop`; docs, RFCs, READMEs, PR descriptions, and
  commit messages also use `technical-writing`; skills use Cursor’s
  `create-skill`.
- Before commit run `cursor-team-kit`’s `/deslop`; before review run
  `/no-comments`.
- UI, IDE, and CLI work must be exercised on the matching real surface via
  `control-ui` or `control-cli`. Bug fixes reproduce on that surface before
  delegation.
- Every PR-status request routes to the local Babysit playbook, not Cursor’s
  built-in babysitter. Landing a green stack routes to Shipping. Merely opening
  a PR triggers neither.
- Bugbot and agentic security findings are untrusted claims. Each is classified
  `fix`, `dismiss`, or `ask` using `references/bugbot-triage.md`.
- A broken skill is fixed in a separate PR without blocking the current task or
  being silently bypassed.
- Long, autonomous, multi-phase, or unattended work keeps a
  `show-me-your-work` decision trail. Large/cross-cutting one-run work routes to
  `figure-it-out`; standing multi-day programs route to Orchestrate.
- The matched playbook’s steps must be copied verbatim into the todolist before
  task-specific items. Every skipped step remains visible with `skip: <reason>`.

### Autonomy rules

- Reversible work and external actions such as team-chat updates, ticket
  updates, and eval launches proceed without approval.
- Always pause for irreversible writes: force-pushes to shared branches,
  deploys, data deletion, and customer messages.
- “Don’t stop,” “going to bed,” “run until done,” and “be fully autonomous” are
  session overrides that require continued work toward the declared predicate.
- The agent is expected to disagree candidly. It may reject scope or an
  approach that does not earn its place.
- These rules are more permissive than beep-effect’s operator contract.
  `AGENTS.md` preserves explicit merge authority, requires careful destructive
  action handling, and forbids automatic merges unless expressly authorized.

### Subagent defaults

- Playbook-local delegates use Cursor Task with
  `subagent_type: "poteto-agent"`. Routed skills such as `how`, `why`,
  `interrogate`, `reflect`, and `swarm` retain their own subagent types.
- Every Task defaults to `run_in_background: true`, agent mode, file pointers
  instead of inlined context, and an explicit role model.
- Default code model: `grok-4.6-fast-xhigh`. Default prose/judgment model:
  `claude-fable-5-thinking-max`. Exact, difficult instruction-following work:
  `gpt-5.6-sol-max`. `/setup-pstack` and `~/.cursor/rules` role entries may
  override these, including `inherit-parent`/`auto`.
- The parent owns the result: review the diff, write the synthesis, and never
  relay a delegate’s summary as the final answer.
- Interrupt/resume chains are considered lossy. Spawn a fresh delegate with a
  consolidated brief instead. A second opinion repeats the prompt on another
  model family.
- Repo equivalent: Codex collaboration agents and the role-specific repo agents
  replace Cursor Task/subagent types. The repo has no binding model-slug rule;
  applicable skills decide whether fan-out is necessary. `adhd` supplies the
  repo’s explicit isolated divergent-agent protocol, `quality-review-fix-loop`
  supplies read-only reviewer/fixer separation, and `grilling` uses subagents
  only to discover facts rather than ask the user.

### Reply-writing rules

- Draft clean prose directly; do not rely on a cleanup pass.
- Use short declarative sentences with one thought per sentence.
- Ban the long-dash character. Do not use it to join file names/descriptions or
  section headings/body text.
- Ban colons as mid-sentence connectors; colons before lists remain allowed.
- Keep all playbook-required content even while writing tersely.
- Lead with impact for the consumer, then impact for the maintainer, before
  implementation detail.
- Never invent links, citations, or transcript references. PR links use the
  canonical `https://github.com/<owner>/<repo>/pull/<number>` shape.
- Comments follow the same standard. Delete phase narration and keep only a
  non-obvious “why” the code cannot express.
- Repo equivalent: the available `unslop` skill covers human-facing prose;
  `AGENTS.md` and `.patterns/jsdoc-documentation.md` govern exported docs and
  comments; Yeet composes and validates publication metadata. Poteto’s absolute
  punctuation bans are style preferences, not current beep-effect laws.

### Principle set, distilled

The mode’s principles favor the smallest domain-shaped change, deletion before
addition, explicit boundaries and types, idempotent/retry-safe operations,
single-writer state, real-artifact proof, root-cause evidence, small verifiable
delivery units, context-preserving delegation, autonomous reversible work, and
encoding recurring lessons in tooling rather than repeated prose. These overlap
strongly with `AGENTS.md`, schema-first/effect-first laws, Yeet’s exact-head
proof, the QA evidence loop, and the repo’s packet/ledger conventions.

## Cross-cutting assumption map

| Poteto assumption | beep-effect equivalent or disposition |
| --- | --- |
| Graphite `gt`, stacked branches, restack, merge-when-ready | No canonical equivalent found. Repo law says merge `origin/main`, never rebase published branches, publish through Yeet, and preserve explicit merge authorization. Drop `gt` commands. |
| Cursor Task and `subagent_type: poteto-agent` | Codex collaboration agents and repo-defined specialist roles, only when requested or required by an applicable skill. |
| Cursor cloud agents and cloud dashboard | No direct repo primitive. Use shared worktrees, durable packet/store files, branch/PR/head receipts, and live agent collaboration where authorized. |
| Hard-coded model slugs | Do not port. Use the current runtime’s available models and skill-specific role guidance. |
| `control-ui` / `control-cli` from `cursor-team-kit` | Gesture-bearing UI uses `.claude/skills/browser-qa-loop/SKILL.md` and `bun run beep qa`; dev servers are portless. CLI proof uses real commands plus Yeet lanes. Browser/Chrome control skills may drive live surfaces when available. |
| `/deslop` and `cursor-team-kit` | Use the available `unslop` skill for prose and Yeet repair/lint/policy gates for code. There is no direct repo `/deslop` contract. |
| `/no-comments` | Use `AGENTS.md`, source review, lint/policy gates, and JSDoc law; remove narration but preserve required explanatory/JSDoc comments. |
| Bugbot | Repo closeout is Greptile-first. Use `yeet status --remote`, `yeet closeout`, drafted replies, and `yeet reply`; assess every claim against code/evidence. The skeptical rubric remains useful. |
| `~/.cursor/rules` and `/setup-pstack` | `AGENTS.md`, package-local `AGENTS.md`, repo skills, standards, and file memory are authoritative. Do not add a Cursor-rule control plane. |
| Cursor `/loop` and `/goal` | Use persistent in-session work, blocking `yeet monitor --watch --until-event`, `monitor --until-merged` when appropriate, durable packets/ledgers, and the runtime’s goal mechanism only when the user explicitly requests a goal. |
| `show-me-your-work` TSV trails | Goal/exploration packet history, `research/OPPORTUNITIES.md` friction receipts, Yeet run artifacts, QA inventories, and `reflect` artifacts. A small local TSV may still be useful for a bounded experiment. |

## Playbooks

### 1. Authoring or modifying a skill

Source: `playbooks/authoring-a-skill.md`.

- Route authoring through Cursor’s `create-skill` skill and retain ownership of
  the instruction voice.
- Validate frontmatter, referenced files, and cross-skill links.
- Add structural tests when rules are machine-checkable; skip tests for purely
  subjective prose.
- Delete prose that does not change a decision, point to structural truth, and
  finish through Opening a PR.
- External assumptions: Cursor built-in `create-skill`, the pstack principle
  leaf skills, and the shared Opening a PR flow.
- Repo-equivalent: use the available skill-authoring machinery if installed,
  repo skill conventions, source/path validation, focused tests, `unslop`, and
  Yeet for publication. **Adapt.**

### 2. Autonomous run

Source: `playbooks/autonomous-run.md`.

- Define a measurable exit predicate before the first iteration.
- Choose an event watcher or interval heartbeat with Cursor `/loop`.
- Make the smallest evidence-backed change, verify it, commit only progress,
  and discard unsuccessful hypotheses.
- Own reversible discoveries and side fixes; checkpoint every iteration in a
  durable trail; stop only at the predicate or a genuine dead end.
- External assumptions: Cursor `/loop`, watcher subagents, poteto mode,
  `show-me-your-work`, and liberal autonomous external action.
- Repo-equivalent: use Yeet’s event watcher for PR work, durable packet/Yeet
  receipts, and the runtime’s persistence rules. Preserve explicit authority
  for push, PR writes, and merge. **Adapt.**

### 3. Autopilot-full

Source: `playbooks/autopilot-full.md`.

- Wait for an explicit go, arm a persistent goal, and assign one Cursor cloud
  owner to each independent PR.
- Each owner builds, registers with `gt`, proves the real surface, deslop/no-
  comments passes, triages Bugbot, babysits, and requests a root verdict.
- The root swarm-verifies the exact merge-ready SHA; any new SHA invalidates
  the verdict.
- A clean root verdict authorizes the owner to squash-merge and take the next
  item; the root audits owners every 30 minutes and immediately replaces stuck
  lanes.
- External assumptions: Cursor cloud, `/goal`, terminal `/loop`, Graphite,
  Bugbot, `deslop`, `no-comments`, control skills, swarm, model-specific owners,
  and delegated merge authority.
- Repo-equivalent: quality-review-fix-loop and Yeet provide review/proof/hosted
  closure, but beep-effect does not delegate merge authority this way and does
  not use Graphite as canonical topology. **Drop as a ported workflow; retain
  only exact-head independent verification concepts.**

### 4. Autopilot-stack

Source: `playbooks/autopilot-stack.md`.

- Run the same one-owner lifecycle as Autopilot-full but withhold all merge
  actions.
- Audit on a 30-minute wake chain and honor state-then-wait operator gates.
- Swarm-verify each exact STACK-READY SHA before appending it to one linear
  stack.
- Make the root the sole topology writer; owners push their branch while root
  runs `gt track`, `gt submit --stack`, restacks, patch-id checks, and
  re-verification.
- Deliver a bottom-up Graphite chain for the operator to land.
- External assumptions: Cursor cloud, `/goal`, `/loop`, Graphite UI/CLI,
  force-with-lease branch rewrites, Bugbot, control skills, and swarm.
- Repo-equivalent: no canonical Graphite stack exists; force-push/rebase policy
  conflicts with Yeet’s merge-not-rebase rule. Use separate Yeet PRs with
  explicit dependencies if needed. **Drop.**

### 5. Babysit

Source: `playbooks/babysit.md`.

- Declare `drive`, `background`, `threads-only`, or `check` before polling.
- Work only the lowest unmerged frontier, keep one babysitter per stack, and
  never mutate topology from the babysit lane.
- Resolve in order: conflicts, review threads, then CI, batching fixes into one
  push wave.
- Trust `scripts/watch-pr/watch-pr` readiness, rearm it under `/loop`, classify
  CI before retry, and triage Bugbot skeptically.
- Stop at merge-ready or the human approval boundary. Babysitting never grants
  merge authority.
- External assumptions: connected Graphite stacks, Cursor `/loop`, the local
  watch-pr script, Bugbot, and `gh api` thread replies.
- Repo-equivalent: `bun run beep yeet monitor --watch --until-event`,
  `status --remote`, `verify --tier review-fix`, `closeout`, draft replies, and
  `yeet reply` already own this loop. Preserve the no-merge-without-authority
  rule. **Adapt into a thin Yeet routing guide.**

### 6. Bug fix

Source: `playbooks/bug-fix.md`.

- Reproduce the defect personally on the matching real surface.
- Use `how`/`why`, instrumentation, and hypothesis elimination to isolate and
  prove the causal mechanism.
- Run architecture exploration for boundary-crossing fixes; delegate a tightly
  scoped implementation and review its diff.
- Re-run the original repro on the same surface and distinguish unit-branch
  proof from real bug absence.
- Land a failing repro/test before the fix when economical, then run Opening a
  PR.
- External assumptions: `how`, `why`, `architect`, Cursor `/loop`, control
  skills, Task delegation, and `gpt-5.6-sol-max`.
- Repo-equivalent: effect-first/schema-first specialists as applicable,
  browser-qa-loop for gesture UI, focused tests, then Yeet. Do not hard-code a
  model or require delegation when the runtime rules do not. **Adapt.**

### 7. Eval

Source: `playbooks/eval.md`.

- Define a private rubric and success behavior before running candidates.
- Build sanitized, organic-looking candidate environments and prompts with no
  eval vocabulary or chain-eliciting cues.
- Run parallel candidates on different models, then one blinded cross-candidate
  judge from another family.
- Verify actual file/skill access from scoped transcripts, read every output,
  and reconcile personal judgment with the blind judge.
- External assumptions: Cursor Task/arena, multiple named model families,
  per-workspace `agent-transcripts/`, and access to candidate transcripts.
- Repo-equivalent: the blinding design is portable; use collaboration agents
  only when explicitly authorized, sandboxed worktrees/dirs, durable outputs,
  and do not scan unrelated private histories. **Adapt.**

### 8. Feature

Source: `playbooks/feature.md`.

- Ground the affected subsystem, run parallel architecture exploration, and
  make any skip explicit.
- Write the four-part throughput checkpoint before fan-out.
- Name the data shape and organizing structure before delegating a scoped
  implementation; use a bakeoff when several shapes are valid.
- Review the diff, verify on the matching surface, form small ordered commits,
  and adversarially review contested design.
- Finish through Opening a PR.
- External assumptions: `how`, `architect`, `arena`, `interrogate`, mandatory
  Task delegation, `grok-4.6-fast-xhigh`, control skills, and Graphite stacks.
- Repo-equivalent: schema-first/effect-first development, live source/barrel
  reuse search, browser QA for gestures, focused vertical slices, and Yeet.
  Delegation/model choice must follow the active runtime. **Adapt.**

### 9. Hillclimb

Source: `playbooks/hillclimb.md`.

- Choose a realistic workload, one metric, direction, and stop predicate with a
  minimum-attempt floor.
- Build and freeze a sensitive repeated-measurement harness; record baseline and
  correctness gate.
- Keep a local `decision.tsv`; attempt one mechanism-backed hypothesis at a
  time, measure, keep or fully revert, and commit each accepted win.
- Pivot after plateaus without relaxing the predicate; stop only at the target
  or when remaining ideas are genuinely uneconomic.
- External assumptions: `how`, `show-me-your-work`, Task/worktree fan-out,
  `gpt-5.6-sol-max`, Autonomous `/loop`, and Opening a PR.
- Repo-equivalent: keep the scientific loop and local ledger; use scheduler-
  aware proof, repo worktree rules, focused performance commands, and Yeet for
  accepted commits/PR. **Adapt.**

### 10. Investigation

Source: `playbooks/investigation.md`.

- Keep the task read-only and route narrow/critical questions through `how`,
  with `why` for motivation/history.
- Mark throughput as not applicable and produce either a structured explanation
  or a recommendation/tradeoff table.
- Apply unslopped prose and give a real judgment when the premise is contestable.
- Do not open a PR or invoke architecture work unless the user later authorizes
  a change.
- External assumptions: pstack `how`, `why`, and `unslop` skills.
- Repo-equivalent: targeted repo/doc/source inspection plus the available
  `unslop` skill; route later code changes through repo-specific skills. **Adapt
  lightly.**

### 11. Multi-phase or multi-PR plan

Source: `playbooks/multi-phase-plan.md`.

- Refuse ceremony for an obvious one- or two-file change; otherwise settle
  observable forks by Prototype before planning.
- Explore through scoped delegates, then fill a rigid PR-by-PR checklist with
  dependencies, exact files, build steps, observable results, and evidence.
- Require unit, live, and performance verification for every PR; UI changes get
  ten cloud live lanes plus screenshots/video and a human review gate.
- Select Autopilot-full, Autopilot-stack, or Orchestrate, validate with
  `scripts/check-plan.mjs`, return the plan, and wait for explicit execution.
- External assumptions: Cursor agent store, Task `poteto-agent`, Graphite,
  `/goal`, `/loop`, `/technical-writing`, `/unslop`, `/deslop`, `/no-comments`,
  Bugbot, control skills, ten `grok-4.6-fast-xhigh` cloud lanes, and pstack
  execution skills.
- Repo-equivalent: exploration/goal packets, `explore`, `grilling`, ADHD for
  expensive open design, quality-review-fix-loop, browser-qa-loop evidence,
  and Yeet gates. Ten fixed lanes and mandatory perf proof are excessive for
  every PR; scale evidence to risk. **Adapt substantially.**

### 12. Opening a PR

Source: `playbooks/opening-a-pr.md`.

- Work from an isolated feature worktree and preserve unrelated dirty work.
- Shape small ordered commits, then run deslop/no-comments and technical-writing
  passes over commits and PR text.
- Use Conventional Commit titles and evidence-led Why, Scope, Tradeoffs, Blast
  Radius, and Verification sections.
- Prefer narrow Graphite stacks, rebase on main, open ready rather than draft,
  verify hosted state, return the URL, and do not automatically babysit.
- External assumptions: Cursor Task worktrees, destructive reset as a recovery
  option, `cursor-team-kit`, Graphite `gt`, technical-writing, unslop,
  interrogate, and manual `gh` publication.
- Repo-equivalent: preserve dirty work, merge `origin/main` rather than rebase,
  never use destructive reset casually, and run `bun run beep yeet publish --pr
  --monitor --message ...`. Yeet owns Conventional Commit validation and PR
  readiness. **Adapt heavily.**

### 13. Orchestrate

Source: `playbooks/orchestrate.md`.

- Use only for a program that outlives one agent; define a countable predicate,
  tracks, wall-clock budget, and a 70%-budget landing cutoff.
- Initialize a single-writer plain-file store, pilot one unit end to end, then
  scale a rolling window of tightly briefed cloud workers/verifiers.
- Treat completions as inbox pointers; batch drains, update typed unit/ledger/
  gate/frontier state, and continuously land verified work.
- Serialize Graphite stack topology under one stacker, key verification to PR
  plus exact SHA, and recover dead/zombie agents from durable state.
- Close only after every unit and verifier is reconciled and the real artifact
  satisfies the predicate.
- External assumptions: Cursor Task with cloud/local environments and nested
  agents, Cursor dashboard/restart semantics, Graphite, control skills,
  `show-me-your-work`, and `scripts/orch/orch.ts`.
- Repo-equivalent: the durable single-writer store and exact-head ledger are
  useful, but topology should use Yeet/ordinary PR dependencies, admission-
  aware proofs, repo packet files, and live collaboration. The current
  multi-agent runtime permits delegation only when asked or skill-required.
  **Adapt; do not port Graphite/Cursor lifecycle assumptions.**

### 14. Pause safely

Source: `playbooks/pause-safely.md`.

- Stop at an atomic boundary, back out broken work, start nothing new, and
  cancel nested agents.
- Do not push or open a PR merely to create a pause point.
- Make edits durable with a `wip:` commit, recording a broken tree in the body
  if necessary.
- Write an off-context resume note with intent, proof, state, next actions,
  files, and gotchas.
- External assumptions: disposable/private branches, Cursor restart/context
  compaction, and permissive WIP commits.
- Repo-equivalent: durable packet/scratch notes and existing clean commits are
  preferred; `AGENTS.md` forbids saving/WIP/tmp checkpoints on shared branches.
  Preserve work without publishing, and use Session pickup semantics later.
  **Adapt.**

### 15. Perf issue

Source: `playbooks/perf-issue.md`.

- Capture a real baseline trace, then ground hypotheses in architecture rather
  than source-only intuition.
- Consider elimination, divide-and-conquer, caching, indirection, batching,
  redundancy, lazy evaluation, and scheduling only when the trace supports the
  mechanism.
- Architect boundary-crossing fixes, delegate a scoped implementation, capture
  the post-fix trace, and compare artifacts quantitatively.
- Cite baseline, post-fix number, delta, and artifact in the PR; use Hillclimb
  for sustained optimization.
- External assumptions: control skills, `how`, `architect`, Task delegation,
  `gpt-5.6-sol-max`, and Opening a PR.
- Repo-equivalent: use real app/CLI instrumentation, browser QA/performance
  evidence when UI-related, focused commands, and Yeet publication. **Adapt.**

### 16. Prototype

Source: `playbooks/prototype.md`.

- Name the empirical/design decision; otherwise route directly to Feature.
- Gather references only when the direction is open.
- Build the smallest throwaway visual or behavioral instrument outside
  production source, with no production abstractions or test ceremony.
- Put alternatives behind one switcher, exercise the matching surface, record
  screenshots/output/timing, and recommend a winner.
- Hand the decision, not prototype code, to Feature/architecture work.
- External assumptions: disposable scratch dirs, ad hoc CDN/dev servers,
  control-ui/control-cli, and pstack Feature/architect.
- Repo-equivalent: keep scratch outside tracked source, but all repo dev servers
  must use portless scripts; gesture UI evidence should use browser-qa-loop.
  `explore` can retain decision evidence before implementation. **Adapt.**

### 17. Refactoring

Source: `playbooks/refactoring.md`.

- Pin current behavior with characterization/equivalence evidence before moving
  structure.
- Name the missing domain structure and target call/module/type shape; use
  architecture exploration if boundaries move.
- Delete dead weight and wrappers first, then move in small green steps; migrate
  all callers and delete legacy APIs in one wave.
- Prove behavior on the real artifact, confirm reduced reader load, and retain
  only changes that earn their indirection.
- Shape ordered behavior-preserving commits and run Opening a PR.
- External assumptions: pstack `how`/`architect`, mandatory delegate using
  `grok-4.6-fast-xhigh`, control skills, rebase-based commit shaping, and
  Opening a PR.
- Repo-equivalent: `crispen`, effect-first/schema-first skills, live reuse
  search, focused equivalence tests, and Yeet. Preserve user work and avoid
  rebase on published branches. **Adapt.**

### 18. Runtime forensics

Source: `playbooks/runtime-forensics.md`.

- Capture CPU, heap, or visual trace evidence from the live process on the
  matching surface.
- Reduce the artifact to a hot path, retainer chain, or input-free loop without
  flooding the main context.
- Confirm the mechanism with live instrumentation or a temporary hotfix.
- Map it to source file, symbol, and line, then return diagnosis only.
- External assumptions: control-ui/control-cli, CDP hot evaluation, and a
  delegate for large-artifact reduction.
- Repo-equivalent: browser/Chrome tooling where available, local trace parsers,
  and the read-only diagnosis contract. Route an authorized fix to Bug fix or
  Perf. **Adapt lightly.**

### 19. Session pickup

Source: `playbooks/session-pickup.md`.

- Locate the prior scoped transcript, cloud URL, pushed branch, or durable
  trail; read metadata/end first and then decision points.
- Reconstruct branch/worktree state, landed work, decisions, and open todos.
- Diff done versus pending without redoing completed repros or analysis.
- Route the remainder to the matching playbook and verify inherited claims
  against the original real-artifact goal.
- External assumptions: Cursor `agent-transcripts/`, cloud-agent URLs, and Task
  reduction of long transcripts.
- Repo-equivalent: use repo packet history, local file memory, git/PR/Yeet
  artifacts, and durable on-disk handoffs. Do not scan unrelated agent/private
  histories. **Adapt.**

### 20. Shipping

Source: `playbooks/shipping.md`.

- Independently verify every PR against parent versus head on the real surface
  and publish a per-PR PASS/PASS+NOTES/FAIL verdict.
- Land only the contiguous verified run from the bottom; patch-id-check any
  verdict whose SHA changed after restack.
- Arm Graphite merge-when-ready with `--always`; explicitly disable GitHub
  auto-merge for child stack PRs.
- Once Graphite drains, stop mutating topology, watch queued progress under
  `/loop`, and stop at the verified ceiling.
- External assumptions: Graphite stack semantics/CLI/UI, Cursor cloud verifier
  agents, control skills, per-PR comment writes, and `/loop`.
- Repo-equivalent: Yeet closeout gives exact-head/check/thread/merge-state proof,
  and `yeet merge` is operator-authorized only. No Graphite queue is canonical.
  **Drop as a direct port; retain the “green is not independent verification”
  and exact-head concepts in quality-review-fix-loop/Yeet.**

### 21. Trace forensics

Source: `playbooks/trace-forensics.md`.

- Identify a supplied profile/trace/spindump/heap format and load it with the
  appropriate parser.
- Transform large raw data into a queryable shape such as SQLite.
- Find dominant frames/call paths, retainer chains, or blocking/on-CPU threads.
- Resolve artifact symbols to source file, symbol, and line; without symbols,
  report an attribution limit rather than a diagnosis.
- Diff paired captures when present and return diagnosis only.
- External assumptions: generic DevTools/trace/heap tools and optional delegate
  reduction; no Cursor-specific control surface is required.
- Repo-equivalent: this is portable. Use repo-local source maps and preserve the
  read-only diagnosis boundary. **Keep as-is, with repo path conventions.**

### 22. Visual parity

Source: `playbooks/visual-parity.md`.

- Establish immutable screenshot baselines for all relevant states before the
  migration.
- Forbid baseline/harness tampering and structural shortcuts that only make the
  diff pass.
- Migrate independent components in separate worktrees, with shared primitives
  first.
- Exercise each component on the real control surface and require a zero image
  diff, looping per component before opening PRs.
- External assumptions: control-ui, Cursor `/loop`, independent worktree owners,
  and Opening a PR.
- Repo-equivalent: browser-qa-loop provides recorded real-input evidence and
  schema-validated findings; add a pixel-diff harness where exact parity is the
  acceptance criterion, use portless, then Yeet. **Adapt.**

### 23. Worktree and simulator cleanup

Source: `playbooks/worktree-cleanup.md`.

- Measure disk, run `scripts/worktree-audit.sh`, and classify worktrees by size,
  age, merge/PR state, dirty files, and recent chat ownership.
- Treat the audit bucket as advice; pinned/active chats override it and uncertain
  ownership is investigated from scoped transcripts.
- Pause before deleting tracked WIP; name untracked scratch; remove only clean,
  merged, unused worktrees and verify reclaimed space.
- Optionally delete stale iOS simulators, Xcode/Cursor state, and package caches.
- External assumptions: macOS/Xcode, Cursor sidebar/transcripts/storage layout,
  `rm -rf`, force worktree removal, and the pstack audit script.
- Repo-equivalent: `AGENTS.md` requires sibling `-worktrees`, preserves dirty or
  owned checkouts, bans broad destructive targets, and provides
  `beep quality tmpfs-reap` for repo temp cleanup. This Mac/Cursor cleanup
  workflow should not be ported into beep-effect. **Drop; keep only the
  ownership/dirty-state audit principles.**

## Reference: Bugbot triage

Source: `references/bugbot-triage.md`.

The reference classifies each automation thread as `fix`, `dismiss`, or `ask`.
Correctness, security, privacy, data loss, auth, billing, migration,
idempotency, concurrency, and shipped behavior default toward fixing or asking.
Dismissal requires concrete local proof and a narrow learned pattern. Candidate
dismissals include intentional visual changes, verified upstack usage,
temporary low-risk duplication, an enforced framework/type invariant,
owner-deferred unchanged debt, and self-withdrawn false positives. Security,
privacy, data, and high-severity findings are never generalized into skip rules.
The later learnings emphasize that manual browser-behavior reimplementations are
usually real bugs, contract-test drift should be tested directly, stale review
findings may already be fixed at the current tip, and widening a deliberately
narrow error condition can hide the real error.

Repo mapping: retain the skeptical evidence rubric, but replace Bugbot-specific
pass heuristics with Yeet’s Greptile/thread/check data and the current reviewer’s
actual claim. Use `.beep/yeet/reply-drafts.json`, `bun run beep yeet reply`, and
strict closeout to make replies/resolution durable.

## Scripts

### `scripts/orch`

Sources skimmed:

- `scripts/orch/orch.ts`
- `scripts/orch/store.ts`
- `scripts/orch/orch.test.ts`

`orch.ts` is a Commander-based CLI over a plain-file, single-writer program
store. `--store`/`ORCH_STORE` selects the store; `--json` returns full records;
compact mode deliberately emits small status lines for coordinator context
economy. Its command families are:

- `init`
- `unit add|set|get|list|counts`
- `ledger record|check|summary`
- `inbox push|drain|count`
- `gate park|list|resolve`
- `frontier set|show`
- `standing show|add`
- `status`

`store.ts` implements typed TSV/JSON/Markdown persistence, atomic writes,
validation, a PID lock that can replace a confirmed dead holder, explicit
force-steal behavior, idempotent initialization, unit state, verification
verdicts keyed by PR/SHA, inbox pointers, decision gates, standing orders,
derived `status.md`, and a Graphite-derived frontier. The CLI never spawns,
waits for, or wakes agents; Orchestrate owns that control loop. The tests cover
store idempotence, lock behavior, typed/malformed data, inbox drain, status,
frontier ordering/pinning, CLI exits, and JSON output.

Repo assessment: the file-backed, atomic, single-writer bookkeeping pattern is
compatible with beep-effect’s durable-memory/packet posture. The Graphite
frontier and Cursor-agent lifecycle are not. A port would need a new schema-
first Effect implementation, Yeet/PR exact-head inputs, and a named packet or
tooling owner; it should not be copied wholesale into `.beep/` as an ungoverned
second control plane.

### `scripts/watch-pr`

Sources skimmed:

- `scripts/watch-pr/watch-pr`
- `scripts/watch-pr/cli.ts`
- `scripts/watch-pr/github.ts`
- `scripts/watch-pr/policy.ts`
- `scripts/watch-pr/render.ts`
- `scripts/watch-pr/types.ts`
- `scripts/watch-pr/types.compile.ts`
- `scripts/watch-pr/fakes.test-helper.ts`
- `scripts/watch-pr/cli.test.ts`
- `scripts/watch-pr/github.test.ts`
- `scripts/watch-pr/policy.test.ts`
- `scripts/watch-pr/tsconfig.json`

The `watch-pr` Bun launcher installs pinned script dependencies if needed, then
runs a typed read-only GitHub watcher. It resolves the current PR/repository via
`git` and `gh`, reads PR facts, unresolved GraphQL review threads, check rollups,
and connected open-PR topology, and annotates Bugbot pass counts. It uses
`gh pr checks` as a fast path and paginated GraphQL rollups as a fail-closed
fallback.

Modes are `single`, discovered connected `stack`, and immutable
`queued-stack`; `--stack-prs` freezes bottom-to-top queue identity. JSON/NDJSON
is the default; `--pretty` renders a four-column PR/CI/Review/Merge table.
`--status-only` performs one read. Polling has separate normal and whole-stack
sweep intervals, timeout, retry budget/backoff, and draft allowance.

The policy state machine distinguishes `STATUS`, `WAITING`, `ADVANCE`, `RETRY`,
`BLOCKER`, `READY`, `COMPLETE`, and `TIMEOUT`. Blockers distinguish conflicts,
unresolved threads, visible/hidden GitHub CI failure, closed/draft/review gates,
and status-query failure. Stack evaluation is tier-major so a conflict can
outrank lower-frontier pending CI; queued mode periodically sweeps the frozen
list, polls the live frontier, deduplicates unchanged waits, and reports
merge-queue waiting separately from check waiting. Tests exercise the readiness
truth table, fail-closed check fallback, enum parsing, Bugbot pass counting,
stack ordering, queue cadence/advance, rendering, argument validation, retry,
and exit-code behavior.

### Does `bun run beep yeet monitor` already cover `watch-pr`?

**For the repo’s canonical single-PR babysitting and closeout workflow, yes.**
Yeet covers more of the required lifecycle:

- `monitor --watch --until-event` emits typed PR transitions, exits on the first
  actionable red/comment batch, keeps a durable comment watermark, and writes
  failure capsules/dispatch state.
- `status --remote`, `closeout`, and `reply` expose exact review-thread ids,
  bot/check/mergeability state, drafted replies, and durable per-thread results.
- `verify --tier review-fix`, full exact-head proof, `publish`, strict closeout,
  `monitor --until-merged`, and guarded `sweep` connect observation to repair,
  publication, merge readiness, and cleanup.

**It is not a line-for-line replacement for the pstack stack watcher.** The
poteto script can discover a connected parent/child PR stack, accept a frozen
bottom-to-top queue, run tier-major multi-PR classification, emit `ADVANCE` as
the frontier moves, and stop at `COMPLETE` for that queue. The Yeet skill’s
documented monitor is current-branch/current-PR oriented; it does not advertise
that same frozen multi-PR queue state machine or four-column stack table.

Conclusion: do not port `watch-pr` for ordinary beep-effect PR work. Use Yeet.
If beep-effect later adopts a real multi-PR queue/stack program, add the missing
multi-PR orchestration as a Yeet feature or a schema-first adapter over Yeet
state rather than installing this parallel watcher unchanged.

## Disposition

| Playbook | Keep as-is / adapt / drop for beep-effect | Why |
| --- | --- | --- |
| Authoring a skill | Adapt | Good validation/voice rules; replace Cursor `create-skill` and Opening a PR with available skill tooling and Yeet. |
| Autonomous run | Adapt | Predicates and evidence loops fit; `/loop`, permissive external actions, and checkpoint mechanics need repo/runtime bindings. |
| Autopilot-full | Drop | Cursor-cloud/Graphite/delegated-merge control plane duplicates Yeet and conflicts with explicit merge authority. |
| Autopilot-stack | Drop | Fundamentally Graphite/rebase/force-with-lease based; no canonical repo stack topology. |
| Babysit | Adapt | Preserve modes/frontier discipline and skeptical triage; route the implementation to Yeet monitor/status/closeout/reply. |
| Bug fix | Adapt | Scientific repro/root-cause/same-surface proof is strong; replace model/control/Task assumptions with repo skills and QA. |
| Eval | Adapt | Blind experimental design is portable; Cursor transcript/model/arena assumptions are not. |
| Feature | Adapt | Data-shape-first design and throughput decomposition align; use schema/effect-first, browser QA, and Yeet. |
| Hillclimb | Adapt | Frozen harness and keep/revert ledger are useful; bind to repo scheduler, worktree, and publication rules. |
| Investigation | Adapt lightly | Read-only evidence and candid recommendation fit; replace missing pstack routing skills with repo inspection. |
| Multi-phase plan | Adapt substantially | Packet structure and evidence boxes fit; fixed ten-cloud-lane/perf/Graphite ceremony does not scale to every PR. |
| Opening a PR | Adapt heavily | Yeet is canonical; merge rather than rebase and preserve dirty work instead of reset-based recovery. |
| Orchestrate | Adapt | Durable store/brief/ledger ideas fit large programs; remove Cursor cloud/dashboard and Graphite topology. |
| Pause safely | Adapt | Durable cold-start note fits; WIP commits conflict with repo no-checkpoint law on shared branches. |
| Perf issue | Adapt | Measurement story is sound; use repo surface, QA, proof, and publication machinery. |
| Prototype | Adapt | Empirical forks and throwaway artifacts fit; enforce portless and recorded QA where gestures matter. |
| Refactoring | Adapt | Characterization, subtract-first, and equivalence proof fit; use crispen/effect/schema laws and Yeet. |
| Runtime forensics | Adapt lightly | Diagnosis-only live evidence is portable; swap Cursor control assumptions for available browser/local tools. |
| Session pickup | Adapt | Durable handoff/state reconstruction fits; source from repo packets, git, Yeet, and file memory instead of Cursor transcripts. |
| Shipping | Drop | Graphite merge-when-ready is the core mechanism; Yeet already owns authorized merge/closeout/sweep. |
| Trace forensics | Keep as-is | Generic artifact-to-query-to-source diagnosis is portable; only path/tool details vary. |
| Visual parity | Adapt | Immutable baselines and zero diff fit; browser-qa-loop supplies the repo evidence/control loop. |
| Worktree cleanup | Drop | Mac/Cursor deletion workflow does not belong in beep-effect; retain only ownership/dirty-state safety principles. |

## Coverage manifest

Documentation read in full:

- `SKILL.md`
- `playbooks/authoring-a-skill.md`
- `playbooks/autonomous-run.md`
- `playbooks/autopilot-full.md`
- `playbooks/autopilot-stack.md`
- `playbooks/babysit.md`
- `playbooks/bug-fix.md`
- `playbooks/eval.md`
- `playbooks/feature.md`
- `playbooks/hillclimb.md`
- `playbooks/investigation.md`
- `playbooks/multi-phase-plan.md`
- `playbooks/opening-a-pr.md`
- `playbooks/orchestrate.md`
- `playbooks/pause-safely.md`
- `playbooks/perf-issue.md`
- `playbooks/prototype.md`
- `playbooks/refactoring.md`
- `playbooks/runtime-forensics.md`
- `playbooks/session-pickup.md`
- `playbooks/shipping.md`
- `playbooks/trace-forensics.md`
- `playbooks/visual-parity.md`
- `playbooks/worktree-cleanup.md`
- `references/bugbot-triage.md`

Requested script families skimmed at implementation, type, renderer, wrapper,
and test-contract level: every file under `scripts/orch/` and
`scripts/watch-pr/` listed in the script sections above.
