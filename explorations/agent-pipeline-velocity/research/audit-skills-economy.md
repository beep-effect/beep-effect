# Audit: Skills Context Economy (2026-07-05)

Read-only agent audit (workflow `wf_5e468257-0f6`). Scope: all 29
`.claude/skills/` + plugin skills. **Totals: 266,750 B ≈ 66.7k tokens of
skill bodies.** Cost model: all 29 frontmatter descriptions ride in the
always-loaded prompt; bodies cost only on trigger → expected cost =
trigger-breadth × body size.

## Config bugs (fix regardless of restructure)

1. **`crispen` is missing from skills-lock.json** — 28 of 29 dirs pinned;
   crispen is unpinned/unverified drift. (Lock lives at repo root, not .claude/.)
2. **Duplicate registrations**: `quality-review-fix-loop` and
   `onepassword-secret-refs` each appear TWICE in the live available-skills
   list — their long descriptions are paid into the always-loaded prompt twice.

## Restructure priority (expected-cost ranking)

The 3 heavyweights = 91,460 B ≈ 22.9k tokens = **34% of the corpus**.
Restructuring just the two local ones recovers **~12.6k tokens per typical
Effect+frontend session**.

| Skill | Lines | ~Tokens | Trigger | Pinned? | Action (sketch below) |
| --- | --- | --- | --- | --- | --- |
| effect-first-development | 784 | 8,677 | most sessions | local | **#1**: → ~150-line SKILL.md + 3 references (≈80% cut) |
| atom-reactivity-specialist | 788 | 7,071 | common | local | **#2**: → ~140 lines + 3 references |
| turborepo | 951 | 7,118 | most sessions | **github (vercel)** | **decision needed**: fork/convert-to-local (then cut to ~1.4k tokens) vs stay pinned (zero savings). Upstream already ships references/ dirs the inline body duplicates. Over-broad trigger ('has apps/packages dirs' — always true here). |
| schema-model-specialist | 525 | 5,011 | common | local | → ~120 lines + 4 references |
| jsdoc-annotation-specialist | 497 | 4,460 | common | local | → ~130 lines + 3 references; compress 7-clause description |
| quality-review-fix-loop | 396 | 3,820 | occasional | local | → ~120 lines + 2 references; fix duplicate registration |
| yeet | 322 | 3,613 | common | local | conservative: → ~110 lines + 2 references (operator-critical) |
| shadcn | 275 | 4,854 | occasional | github | leave as-is (already progressive, pinned) |

Full per-invocation sketches (what stays vs what moves to `references/*.md`)
are preserved in the workflow output; headline reductions:
effect-first-development ~8.7k→1.7k; atom-reactivity ~7.1k→1.5k;
schema-model ~5.0k→1.2k; jsdoc ~4.5k→1.2k; qrfl ~3.8k→1.1k; yeet ~3.6k→1.4k.
Combined potential: **~24k tokens saved per heavy session**.

## Overlap clusters (merge/scope decisions)

1. **Schema cluster**: crispen ↔ schema-first-development have near-identical
   trigger surfaces; schema-model-specialist + effect-first-development
   sections also overlap. Options: merge crispen into schema-first-development
   as stance/reference, or make crispen explicit-invocation-only. crispen's
   ~120-word description is also a top always-loaded cost.
2. **Frontend cluster**: atom-reactivity + claude-frontend-lane + shadcn can
   co-fire on any UI task (~13.6k tokens). Scope claude-frontend-lane to
   explicit Codex-handoff invocation.
3. **Grill duo**: grill-me (147 B, harmless) vs grill-with-docs — document
   grill-with-docs as the repo default.

## Constraints

- 10 skills are GitHub-pinned (re-fetched; local edits break computedHash and
  get clobbered): grill-me, teach, ponytail×6, shadcn, turborepo. Restructure
  requires fork or convert-to-local.
- `.codex/config.toml` maps skills by name/dir ("Claude remains the source of
  truth for skill bodies") — local restructures keeping SKILL.md paths need
  only a skills-lock.json hash re-pin, no Codex-side changes.
- **Gold standard to copy**: schema-first-development — 124-line SKILL.md +
  references/{examples,local-primitives,pattern-catalog,repo-laws}.md.
- ponytail's "Use on ANY coding task" is the broadest trigger in the set;
  pinned, but body is small (1.7k) so damage is modest.
