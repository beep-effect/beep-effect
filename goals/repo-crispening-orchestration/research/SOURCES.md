# Repo Crispening Orchestration — Sources & Provenance

<!--
The provenance ledger an implementing agent reads to trace every decision back to
its origin. Inherited from the source exploration at graduate (reproduce the
corpus here for implementation convenience AND link the exploration's ledger as
the primary copy). If this goal was authored directly (no exploration), build it
during P0 Research.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk (here, the exploration's RESEARCH/research, or this goal's
  research/*.md); otherwise cite the section that carries the claim.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
- Registered in ops/manifest.json `researchReports[]` + `currentSourceOfTruth[]`;
  `provenance.exploration` ↔ source exploration `links.goals`.
-->

- **Source exploration:** none — this packet was **authored directly** on
  2026-07-05 from a pre-grounded authoring spec plus a follow-up grill; there
  is no `explorations/` packet behind it.
- **Provenance:** primary provenance is
  `research/prompt-2026-07-05.md` — a faithful reconstruction of the original
  authoring prompt (**pending verbatim import** from the user's local session
  scratchpad; see the provenance note at the top of that file) — together with
  `research/decisions-locked.md` (decisions D1–D5, grill outcomes G1–G7,
  §2 correction table, §5 disciplines, §6 fences — locked, do not reopen).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `prompt` | Original authoring prompt (reconstruction, pending verbatim import) | this repo | `goals/repo-crispening-orchestration/research/prompt-2026-07-05.md` | Intent §0–§8 + Appendix A: crispening objective, disciplines, fences | reference |
| `decisions` | Locked decisions D1–D5 + grill outcomes G1–G7 | this repo | `goals/repo-crispening-orchestration/research/decisions-locked.md` | All settled choices; §2 correction table; §5/§6 | reference |
| `enm` | effect-native-migration packet | this repo | `goals/effect-native-migration/` | Progress model (`ops/progress.json` schema, topoOrder, reconcile-and-skip-done) + discovery/remediation prompt split (`ops/prompts/`) | reference |
| `sfv4` | schema-first-v4-capabilities packet | this repo | `goals/schema-first-v4-capabilities/` | Owns the nine existing SFV4-* rule cards this packet reuses (D1) | reference |
| `sfza` | schema-first-zero-actionables packet | this repo | `goals/schema-first-zero-actionables/` | Baseline→zero method + false-positive audit, applied here per family | reference |
| `rqt` | repo-quality-throughput tasks precedent | this repo | `goals/repo-quality-throughput/tasks/tasks.jsonc` (+ `tasks/README.md`, `tasks/tasks.schema.json`) | Acceptance/rollback task vocabulary used by `tasks/tasks.jsonc` | reference |

**How these inform implementation:** the prompt + decisions files are the
normative inputs SPEC.md was authored from — every constraint traces to one of
them. The three sibling packets contribute *shape*, not content: progress
model and prompt split from `enm`, rule-card doctrine from `sfv4`, the
per-family burndown method from `sfza`. The `rqt` tasks file is a pure
vocabulary precedent for `tasks/tasks.jsonc`; nothing is ported from it.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `.repos/effect-v4` (local checkout) | MIT (verified: `.repos/effect-v4/LICENSE`, Effectful Technologies Inc) | reference-only (API source of truth) | v4 API reality checks only — every symbol cited in prompts/specs is re-verified against this checkout (training data is v3). No code is vendored or ported; fence: codemods and waves never touch `.repos/**`. |

## 3. External research sources

None on disk. This packet was authored entirely from in-repo sources (the
reconstructed prompt, the locked-decisions file, sibling packets, and repo
source verified with `rg`). No external URLs, papers, or web research were
used, and none may be invented here.

## 4. In-repo capability references

| Capability | Path | Mode |
|------------|------|------|
| `@beep/schema` — `SchemaUtils` (`withCodecStatics`, `withKeyDefaults`), `LiteralKit`, `MappedLiteralKit` | `packages/foundation/modeling/schema/src/` | reuse |
| `@beep/utils` — `O.getSomesStruct` (heterogeneous Option-struct collection) | `packages/foundation/modeling/utils/src/Option.ts:102` | reuse |
| repo-cli schema-first lint (ruleId kit, detectors, `schemaFirstLintHasFailures`) | `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts` | extend (4 novel cards + policy consult, P0) |
| Yeet quality-issue parsing (`schemaFirstPolicyIssueFromLine` — subCategory = ruleId, so novel ruleIds parse without parser change) | `packages/tooling/tool/cli/src/commands/Yeet/internal/QualityIssueIndex.ts:852-890` | reuse, no change |
| TSMorph service (`updateSourceFile` — the only persisting edit path for codemods) | `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts` | reuse |
| Schema-first inventory baseline (advisory/exception entries, key `file::symbol::kind::ruleId::line`) | `standards/schema-first.inventory.jsonc` | extend (P1 baseline + exception ledger) |
| Crispen doctrine (the ladder, "when NOT to crispen") + effect-first / schema-first law skills | `.claude/skills/crispen/SKILL.md`, `.claude/skills/effect-first-development/SKILL.md`, `.claude/skills/schema-first-development/SKILL.md` | doctrine anchors (Law 20/47 amendment lands in the latter two + mirrors, P0) |

Net-new surfaces this packet creates (for completeness, not references):
`standards/schema-crispening.policy.jsonc` (P0),
`standards/schema-catalog.generated.jsonc` (P3), `ops/codemods/*` (P1.5).

## 5. Cross-links & provenance

- Sibling packets — cross-link, never supersede (D1):
  - `goals/schema-first-v4-capabilities/` — owns the nine SFV4-* cards.
  - `goals/schema-first-zero-actionables/` — owns baseline→zero +
    false-positive audit.
  - `goals/effect-native-migration/` — owns native-collection migration
    (fence 7 keeps that seam entirely theirs).
  - `goals/beep-schema-topology/` — owns `@beep/schema` canonical topology
    (`bun run beep lint schema-topology` stays green).
- `standards/architecture/DECISIONS.md` — the consolidated crispening ADR
  entry (G6) is **pending**: authored in P0 from this packet; amendments to
  any locked decision require a superseding entry there.
- Decision trail inside this packet: `research/prompt-2026-07-05.md` →
  `research/decisions-locked.md` → `SPEC.md` (normative) → `PLAN.md` →
  `tasks/tasks.jsonc` / `ops/prompts/` / `ops/codemods/README.md`.
