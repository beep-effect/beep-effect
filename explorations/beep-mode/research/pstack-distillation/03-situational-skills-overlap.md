# Pstack situational skills overlap

## Scope and routing baseline

This review covers the 23 requested pstack situational skills, every file under
their `references/` and `scripts/` directories, both pstack agents, Benny's
`README.md` and `FOR_AGENTS.md`, the requested repo skill entrypoints, and every
repo agent definition. It excludes `poteto-mode` and every `principle-*` skill.

The target routing comes from `~/.claude/CLAUDE.md`, sections "Global Routing
Doctrine" and "Native Workflow model routing":

- Fable is the judgment, architecture, UI/UX, prose, and final-synthesis model.
- GPT-5.6 Sol is the precise implementation, deep-research, code-review,
  exploration, triage, and long-running-work model. Native Workflow uses the
  exact ID `gpt-5.6-sol(medium)`.
- Grok 4.6 is the fast mechanical and live-web/X-search model. Native Workflow
  uses `grok-4.6`; native Grok CLI keeps X search only when no non-empty
  `--tools` allowlist is supplied.
- Cheap unspecified Claude Workflow children may stay on GPT-5.6 Luna. Never
  set `CLAUDE_CODE_SUBAGENT_MODEL`, because it overrides explicit child models.

`~/.cursor/rules/pstack-models.mdc` does not exist on this machine. Every pstack
role therefore uses its inline fallback unless a harness adapter supplies an
equivalent routing map. The pstack rule schema and fallbacks are defined in
`skills/setup-pstack/SKILL.md:8-56`.

### Harness translation key

| Cursor construct | Claude Code port | Codex port | Grok CLI port |
|---|---|---|---|
| `Task`, `subagent_type: generalPurpose`, `readonly`, `run_in_background` | Native Workflow `agent()`/`parallel()` where installed; otherwise Claude Agent tool. Use `gpt-5.6-sol(medium)` and `grok-4.6` exact IDs for proxy-backed children. | Native collaboration agents. Read-only is a role/prompt plus tool restriction, not Cursor's `readonly` flag. Supported local model names differ from Cursor slugs. | Native Grok task/agent facility if exposed; otherwise separate `grok -p` runs and aggregate artifacts. Do not pass `--tools` when X search is required. |
| `AskQuestion` | `AskUserQuestion` or the harness's structured question tool. | `request_user_input` in Plan mode; otherwise a normal user question. | Plain numbered choices unless the installed CLI exposes a structured question tool. |
| `~/.cursor/rules/pstack-models.mdc` | A repo/user Claude routing file or an adapter that reads the doctrine in `~/.claude/CLAUDE.md`. | A repo/user Codex routing file or explicit model selection at spawn time. | A Grok-side routing file or explicit headless command selection. |
| Cursor built-ins such as `create-skill`, `babysit`, `deslop`, `/automate` | Replace with an installed Claude skill or a repo workflow. No name-only assumption. | Replace with an installed Codex skill or repo workflow. No name-only assumption. | Replace with a Grok skill/command only after discovery. |
| Cursor MCP names and `mcps/` discovery | Enumerate Claude's enabled tools/connectors. Agent mode and permissions determine access. | Enumerate MCP resources/tools available in the live Codex session. | Enumerate Grok connectors. Native X search is not an MCP and disappears under a non-empty `--tools` allowlist. |

## Multi-model panels and routing repair

The panel skills are `how` critique mode, `arena`, `interrogate`, `architect`
through Arena, and `reflect`. Their defaults assume the Cursor slugs
`claude-fable-5-thinking-max`, `gpt-5.6-sol-max`,
`grok-4.6-fast-xhigh`, and `claude-opus-5-thinking-xhigh`. The Opus seat is not
part of the target three-way doctrine, and the other three Cursor slugs are not
the exact IDs used by native Claude Workflow or the other CLIs.

| Panel | Current selection logic | Re-pointed selection |
|---|---|---|
| `how` critics | One critic per entry in configured `how critics`; otherwise Fable, Sol, Grok, and Opus. Explorers use configured `how explorer`, default Grok. The explainer uses configured `how explainer`, default Fable (`skills/how/SKILL.md:45-82,110-123`). | Use Fable for the lead architectural judgment and prose, Sol for precise code and boundary analysis, and Grok for fast independent traversal. Drop the redundant Opus seat. For X-dependent critique, run Grok in a native no-allowlist lane. |
| `arena` | One runner per `arena runners` entry; otherwise Fable, Sol, Grok, and Opus. One cross-judge is chosen from `arena cross-judge pool`, preferring a family different from the parent (`skills/arena/SKILL.md:22-41`). | Use Sol for implementation-ready candidates, Fable for design/prose candidates, and Grok for fast mechanical alternatives. Cross-judge with Fable when the base was produced by Sol/Grok; use Sol when Fable produced the base and the rubric is code-exact. |
| `architect` | Runs Arena with configured `architect runners`; otherwise the same four defaults (`skills/architect/SKILL.md:29-41`). The current text relies on Arena accepting that caller-supplied roster even though Arena normally reads `arena runners`. | Pass the roster explicitly rather than relying on label lookup: Fable design judgment, Sol exact type/module sketch, Grok fast alternative search. Fable synthesizes. Sol implements. Keep the roster handoff explicit in the port. |
| `interrogate` | One read-only reviewer per `interrogate reviewers` entry; otherwise Fable, Sol, Grok, and Opus. Invalid Cursor slugs are replaced from the Task error's valid list (`skills/interrogate/SKILL.md:34-58`). | Use Fable for maintainability and architecture judgment, Sol for correctness and precise implementation review, and Grok for fast blind-spot search. The parent remains the lead judge. Do not preserve the Cursor-specific "read valid slugs from Task error" recovery. |
| `reflect` | Judgment and divergent reviewers use configured `reflect judgment`; tooling uses `reflect tooling`; synthesis uses judgment. Defaults are Fable, Sol, Fable, then Fable (`skills/reflect/SKILL.md:35-49`). | Keep Fable for judgment, divergent reading, prose, and synthesis. Keep Sol for tooling and exact command/path findings. Add Grok only when the transcript contains web/X research or a fast independent mechanical audit is valuable. |

## Skill-by-skill findings

### `how`

Purpose, line 1: Trace a subsystem from entrypoint through data flow, boundaries,
and ownership, then explain it as an onboarding mental model.

Purpose, line 2: In critique mode, add a diverse read-only architecture panel
after the factual explanation is complete.

Cursor-specific assumptions: `Task` with `generalPurpose`, explicit Cursor model
slugs, `readonly: true`, Cursor `Glob`/`Grep`/`Read` names, and optional model
roles from `~/.cursor/rules/pstack-models.mdc`. The critic panel is described in
`skills/how/SKILL.md:102-134`; prompts live under `skills/how/references/`.

Portability:

- Claude Code: the exploration itself works. `Task` fields and model slugs must
  become Workflow/Agent calls. Fable should explain; Grok should do fast source
  traversal; Sol should take the code-exact critic seat.
- Codex: the workflow works with explorer agents and a final synthesis, but
  Cursor's `readonly` and `generalPurpose` fields do not exist. Use Codex
  explorer/architecture roles and explicit read-only instructions.
- Grok CLI: direct explanation works. Parallel isolated critics need multiple
  child runs or separate headless invocations. X search is irrelevant to normal
  repo traversal and should not replace code reads.

Verdict: **COMPLEMENT**. The repo's `architecture-guardian` and
`modularization-analyst` agents review doctrine and split seams, but neither
produces a general runtime-flow explanation. Port `how` as a harness-neutral
explainer and route doctrine questions through `.claude/agents/architecture-guardian.md`.

### `why`

Purpose, line 1: Reconstruct design motivation from source control, tickets,
docs, chat, observability, errors, and analytics rather than inferring intent
from code.

Purpose, line 2: Return confidence-tiered direct evidence, supported inference,
competing hypotheses, gaps, and a complete source-coverage map.

Cursor-specific assumptions: runtime MCP discovery through Cursor's tools map or
`mcps/`, one `Task` investigator per evidence category, `readonly: false` to
retain MCP access, Grok investigators, and a Fable synthesizer
(`skills/why/SKILL.md:94-176`). The source playbooks name example MCP methods for
Linear, Notion, Slack, Datadog, Sentry, and Databricks under
`skills/why/references/sources/`.

Portability:

- Claude Code: replace Cursor MCP enumeration with Claude's enabled connectors.
  Agent mode is still needed when read-only mode strips connectors. Use Grok for
  live-web/X-heavy evidence, Sol for source/PR archaeology, and Fable synthesis.
- Codex: enumerate the live MCP tool/resource surface instead of Cursor's
  `mcps/` directory. Some named enterprise MCPs may be absent. Preserve null
  results and skipped-source reasons rather than silently shrinking coverage.
- Grok CLI: native X search can cover public X evidence, but it is not Slack,
  Notion, Datadog, Sentry, or warehouse access. Any non-empty `--tools` allowlist
  disables X search, so mixed MCP plus X lanes must be split.

Verdict: **COMPLEMENT**. `explore` owns a repo packet's research stage and
provenance ledger, but `why` owns historical rationale and confidence
calibration. Keep both; let `explore` call the ported `why` for lineage questions.

### `teach`

Purpose, line 1: Explain what a change or subsystem is, how it works, and why it
has its current shape in a short, conversational account.

Purpose, line 2: Compose `how`, `why`, diagrams, and plain language without
creating a persistent curriculum workspace.

Cursor-specific assumptions: invokes Cursor-discovered `how` and `why` skills in
parallel and may call Cursor image generation. It assumes the current
conversation reveals the learner's level (`skills/teach/SKILL.md:11-19`).

Portability:

- Claude Code: skill composition and image generation need Claude equivalents;
  the teaching behavior itself is portable.
- Codex: use available visualization/image tools and ported `how`/`why`. No
  Cursor slash-skill resolution can be assumed.
- Grok CLI: prose teaching works. Diagram/image tooling and parallel skill
  composition may be missing or require separate runs.

Verdict: **NAME-COLLISION**. Repo `.claude/skills/teach/SKILL.md` is a stateful,
multi-session course system that writes `MISSION.md`, HTML lessons, resources,
learning records, and reusable assets. Pstack `teach` is an in-chat subsystem
explanation. Preserve repo `teach`; rename the pstack port to `explain-system`
or `teach-code` and make that name's narrow, non-writing behavior explicit.

### `recall`

Purpose, line 1: Reconstruct recent work from scoped chat history plus the shared
historical record for a named feature or bug.

Purpose, line 2: Verify stale transcript claims against live git/PR/ticket state
and return a compact status capsule with one next move.

Cursor-specific assumptions: transcripts at
`~/.cursor/projects/<slug>/agent-transcripts/`, Cursor-specific layouts and
noise classes, fast cheap Task subagents, `why` source investigators, `git`, and
`gh` (`skills/recall/SKILL.md:11-33`).

Portability:

- Claude Code: Cursor transcript paths break. Use Claude's actual session store
  only when authorized, or prefer repo packets and `~/.claude` memory. Keep live
  verification.
- Codex: use `~/.codex/memories/`, repo docs, and current session summaries under
  the file-memory protocol in `AGENTS.md`; do not reintroduce basic-memory or
  codegraph. Cursor JSONL parsing does not port.
- Grok CLI: session-history location and schema differ. Without a discoverable
  transcript store, restrict recall to repo artifacts and live git/PR state.

Verdict: **COMPLEMENT**. No repo skill owns cross-session status reconstruction.
The port must be file-memory-first and must honor this repo's explicit ban on a
shared-memory service.

### `blast-radius`

Purpose, line 1: Find downstream breakage that symbol search misses, including
timing, wire formats, external libraries, persistence, and other consumers.

Purpose, line 2: Identify the one or two safety facts the change depends on and
prove them with executable evidence, preferably in the running product.

Cursor-specific assumptions: optional `/how`, `/why`, and `/arena` composition;
otherwise the core workflow uses ordinary code, dependency, and test tools
(`skills/blast-radius/SKILL.md:31-48`).

Portability:

- Claude Code: replace slash invocations with discovered skill calls. The proof
  ladder ports unchanged.
- Codex: fully portable after skill-name translation. Use repo commands and
  direct source inspection.
- Grok CLI: analysis ports, but live-app proof depends on whatever browser,
  process, and test controls Grok actually exposes.

Verdict: **COMPLEMENT**. `quality-review-fix-loop`, `architecture-guardian`, and
Yeet cover review and gates, but they do not center the single load-bearing
safety fact. Use `blast-radius` before the repo quality closeout for wide or
deceptively small changes.

### `architect`

Purpose, line 1: Ground a non-trivial change, sketch caller usage, types,
signatures, and module boundaries before implementation.

Purpose, line 2: Compare structurally distinct designs, implement against the
chosen contract, and discard the sketch when repeated implementation friction
proves it wrong.

Cursor-specific assumptions: Cursor todo list, `how`, `why`, Arena, configured
`architect runners`, worktrees, and model slugs. It references excluded
`principle-*` skills as normative dependencies (`skills/architect/SKILL.md`).

Portability:

- Claude Code: use Workflow children and the exact proxy IDs from the routing
  doctrine. The excluded principles must be replaced by self-contained rules or
  repo architecture doctrine.
- Codex: use native plan/collaboration agents. Cursor's `Task` model slugs and
  worktree orchestration syntax break; the sketch and scrap loop remains valid.
- Grok CLI: one-run sketching works, but Arena-style candidate isolation and
  synthesis need explicit multi-process orchestration.

Verdict: **COMPLEMENT**. Repo agents review topology and split seams, while this
skill owns design-before-implementation. In beep-effect, the port must consult
`standards/ARCHITECTURE.md`, `architecture-guardian`,
`code-patterns-strategist`, and the schema/effect developer agents before the
sketch becomes a contract.

### `arena`

Purpose, line 1: Run isolated candidates against one prompt and rubric, then
read and score every candidate rather than accepting the first plausible shape.

Purpose, line 2: Pick a base, graft only coherent strengths from the other
candidates, record rejections, and verify the synthesized artifact.

Cursor-specific assumptions: all Task calls launched in one message with
`run_in_background`, Cursor model lists, `/tmp/arena-*` fallback directories,
and a read-only cross-judge (`skills/arena/SKILL.md`).

Portability:

- Claude Code: use `parallel()` and isolated output paths. Translate models to
  Fable, `gpt-5.6-sol(medium)`, and `grok-4.6`.
- Codex: native collaboration supports isolated candidates, but concurrency and
  model names are not Cursor's. Use worker ownership and separate outputs.
- Grok CLI: requires several independent runs or a native child-agent feature;
  one context simulating all candidates violates the isolation rule.

Verdict: **COMPLEMENT**. Repo `adhd` is divergent ideation under cognitive
frames; Arena is competitive production of the same artifact with base-pick and
graft. Keep both. Use ADHD to map the idea space and Arena to choose among
implementation or design artifacts.

### `swarm`

Purpose, line 1: Partition coverage, race identical briefs, or mix both across N
parallel workers with isolated writable outputs.

Purpose, line 2: Drain every required slice and return one evidence-backed
aggregate with explicit dropouts and a declared race rule.

Cursor-specific assumptions: Cursor cloud agents, `environment: "cloud"`,
`cloud_base_branch`, background Task fan-out, and `swarm workers` routing
(`skills/swarm/SKILL.md`).

Portability:

- Claude Code: native Workflow children do not necessarily provide Cursor Cloud
  branch semantics. Use local children or a supported cloud backend and pass
  exact independent paths.
- Codex: native collaboration ports the logical workflow. Cursor cloud fields
  break; worker ownership and shared-worktree warnings are mandatory.
- Grok CLI: local/headless runs can cover races. Cloud branch injection and a
  durable aggregate need a separate orchestrator.

Verdict: **COMPLEMENT**. No repo skill owns generic partition/race aggregation.
`adhd` and `quality-review-fix-loop` are specialized fan-outs, not substitutes.

### `interrogate`

Purpose, line 1: Send one code change and one intent statement to multiple model
families for independent adversarial review.

Purpose, line 2: Deduplicate findings, weight consensus without discarding lone
security/correctness signals, and let a pragmatic lead accept or dismiss each
finding without auto-editing.

Cursor-specific assumptions: Cursor Task panel, explicit model slugs,
`readonly: true`, and recovery by reading valid slugs from Cursor's Task error
(`skills/interrogate/SKILL.md:34-89`).

Portability:

- Claude Code: use native Workflow reviewers and Fable lead synthesis. Cursor
  error-driven slug discovery does not port.
- Codex: use read-only reviewer agents and a parent lead. Model availability must
  come from Codex's supported spawn models, not pstack defaults.
- Grok CLI: a single Grok family is not a multi-model panel. Invoke external
  Fable/Sol lanes through an authorized orchestrator or report that diversity
  was not achieved.

Verdict: **DUPLICATE** of `.claude/skills/quality-review-fix-loop/SKILL.md` for
beep-effect closeout. The repo skill is better here because it grounds reviewers
in binding doctrine, uses ten repo roles, routes non-overlapping fixers, records
waivers, reruns gates, and exits only at zero required blockers. Preserve
`interrogate` only as a lightweight, read-only, no-fix review outside initiative
closeout.

### `automate-me`

Purpose, line 1: Mine recurring user preferences from workspace-scoped history
and a short structured interview.

Purpose, line 2: Create or update a concise personal `-mode` skill without
overfitting a single conversation or overwriting stable preferences.

Cursor-specific assumptions: Cursor transcript directories, `AskQuestion`,
parallel Task miners, `.cursor/skills`, Cursor's built-in `create-skill`, pstack
`poteto-mode` as an example, and PR landing (`skills/automate-me/SKILL.md`).

Portability:

- Claude Code: replace transcript discovery, questions, and `create-skill` with
  Claude equivalents. Do not read unrelated project history.
- Codex: use file memory only under the user's explicit authorization to update
  it. The current memory policy forbids writing memory unless directly asked.
- Grok CLI: likely lacks Cursor transcript layout, structured questions, and
  `create-skill`; use a user interview plus explicitly supplied evidence.

Verdict: **COMPLEMENT**. No repo skill authors a user-mode skill. It should not
run implicitly because it reads conversation history and changes future-agent
behavior.

### `make-bot-ui`

Purpose, line 1: Build a local web page whose server safely wakes a Grok Bot
webhook without exposing the sender key to browser code or chat.

Purpose, line 2: Publish that page on the existing Tailscale node and preserve
the webhook body as untrusted data.

Cursor-specific assumptions: Cursor `update_state` routine API, confirm cards,
`SendToUser` secret-request cards, Cursor automation webhook URLs, Grok Bot
routine turns, and the local connector credential file
(`skills/make-bot-ui/SKILL.md`).

Portability:

- Claude Code: the routine API, secret-request card, connector store, and wake
  envelope are absent unless a compatible Cursor automation backend is exposed.
  Do not emulate them with raw secrets.
- Codex: same breakage. If secrets move to 1Password Developer Environments,
  use the `onepassword-secret-refs` workflow and 1Password MCP, never raw values.
- Grok CLI: native Grok does not imply Cursor Grok Bot routines. The webhook and
  credential protocols remain Cursor services and need their own API client.

Verdict: **COMPLEMENT**, but non-portable as a standalone skill. No repo skill
provides this product integration. Port only behind an explicit Cursor
Automation adapter; otherwise mark it unavailable rather than inventing APIs.

### `setup-pstack`

Purpose, line 1: Detect available Cursor Task model slugs and map every pstack
role or panel to a chosen model.

Purpose, line 2: Write one idempotent always-applied Cursor rule that overrides
inline skill defaults and optionally offers verification-skill generation.

Cursor-specific assumptions: Cursor model enumeration, `AskQuestion`, writable
`~/.cursor/rules/pstack-models.mdc`, Cursor `alwaysApply` frontmatter, and
project-local `.cursor/skills/verify-*` discovery (`skills/setup-pstack/SKILL.md`).

Portability:

- Claude Code: the output file and model slugs break. Replace it with a
  Claude-side routing adapter grounded in `~/.claude/CLAUDE.md`.
- Codex: write no Cursor rule. Select models from Codex's supported agent models
  or inherit the parent when a requested provider is unavailable.
- Grok CLI: it cannot assign Fable and Sol children without an external
  multi-provider orchestrator. Store only routes the harness can execute.

Verdict: **COMPLEMENT** as configuration intent, not as a portable
implementation. The repo has no equivalent role-map skill. A shared conceptual
role map with harness-specific renderers is preferable to copying the Cursor
file format.

### `reflect`

Purpose, line 1: Mine the active conversation with judgment, tooling, and
divergent reviewers for durable corrections to skills and automation.

Purpose, line 2: Synthesize accepted edits, rejections, and structurally
enforceable backlog items, then require user approval before changing skills.

Cursor-specific assumptions: locating Cursor's active JSONL transcript,
non-readonly Task reviewers to retain MCP access, Cursor `create-skill`, and an
external devex tracker (`skills/reflect/SKILL.md` and `references/*.md`).

Portability:

- Claude Code: transcript lookup and `create-skill` routing change. Workflow
  model routing can preserve Fable judgment and Sol tooling.
- Codex: use the current session or an authorized digest. Do not update
  `~/.codex/memories` except on a direct user request. Backlog writes require
  explicit authority.
- Grok CLI: active transcript location, MCP retention semantics, and skill
  authoring are not portable. A digest-based read-only reflection still works.

Verdict: **NAME-COLLISION**. Repo `.claude/skills/reflect/SKILL.md` writes a
schema-valid reflection artifact into a goal packet and participates in P3
closeout; pstack `reflect` proposes changes to agent skills from the current
conversation. Preserve repo `reflect`. Rename pstack to `reflect-on-session` or
`skill-retrospective`, and keep its user-approval gate.

### `tdd`

Purpose, line 1: For bugs with a cheap local test target, make the broken
behavior executable and confirm the test fails for the intended reason.

Purpose, line 2: Apply the smallest production fix, prove the regression turns
green, and use the closest executable check when a good test is impractical.

Cursor-specific assumptions: none beyond generic repo/test access. The skill
does not depend on Task, Cursor model slugs, AskQuestion, or MCP names
(`skills/tdd/SKILL.md`).

Portability:

- Claude Code: portable unchanged, with repo commands substituted.
- Codex: portable unchanged.
- Grok CLI: portable if the CLI can edit and run the local test suite.

Verdict: **COMPLEMENT**. `effect-first-development` defines test laws,
`browser-qa-loop` owns gesture evidence, and Yeet owns final proof; none owns the
red-before-green regression loop. Keep TDD narrow and never let it replace the
repo's integration or QA gates.

### `no-comments`

Purpose, line 1: Run the Comment Sicko specialist over a scoped diff to delete
narration, workaround explanations, dead comments, and unsafe suppressions.

Purpose, line 2: Turn accepted "must keep" constraints into code, types, tests,
or lint where possible, while preserving narrow external, legal, and public API
exceptions.

Cursor-specific assumptions: a registered `Task` subtype named `Comment Sicko`,
Cursor `/how`, `/why`, and `/architect`, and an interactive approval step for
constraint encoding (`skills/no-comments/SKILL.md`; `agents/comment-sicko.md`).

Portability:

- Claude Code: install or define the Comment Sicko agent and translate skill
  invocations. Repo JSDoc law must override blanket deletion.
- Codex: use a purpose-built read-only reviewer role. Cursor's named subtype is
  unavailable by default.
- Grok CLI: run the agent prompt as a separate review. Automatic application and
  approval handling need harness support.

Verdict: **COMPLEMENT**. It does not duplicate
`jsdoc-annotation-specialist`: that repo skill requires useful public-export
documentation, while `no-comments` attacks internal narration and suppressions.
The port must protect `.patterns/jsdoc-documentation.md` contracts and must not
delete required titled examples or schema annotations.

### `typescript-best-practices`

Purpose, line 1: Apply general TypeScript modeling guidance for unions, brands,
boundary validation, narrowing, totality, schema-derived types, and tests.

Purpose, line 2: Supply syntax examples for those generic rules in
`skills/typescript-best-practices/references/patterns.md`.

Cursor-specific assumptions: no Task or MCP dependency, but it assumes ordinary
TypeScript conventions such as `kind` switches, hand-written brands, thrown
`Error`, native arrays, and user-defined guards.

Portability:

- Claude Code: mechanically portable, but semantically unsafe in beep-effect
  unless repo laws override it.
- Codex: same. Generic examples must not be copied into this repo.
- Grok CLI: same. Harness portability does not resolve repo-law conflicts.

Verdict: **SUPERSEDED-BY-REPO**. `.claude/skills/effect-first-development/SKILL.md`
and `.claude/skills/schema-first-development/SKILL.md` are better for this repo:
they require Effect Schema models, `LiteralKit`, `S.is`, Match helpers, typed
Effect errors, `Option`, Effect collections, and exact boundary codecs. Do not
port the generic skill into beep-effect; retain it only outside this repo.

### `figure-it-out`

Purpose, line 1: Design a rigorous, auditable playbook for large migrations or
multi-part work when no narrower workflow fits.

Purpose, line 2: Frame a falsifiable done predicate, sequence independently
verifiable experiments, and preserve an append-only evidence trail.

Cursor-specific assumptions: Cursor todo list, `poteto-mode` principles,
`architect`, Arena, subagents, and `show-me-your-work`
(`skills/figure-it-out/SKILL.md`).

Portability:

- Claude Code: the scientific loop ports, but excluded principle skills and
  Cursor orchestration must be replaced with repo packets and Workflow tools.
- Codex: use plans/goals only when the user requests them, plus repo packet
  state. Do not invent a second project-management system.
- Grok CLI: local experimentation ports; durable orchestration and review gates
  need repo artifacts and external scripts.

Verdict: **SUPERSEDED-BY-REPO**. The repo's `explore` packet lifecycle,
`quality-review-fix-loop`, goal manifests/reflections, and Yeet already provide
research, decisions, decomposition, proof, review, publication, and durable
handoff. Importing `figure-it-out` would create a parallel workflow vocabulary.
Its useful hypothesis loop should be folded into the existing packet stages,
not installed as another top-level operator.

### `show-me-your-work`

Purpose, line 1: Keep one append-only TSV row per decision or verification
checkpoint so an unattended run can be audited without replaying the transcript.

Purpose, line 2: Sanitize spreadsheet formulas, resolve evidence pointers, and
require a different-model review of the trail before handoff.

Cursor-specific assumptions: Cursor transcript paths for final audit and a
different-family Task reviewer. The bundled `scripts/log.sh` creates directories
and appends rows; `references/decision-log-template.tsv` defines the header
(`skills/show-me-your-work/SKILL.md`).

Portability:

- Claude Code: replace transcript path and reviewer spawn. The shell helper is
  portable on Unix.
- Codex: audit against the current session/durable packet evidence, not Cursor
  JSONL. The helper is portable, but repo writes need an agreed packet or scratch
  location.
- Grok CLI: TSV logging works. Transcript audit and cross-family review require
  an external session store and another provider.

Verdict: **COMPLEMENT**. Repo packets and `research/OPPORTUNITIES.md` preserve
state and friction, while this skill preserves the decision-level experiment
trail. Use it only for long unattended runs, store it in the active packet when
committed, and avoid a competing generic `.audit/` convention unless repo docs
adopt it.

### `create-verification-skill`

Purpose, line 1: Interview a repo to generate an app-specific skill that can
launch, health-check, drive, observe, and clean up the real user-facing product.

Purpose, line 2: Seed a feature map and prove one mapped feature end to end
before handing the generated verifier to future agents.

Cursor-specific assumptions: output under `.cursor/skills/verify-<app>/`,
Cursor skill registration/frontmatter, and generic browser/CDP, PTY, tmux, or
HTTP control recipes (`skills/create-verification-skill/SKILL.md` and its
`references/feature-map-example/`).

Portability:

- Claude Code: generate under a Claude/repo skill root and use portless plus the
  repo QA commands for web UI. Never generate raw Vite/Next ports.
- Codex: generate under a discovered Codex/repo skill root. Tool availability
  must be tested from Codex, not assumed from Cursor.
- Grok CLI: generated control scripts can be portable, but skill discovery and
  browser/PTY capabilities must be proved in Grok itself.

Verdict: **COMPLEMENT**. `browser-qa-loop` and `qa-session-ops` are superior for
this repo's gesture-bearing UI because they produce video, witness events,
frame strips, and schema-validated findings. The pstack skill adds a distinct
generator for CLI, API, desktop, and other non-browser products. For beep web UI
it must generate a thin adapter to `bun run beep qa`, not a parallel harness.

### `maintain-verification-skill`

Purpose, line 1: Audit every mapped feature against source in parallel, then
exercise every feature live under one coordinator-owned session.

Purpose, line 2: Ship at most one PR containing proven verifier/map corrections,
while reporting product regressions without editing product code.

Cursor-specific assumptions: project-local `.cursor/skills/verify-*`, one Task
subagent per feature, PR creation, and the generated skill's own launch/doctor
contract (`skills/maintain-verification-skill/SKILL.md`).

Portability:

- Claude Code: translate skill location and Task calls. Use the repo's portless
  and QA session rules for UI.
- Codex: use explorer agents for source-only feature reads and keep all live
  driving with the parent. Publication still routes through Yeet.
- Grok CLI: source audit works; reliable UI/CLI driving, evidence retention, and
  PR creation depend on installed controls.

Verdict: **COMPLEMENT**. Repo QA skills validate a UI change round, but they do
not maintain an app-wide feature map over time. For beep UI, use
`browser-qa-loop` as the live proof engine and Yeet for the optional PR.

### `unslop`

Purpose, line 1: Remove recurring AI prose patterns, filler, fake certainty,
promotional language, and punctuation/formatting tells.

Purpose, line 2: Restore a human voice through specificity and varied rhythm
when the audience permits it.

Cursor-specific assumptions: none at the tool level. Its frontmatter says it
must always apply, and several pstack skills treat it as a global prose filter
(`skills/unslop/SKILL.md`).

Portability:

- Claude Code: portable, but the repo copy must win because it protects neutral,
  formal, legal, controlled, and established project language.
- Codex: same. Use the repo skill already exposed to Codex.
- Grok CLI: the prose rules port, but installation/discovery is harness-specific.

Verdict: **NAME-COLLISION**. Both skills remove AI tells, but repo
`.claude/skills/unslop/SKILL.md` narrows "add soul" by audience, preserves
required syntax and established domain terms, and avoids deleting reusable
safety guidance. The repo version is better and should remain canonical. Do not
install pstack `unslop` under the same name; either omit it or rename it
`pstack-unslop` for upstream comparison only.

### `bro`

Purpose, line 1: Restate the assistant's immediately preceding message in plain
human language.

Purpose, line 2: Remove jargon and shorten the answer without changing the
underlying result.

Cursor-specific assumptions: only the chat's previous assistant message and an
explicit skill invocation (`skills/bro/SKILL.md`).

Portability:

- Claude Code: portable unchanged.
- Codex: portable unchanged.
- Grok CLI: portable unchanged if the previous response remains in context.

Verdict: **COMPLEMENT**. Repo `unslop` improves prose while it is authored;
`bro` is a user-triggered repair of an answer that already missed their level.
Keep it small rather than folding another mode into `unslop`.

### `technical-writing`

Purpose, line 1: Select a Diátaxis document mode, then apply direct-reader,
controlled-sentence, and ambiguity-reduction rules to technical prose.

Purpose, line 2: Cover docs, RFCs, READMEs, PR descriptions, and commit messages
with concrete symbols, plain words, and a repeatable review checklist.

Cursor-specific assumptions: no Task or MCP dependency. It assumes pstack
`unslop` is available and cites external style sources fetched on a stated date
(`skills/technical-writing/SKILL.md`).

Portability:

- Claude Code: portable after binding it to repo `unslop`, JSDoc law, and repo
  documentation structure.
- Codex: portable. For code exports, `jsdoc-annotation-specialist` remains the
  controlling rule set.
- Grok CLI: portable as a prose rubric; source verification and local paths must
  still be checked live.

Verdict: **COMPLEMENT**. Repo `unslop` removes prose tells and
`jsdoc-annotation-specialist` governs exported API docs, but neither supplies a
general document-type framework for RFCs, READMEs, PR bodies, and how-to guides.
Port it with repo law precedence and without duplicating JSDoc grammar.

## Agent and automation implications

Pstack's `agents/comment-sicko.md` is a real dependency of `no-comments`, not a
portable `generalPurpose` prompt label. Its application-code ban and narrow
comment exceptions must survive any port. `agents/poteto-agent.md` exists only
to route the excluded `poteto-mode`; it contributes no portable requirement to
the requested situational skills.

Benny is not a slash-skill package. `automations/benny/README.md:3-22` and
`FOR_AGENTS.md:31-36,55-89` define dormant Cursor Automation source that must be
copied into `.cursor/automations/benny/`, enabled through `.cursor/settings.json`,
and wired with Cursor `/automate`, Slack/tracker integrations, immutable thread
coordinates, a control adapter, and draft-PR-only authority. Claude Code, Codex,
and Grok CLI cannot treat those files as directly runnable automations. A port
needs an explicit automation host, Slack and tracker connectors, a secret-safe
configuration layer, and the repo's Yeet/QA publication and evidence rules.

The repo agent set is narrower and more authoritative inside beep-effect:
`architecture-guardian`, `code-patterns-strategist`,
`modularization-analyst`, `schema-first-developer`,
`effect-first-developer`, `crispener`, and `jsdoc-annotation-specialist` encode
package topology and repo laws that generic pstack panels do not know. Any
ported panel should call these roles for their owned questions rather than ask
generic reviewers to rediscover or override the doctrine.
