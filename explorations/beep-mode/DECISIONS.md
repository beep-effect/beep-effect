# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-29 — vendor shape

**Question:** How much of pstack lands in the repo, and how is upstream
tracked?

**Answer:** Curated repo-local fork. Port the mode, the principles, and the
situational skills that add capability; rewire playbooks to repo machinery
(`yeet`, `browser-qa-loop`, `explore`, `reflect`); drop Cursor-only pieces
(`setup-pstack`, `make-bot-ui`, `automations/benny`, `scripts/orch`,
`scripts/watch-pr` pending round 3). Provenance is `repo-local` in
`skills-lock.json` with the upstream rev (`68836dd`, v0.14.5) and MIT notice
recorded in the skill; upstream updates are manual diff-merges against the
`~/YeeBois/dev/cursor-plugins` clone.

**Rationale:** A tailored fork always reports `RemoteSkillDrift` under
`beep skills update`, so GitHub-tracked provenance and tailoring are mutually
exclusive. Rejected: verbatim `pstack-*` mirror plus thin overlay (33+ lock
entries, doubled slash menus and prompt prefix in four harnesses); principles
+ mode only (loses the multi-model panel skills).

## 2026-08-29 — entry point

**Question:** Keep `poteto-mode` as the engine with a personal mode layered on
top (pstack's `/automate-me` design), or one forked mode?

**Answer:** Single forked mode. No `poteto-mode` skill in the repo; its
non-negotiables, autonomy, subagent, and reply rules are rewritten with the
operator's principles merged in. Attribution stays in the skill header.

**Rationale:** Two sticky modes with overlapping triggers fight in every
harness and double the principle sets to keep coherent. Rejected: layered
modes; no mode at all (loses playbook routing and todo-list-first discipline).

## 2026-08-29 — vehicle

**Question:** Direct PR, goal packet, or exploration packet?

**Answer:** Exploration packet (`explorations/beep-mode/`), this grill as its
align stage, graduating to a goal packet for the PRs (vendor + tailor,
model-role routing, eval). The `agent-config-canonicalization` INBOX bullet
stays a separate capture; this packet is an instance of it, not its owner.

**Rationale:** The routing and eval follow-ups need a home; the packet
pipeline is the repo's design-before-implement path. Rejected: direct PR on
`@slop/08-29-26` (no home for follow-ups); goal packet directly (scope not yet
crystallized).

## 2026-08-29 — principle layout

**Question:** Skill per principle (pstack layout), one `principles` skill,
mode-owned references, or `standards/` doctrine?

**Answer:** Mode-owned references: index inline in the mode's `SKILL.md`,
leaf files at `references/principles/<name>.md` (pstack's 21 plus beep
principles as siblings). Steer-by-name is preserved through the index.

**Rationale:** Every skill dir costs a `.codex/config.toml` entry, a slash-menu
row in four harnesses, and a prompt-prefix line (AGENTS.md Context Economy).
Rejected: 21+ `principle-*` dirs (highest cost); a separate `principles`
skill (one extra dir, marginal benefit); `standards/` doctrine (turns style
into law next to the architecture constitution).

## 2026-08-29 — mode name

**Question:** What is the forked mode called?

**Answer:** `beep-mode`. Slash command `/beep-mode`, packet slug `beep-mode`,
subagent `beep-agent` if one ships.

**Rationale:** Repo-branded, matches `beep` CLI and `@beep/*`, reads the same
in all harnesses. Rejected: `benjamin-mode` (person-branded, awkward for
other contributors); `rigor`; `deep-mode`.

## 2026-08-29 — Cursor plugin enablement

**Question:** What happens to the `.cursor/settings.json` plugin enablement
written by `/add-plugin pstack`?

**Answer:** Removed from the repo (unstaged and deleted 2026-08-29). The
global plugin cache stays for diffing upstream releases.

**Rationale:** Cursor also scans `.claude/skills`, so the plugin and the fork
would both register `/how`, `/why`, `/unslop`, `/reflect`. Rejected: keep
both enabled (duplicate names); uninstall entirely (clone already serves as
the upstream reference, but the cache is free to keep).

## 2026-08-29 — playbook set

**Question:** Which of pstack's 23 playbooks does `beep-mode` ship?

**Answer:** Codex's disposition table
(`research/pstack-distillation/01-poteto-mode-and-playbooks.md`) as-is: keep
trace-forensics unchanged; adapt the other 18 (Graphite, Cursor `Task`, model
slugs, control-ui/cli, deslop, Bugbot, `/loop` replaced by yeet,
browser-qa-loop, explore/goals packets, crispen, repo worktree law); drop
autopilot-full, autopilot-stack, shipping (Graphite merge-when-ready and
delegated merge authority contradict the operator-owned merge rule) and
worktree-cleanup (macOS/Xcode/Cursor-specific).

**Rationale:** Rejected: a core subset of ~10 (defers hillclimb, eval,
orchestrate, autonomous-run, which the overnight-run use case needs); porting
all 23 with "not applicable" banners (four dead routes in every menu).

## 2026-08-29 — conflicting and extending principles

**Question:** How are principle leaf files written when pstack conflicts with
repo doctrine (Boundary Discipline vocabulary, Laziness Protocol vs
schema-first design order, Never Block on the Human vs the align gate) or
extends it (twelve principles)?

**Answer:** Keep the upstream body verbatim and append a `## In beep-effect`
block per leaf. Conflicts state precedence explicitly with the law cited
(effect-laws-v1 #6/#9/#14, schema-first design order, align gate, merge
authority); extensions add the repo mechanism in a sentence or two.

**Rationale:** Diffable against upstream, keeps the MIT attribution boundary
crisp. Rejected: rewriting every leaf in repo voice (loses the upstream diff);
dropping the three conflicting principles (loses steer-by-name vocabulary that
matters during overnight runs).

## 2026-08-29 — beep principles

**Question:** Which repo laws become sibling principles next to pstack's 21?

**Answer:** Six judgment rules only: (1) schema-first design order (schema →
`Context.Service` contract → implementation, behind the align gate); (2)
Effect v4 verified from live source (`.repos/effect`); (3) proof via `beep qa`
for gesture-bearing UI; (4) worktree hygiene: preserve operator work, keep
publication authority explicit; (5) friction receipts at the moment of
friction; (6) packet lifecycle closes in the same PR as the work.

**Rationale:** Machine-enforced laws (Effect collections, `effect/unstable/http`,
`LiteralKit`) already have lints; restating them as principles violates
Encode Lessons in Structure. Rejected in this round: an effect-native
vocabulary pointer principle; a delegation/quota-routing principle; working-
style principles (challenge through types/schemas, learn by porting,
recommendation first). Those stay in the operator's global rules and the
mode's routing section, not in the principle index.

## 2026-08-29 — pstack scripts (agent-made, flagged for review)

**Question:** What happens to `scripts/orch`, `scripts/watch-pr`, and
`show-me-your-work/scripts/log.sh`?

**Answer:** Drop `watch-pr` (`bun run beep yeet monitor --watch --until-event`,
`status --remote`, `closeout`, `reply` already own single-PR babysitting; no
Graphite stack queue exists here). Drop `orch` (Graphite frontier and Cursor
agent lifecycle baked in; a beep version would be a schema-first Effect
implementation over yeet exact-head state, which is a separate goal). Keep
`log.sh` and the TSV template with `show-me-your-work`.

**Rationale:** Per the distillation's script assessment. Not put to the
operator because both drops follow from the already-settled Graphite and
merge-authority decisions; reversible if a multi-PR queue program is adopted
later.

## 2026-08-29 — situational skill set (wave 1)

**Question:** Which pstack situational skills ship alongside the mode?

**Answer:** The COMPLEMENT set, trimmed: `how`, `why`, `recall`
(file-memory-first, no shared memory service), `blast-radius`, `architect`
(consults `standards/ARCHITECTURE.md`, `architecture-guardian`,
`code-patterns-strategist` before a sketch becomes a contract), `arena`,
`swarm`, `tdd`, `no-comments` (+ Comment Sicko, with JSDoc law overriding
blanket deletion), `show-me-your-work` (trail lives in the active packet when
committed), `technical-writing`, `bro`, `create-verification-skill` (for beep
web UI it generates a thin adapter over `bun run beep qa`, never a parallel
harness). Skipped: `make-bot-ui` (Cursor automation APIs), `automate-me`,
`setup-pstack` (the mode owns the role map), `maintain-verification-skill`
(later wave). Dropped: `interrogate` (duplicate of `quality-review-fix-loop`),
`typescript-best-practices` (superseded by effect-/schema-first skills; its
generic patterns break repo laws), `figure-it-out` (superseded by `explore`
packets).

**Rationale:** Per `research/pstack-distillation/03-situational-skills-overlap.md`.
Rejected: every COMPLEMENT verbatim (four skills unrunnable in three
harnesses); panel-core only (defers recall, decision trails, technical
writing that the overnight and PR flows need).

## 2026-08-29 — name collisions

**Question:** How do `unslop`, `teach`, and `reflect` collisions resolve?

**Answer:** Repo `unslop` stays canonical; pstack's is not vendored. pstack
`teach` ships as `explain`. pstack `reflect` merges into the repo `reflect`
skill as a second lane (session retrospective → proposed skill edits, user-
approved) next to the packet-artifact lane; one reflect vocabulary.

**Rationale:** Repo `unslop` is audience-aware and protects established
terms. Repo `teach` is a distinct multi-session course tool (mattpocock).
Merging reflect keeps one word for "capture what we learned"; the repo skill
already invites codifying TODOs. Rejected: rename both ports (`explain` +
`retro`) without merging; replacing repo `teach`/`unslop` with upstream.

## 2026-08-29 — model-role routing surface

**Question:** What replaces `~/.cursor/rules/pstack-models.mdc` for the panel
skills?

**Answer:** `beep-mode/references/model-roles.md`: one row per pstack role
label (labels kept verbatim so ported skills read the same names), columns for
Claude direct / `claudex`+`claudeg` proxy (`gpt-5.6-sol(medium)`, `grok-4.6`,
`gpt-5.6-luna`) / Codex / Grok CLI / Cursor, plus the fallback rule: inherit
the parent when the harness cannot route that provider. Opus seat removed.
Codex delegations pin `--effort medium`; never set
`CLAUDE_CODE_SUBAGENT_MODEL`.

**Rationale:** One repo-tracked table, readable by every harness, no per-user
writer. Rejected: per-user rule files per harness (drift, three writers); no
role map (loses cross-family panels inside one proxy session).

## 2026-08-29 — agents

**Question:** Do `poteto-agent` and `Comment Sicko` get ported?

**Answer:** Yes, as `beep-agent` and `comment-sicko` in `.claude/agents/*.md`
with `.codex/agents/*.toml` mirrors. `beep-agent` is the delegate type the
playbooks name; it reads `beep-mode` and the principles index before working.
Codex's `beep-agent` is the primary heavy-work target (operator quota rule);
Claude's is for judgment-shaped delegation only. `comment-sicko` is read-only
and subordinate to JSDoc law (`.patterns/jsdoc-documentation.md`).

**Rationale:** Without a mode-reading delegate type, delegated work drifts
(pstack's stated reason for `poteto-agent`). Rejected: comment-sicko only;
no new agents (prompt-only delegates).

## 2026-08-29 — autonomy contract

**Question:** Where does `beep-mode` draw the autonomy line between pstack's
proceed-on-reversible posture and repo doctrine?

**Answer:** Gate design, free the rest. The align gate stays for schema-,
service-, and architecture-shaping decisions and for opening new packets;
other reversible edits proceed without asking. `bun run beep yeet publish
--pr` is allowed once the align gate has passed. `yeet merge` never without an
explicit instruction. Overnight overrides ("going to bed", "run until done")
keep the loop going but cannot cross the merge line.

**Rationale:** Preserves the operator's design-before-implement rule and merge
ownership while keeping overnight/autonomous playbooks live. Rejected:
pstack-permissive (schema decisions without the operator); repo-strict
(autonomous-run and hillclimb become inert).

## 2026-08-29 — stickiness outside Cursor

**Question:** How does the mode stay on in Claude Code, Codex, and Grok, which
have no `mode:` frontmatter?

**Answer:** One `Touch → Skill / Command` row in `AGENTS.md`: non-trivial
multi-step task → load `beep-mode`. Cursor additionally gets `mode: true` and
`reminder:` frontmatter. No marker files or hooks in wave 1.

**Rationale:** Harness-neutral, one prefix line, no runtime machinery.
Rejected: marker file + hook pulse on three hook surfaces (true stickiness,
three surfaces to maintain; revisit if drift is observed); explicit invocation
only.

## 2026-08-29 — attribution mechanics (agent-made, flagged for review)

**Question:** Where do the MIT notice and upstream provenance live?

**Answer:** `.claude/skills/beep-mode/LICENSE.pstack.md` carries the full
upstream MIT text (copyright 2026 Lauren Tan). Every ported skill's `SKILL.md`
opens with an HTML comment naming upstream path, rev `68836dd` (v0.14.5), and
"beep-effect bindings" (the same shape `grilling` uses for its mattpocock
origin). `skills-lock.json` provenance is `repo-local`.

**Rationale:** Matches the repo's existing attribution convention and MIT's
notice requirement.

## 2026-08-29 — reply and comment style

**Question:** Do pstack's absolute punctuation bans and comment discipline
carry over?

**Answer:** Framing rules yes: consumer-then-maintainer impact first, short
declaratives, no fabricated links or citations, every cited principle names
the decision it changed, no narrating comments (JSDoc law wins on exports).
Punctuation follows the repo `unslop` skill, not pstack's em-dash and
mid-sentence-colon bans.

**Rationale:** Repo prose uses em dashes throughout and the repo `unslop` was
deliberately softened. Rejected: pstack rules verbatim (inconsistent with the
rest of the repo); framing only (loses the narration-deletion tell that
`no-comments` relies on).

## 2026-08-29 — eval before promotion

**Question:** How is `beep-mode` proven before it is promoted?

**Answer:** Port pstack's eval playbook (blinded A/B, isolated variant dirs,
neutral labels, frozen judge-only rubric, cross-family judge, transcript
check that principle files were opened) and run it once: beep-mode vs no-mode
on two real repo tasks (one feature, one bug fix) in isolated worktrees, Sol
workers, Fable judge, rubric frozen in the packet. Promote on a clear win or a
documented tie; artifacts land in `goals/<slug>/history/`.

**Rationale:** Cheapest evidence that the mode changes behavior. Rejected:
wiring into `skillopt` (scores laws, not playbook discipline; heavier setup);
ship-observe-iterate (no evidence).

## 2026-08-29 — graduation shape

**Question:** How does the work decompose into goal packets and PRs?

**Answer:** One goal, `goals/beep-mode/`, three phased PRs: P1 mode core
(SKILL.md, 19 playbooks, 27 principle leaves, `beep-agent` + `comment-sicko`
with Codex mirrors, `model-roles.md`, `LICENSE.pstack.md`, AGENTS.md row,
`beep skills update`); P2 the 13 situational skills, `explain`, merged
`reflect`; P3 eval run, promotion, closeout reflection in the same PR.

**Rationale:** One SPEC and decision log with explicit sequential
dependencies. Rejected: two goals (core vs skills; the skills wave has no
independent value without the mode); one PR (~40-file diff plus eval
artifacts in one review).
