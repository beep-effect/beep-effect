# Lane C3: Amendment H blast radius

## Verdict

**Reshape Amendment H:** ratify the typed, deterministic GOAL.md projection for opt-in packets, but reject the claim that today's manifest fields already determine the launcher. `PacketWorkPlan` must add typed scope, prerequisites, ordered instructions, invariants, acceptance/completion, and evidence-context fields, and it must separate planned `ResponsibleAgent` data from observed run receipts; the 14-file sample found 0% irreplaceable prose but 57.1% of launcher characters require fields absent today. Keep the contract private in Goals/PacketCore with a Goals renderer, migrate by advisory render-and-diff plus human approval, and freeze terminal legacy launchers unless resumed instead of rewriting all 142 files at once.

## Evidence method

This report records repository evidence as `path:line` citations or as commands with their real output. The only repository write made by this lane is this report file, as required by the lane contract.

## 1. Manifest reality

### What the schemas type

The current `GoalManifest` decoder is intentionally a compatibility schema, not a schema for the whole wire file. Its file header says it types only fields read by Goals tooling, ignores unknown keys on decode, and preserves bespoke keys only in the raw JSON (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:6-12`). The class types identity, completion gate, lifecycle/claim metadata, phase id/name/status/exit, and capability edges; it does **not** type `agentLaunchers`, `stopConditions`, `currentSourceOfTruth`, `researchReports`, prompt content, tools, skills, model, effort, or approver (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:448-472`). `GoalPhase` itself has only `status` plus optional `id`, `name`, and `exit` (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:271-301`). The decoder's own contract confirms that unknown top-level keys are accepted and stripped, so placing a `PacketWorkPlan` only in raw manifest JSON would leave typed consumers blind to it (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:416-425`).

`PacketCore` does not currently fill that gap. Its schema module models the immutable event chain, status/stage/risk derivation, and read-only trace projections, while the transition plan is an operation that predicts event writes, not an authoring work plan (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1-12`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1185-1247`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1324-1371`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketTransitionWriter.ts:229-269`).

### Live wire census

The repository has **225 packet manifests: 160 goal manifests and 65 exploration manifests**. Across all 225 files there are **81 distinct top-level key shapes**. Goals alone account for 80 shapes; every exploration manifest shares one separate shape. The earlier research report's 214-packet/79-shape numbers are stale (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:99-104`).

The requested field counts, counting a packet when the top-level key exists, are:

| Field / condition | All 225 | Goals 160 | Explorations 65 |
| --- | ---: | ---: | ---: |
| `agentLaunchers` | 139 | 139 | 0 |
| `stopConditions` | 139 | 139 | 0 |
| `currentSourceOfTruth` | 150 | 150 | 0 |
| `researchReports` | 112 | 112 | 0 |
| schema version other than `initiative-manifest/v2` | 130 | 65 | 65 |

The only launcher `kind` values are **`codex-goal` (138 occurrences)** and **`claude-driver` (1 occurrence)**. Version counts are 95 `initiative-manifest/v2`, 56 `initiative-manifest/v1`, 5 `1.0.0`, 4 missing, and 65 `exploration-manifest/v1`. Thus all exploration manifests count as non-v2 under the question's literal definition; among goals, 65 of 160 are non-v2.

Command and real output:

```text
$ files=(goals/*/ops/manifest.json explorations/*/ops/manifest.json)
$ printf 'goal_manifests=%s\n' "$(printf '%s\n' goals/*/ops/manifest.json | wc -l)"
goal_manifests=160
$ printf 'exploration_manifests=%s\n' "$(printf '%s\n' explorations/*/ops/manifest.json | wc -l)"
exploration_manifests=65
$ printf 'all_manifests=%s\n' "${#files[@]}"
all_manifests=225
$ jq -s '{distinct_top_level_key_shapes: ([.[] | (keys | sort | join("|"))] | unique | length), agentLaunchers: ([.[] | select(has("agentLaunchers"))] | length), stopConditions: ([.[] | select(has("stopConditions"))] | length), currentSourceOfTruth: ([.[] | select(has("currentSourceOfTruth"))] | length), researchReports: ([.[] | select(has("researchReports"))] | length), non_v2: ([.[] | select(.schemaVersion != "initiative-manifest/v2")] | length)}' $files
{
  "distinct_top_level_key_shapes": 81,
  "agentLaunchers": 139,
  "stopConditions": 139,
  "currentSourceOfTruth": 150,
  "researchReports": 112,
  "non_v2": 130
}
$ jq -r '.agentLaunchers[]?.kind // empty' $files | sort | uniq -c
      1 claude-driver
    138 codex-goal
$ jq -r '.schemaVersion // "<missing>"' $files | sort | uniq -c
      5 1.0.0
      4 <missing>
     65 exploration-manifest/v1
     56 initiative-manifest/v1
     95 initiative-manifest/v2
```

Breakdown command and real output:

```text
$ for scope in goals explorations; do files=($scope/*/ops/manifest.json); printf '%s\n' "$scope"; jq -s '{packets:length, key_shapes:([.[]|(keys|sort|join("|"))]|unique|length), agentLaunchers:([.[]|select(has("agentLaunchers"))]|length), stopConditions:([.[]|select(has("stopConditions"))]|length), currentSourceOfTruth:([.[]|select(has("currentSourceOfTruth"))]|length), researchReports:([.[]|select(has("researchReports"))]|length), non_v2:([.[]|select(.schemaVersion != "initiative-manifest/v2")]|length)}' $files; done
goals
{
  "packets": 160,
  "key_shapes": 80,
  "agentLaunchers": 139,
  "stopConditions": 139,
  "currentSourceOfTruth": 150,
  "researchReports": 112,
  "non_v2": 65
}
explorations
{
  "packets": 65,
  "key_shapes": 1,
  "agentLaunchers": 0,
  "stopConditions": 0,
  "currentSourceOfTruth": 0,
  "researchReports": 0,
  "non_v2": 65
}
```

This heterogeneity is not incidental. A required `PacketWorkPlan` cannot simply be added to the existing manifest class without an adoption mode because 130 files are non-v2 and 21 goal manifests lack `agentLaunchers` today (225-file census above). The proposal needs an explicit schema-version and legacy policy before a renderer can be a fleet-wide check.

## 2. GOAL.md render feasibility

### Classification rule

The fleet has **142** `goals/*/GOAL.md` files, not "~150" for migration planning. Evidence: `rg --files goals -g 'GOAL.md' | wc -l` returned `142`.

I sampled 14 launchers: seven legacy packets created 2026-05-01 through 2026-06-29 and seven v2 packets created 2026-08-08 through 2026-08-26. The sample spans active, paused, completed-retained, schema `1.0.0`, v1, and v2 packets. The manifest-summary command in the appendix records every sampled creation date, schema version, and relevant list length.

I used this non-tautological classification:

- **(a)** A deterministic renderer can produce the section from fields present in that packet's current manifest, plus fixed renderer boilerplate. Bespoke raw fields count as "present today" even when `GoalManifest` currently strips them; that makes (a) generous to H.
- **(b)** A deterministic renderer can produce the section after adding a finite semantic field such as `scope.include`, `scope.exclude`, `prerequisites`, `instructions`, `invariants`, `acceptanceCriteria`, `contextEvidence`, or `completion`. Moving a whole Markdown section into an opaque `markdown` field would not qualify.
- **(c)** Faithful output would require free synthesis or an opaque prose blob because the content cannot be represented as typed plan data. This is the irreplaceable-prose category in the question.

The four-part prompt contract maps cleanly onto those semantic fields: instruction gets ordered work steps and invariants; context gets state, rationale, and evidence; input data gets resource references; output indicator gets acceptance, verification, and completion gates. The author still supplies packet-specific judgment as field values. Rendering removes duplicate layout authorship, not the judgment.

### Every section in the 14-file sample

The line ranges are the source evidence and cover every semantic section, including the title and repo-context preamble. Within each table row, a citation beginning with `:` inherits the full `goals/<packet>/GOAL.md` path from that row's first citation. There are no category (c) sections under the rule above.

| Packet (created/version) | Category (a): current fields | Category (b): fields to add | Category (c) |
| --- | --- | --- | --- |
| `agentic-professional-runtime` (2026-05-01, `1.0.0`) | title (`goals/agentic-professional-runtime/GOAL.md:1`); packet inputs (`:10-19`); selected-rung scope from existing bespoke manifest fields (`:21-31`); acceptance (`:48-55`); completion (`:70-71`) | repo context (`:3-4`); current outcome (`:6-8`); ordered workflow (`:33-46`); verification (`:57-64`); stop policy (`:66-68`) | none |
| `unified-ai-toolchain` (2026-05-22, `1.0.0`) | title (`goals/unified-ai-toolchain/GOAL.md:1`); retained outcome (`:5-7`); inputs (`:9-18`); scope (`:20-27`); reopen action (`:29-31`); acceptance (`:33-38`); verification (`:40-52`); stop policy (`:54-56`) | repo context (`:3`) | none |
| `file-processing-capability` (2026-06-02, v1) | title (`goals/file-processing-capability/GOAL.md:1`); outcome (`:6-7`); inputs (`:9-18`); scope from the unusually rich bespoke manifest (`:20-30`); completion (`:72-73`) | repo context (`:3-4`); workflow (`:32-44`); consumer relationship (`:46-49`); acceptance (`:51-58`); verification (`:60-66`); stop policy (`:68-70`) | none |
| `repo-quality-throughput` (2026-06-06, v1) | title/outcome/mode (`goals/repo-quality-throughput/GOAL.md:1-9`); inputs (`:11-21`); current task disposition (`:23-31`); done gates (`:48-56`); verification (`:58-65`) | repo context (`:3`); execution rules (`:33-46`) | none |
| `agent-reflection-loop` (2026-06-09, v1) | title (`goals/agent-reflection-loop/GOAL.md:1`); inputs (`:8-18`); verification (`:45-52`); stop policy (`:54-57`); completion (`:59-60`) | repo context and outcome (`:3-6`); scope (`:20-25`); workflow (`:27-36`); acceptance (`:38-43`) | none |
| `desktop-chat-surface` (2026-06-12, v1) | title/outcome/prerequisites (`goals/desktop-chat-surface/GOAL.md:1-11`); packet inputs (`:13-21`); verification (`:68-75`); stop policy and completion (`:77-83`) | repo context (`:3`); proof-checkout context (`:21-25`); scope (`:27-33`); technical invariants (`:35-46`); workflow (`:48-58`); acceptance (`:60-66`) | none |
| `domain-kernel-hardening` (2026-06-29, v1) | title (`goals/domain-kernel-hardening/GOAL.md:1`); packet inputs (`:9-16`); verification (`:56-63`); stop policy/completion (`:65-70`) | repo context/outcome (`:3-7`); skill, standards, and grounding context (`:17-22`); scope (`:24-35`); workflow (`:37-46`); acceptance (`:48-54`) | none |
| `nightly-research-routine` (2026-08-08, v2) | title/mission (`goals/nightly-research-routine/GOAL.md:1-5`); ordered inputs (`:7-12`); current phase selection (`:14-15`); completion gate (`:49-52`) | hard laws (`:17-35`); dated proven-primitives context (`:37-40`); design order (`:42-44`); gates (`:46-47`) | none |
| `skill-contract-kernel` (2026-08-13, v2) | title/outcome (`goals/skill-contract-kernel/GOAL.md:1-10`); inputs (`:12-23`); verification (`:54-60`); stop policy/completion (`:62-67`) | repo context (`:3-5`); scope (`:25-32`); workflow (`:34-45`); acceptance (`:47-52`) | none |
| `packet-control-plane-core` (2026-08-17, v2) | title/outcome (`goals/packet-control-plane-core/GOAL.md:1-10`); inputs (`:12-20`); stop policy (`:61-66`) | repo context (`:3-4`); scope (`:22-30`); non-negotiable invariants (`:32-42`); workflow (`:44-53`); acceptance (`:55-59`) | none |
| `ci-step-watchdog` (2026-08-23, v2) | title/outcome (`goals/ci-step-watchdog/GOAL.md:1-8`); inputs (`:10-19`); stop policy (`:66-70`) | repo context (`:3-4`); scope (`:21-28`); detailed W1-W4 workflow (`:30-54`); acceptance (`:56-64`) | none |
| `openai-driver` (2026-08-24, v2) | title/outcome (`goals/openai-driver/GOAL.md:1-10`); inputs (`:12-24`); verification (`:66-74`); stop policy/completion (`:76-81`) | repo context (`:3-5`); scope (`:26-32`); detailed workflow (`:34-56`); acceptance (`:58-64`) | none |
| `configurable-full-document-editor` (2026-08-24, v2) | title/state (`goals/configurable-full-document-editor/GOAL.md:1-3`); outcome/inputs (`:10-23`); stop and completion (`:65-69`) | prerequisite/approval gate (`:5-8`); scope (`:25-32`); execution (`:34-45`); invariants (`:47-59`); acceptance (`:61-63`) | none |
| `lejeune-knowledge-desk-lab` (2026-08-26, v2) | title/outcome (`goals/lejeune-knowledge-desk-lab/GOAL.md:1-8`); packet inputs (`:10-17`); acceptance/stop (`:56-58`) | repo context (`:3`); skills/doctrine context (`:18-19`); scope (`:21-28`); phased execution (`:30-43`); non-negotiables (`:45-54`) | none |

### Fraction and plain answer

The sampled launchers contain **42,738 characters** as counted by `awk` in the current locale, matching the `wc -m` character-budget convention. Category (a) accounts for **18,337 characters (42.9%)**; category (b), **24,401 (57.1%)**; category (c), **0 (0.0%)**. Every sampled file has a 0% category-(c) share, so the median "typical GOAL.md" fraction is also **0%**. The full per-file output and the exact line-range classifier are in the command appendix.

So H's deterministic-render premise is feasible, and the question's conditional rejection does not fire: category (c) is not large. The important correction is that **most launcher text is category (b)**. H must describe `PacketWorkPlan` as a new authoring source that captures scope, steps, invariants, acceptance, evidence context, prerequisites, and completion semantics; the proposed agent/tools/constraints/resources/approver fields alone cannot render a typical launcher. If H instead claims that current manifest fields or the existing `PLAN.md` mechanically determine `GOAL.md`, that claim is false: 57.1% of this sample has no equivalent field in its current manifest.

The character budget can then become a useful render check. Keep `targetChars` and `maxChars` in `LauncherRender`, render deterministically, count characters with the same `wc -m` semantics already embedded in launcher checks, and fail with a structured over-budget diagnostic rather than asking an author to trim two copies by hand (`goals/openai-driver/GOAL.md:66-74`; `goals/skill-contract-kernel/GOAL.md:54-60`).

## 3. SkillContract precedent

**It is a real rendering precedent, not only a validation precedent.** `SkillContract` is a schema-first aggregate with a promise, input/output schema references, evidence subject, gates, receipt types, recovery policy, id, and version (`packages/foundation/modeling/skill-contract/src/SkillContract.ts:74-110`). `projectionBlocks` maps those fields into a fixed Markdown AST, including headings, paragraphs, tables, and recovery blocks (`packages/foundation/modeling/skill-contract/src/SkillProjection.ts:269-342`). `projectSkillDocument` schema-encodes the complete contract into frontmatter and builds the `@beep/md` document; `renderSkillMarkdown` then renders it (`packages/foundation/modeling/skill-contract/src/SkillProjection.ts:344-398`). The committed judge skill visibly contains the encoded contract and the rendered body (`packages/tooling/tool/cli/skills/qa-inventory-judge/SKILL.md:1-47`).

There is also a real writer. `runQaJudgeSkill` renders `QaJudgeContract` and writes the exact bytes to a requested path or stdout (`packages/tooling/tool/cli/src/commands/Qa/JudgeSkill.ts:44-49`; `packages/tooling/tool/cli/src/commands/Qa/JudgeSkill.ts:51-87`). Its tests compare both file and stdout output to `renderSkillMarkdown(QaJudgeContract)` byte-for-byte (`packages/tooling/tool/cli/test/qa-judge-skill.test.ts:12-47`).

Validation is the second half of the pattern. `verifySkillArtifact` performs (1) exact re-render byte equality and (2) decoded-frontmatter contract equality, then returns an allowed/denied value (`packages/foundation/modeling/skill-contract/src/SkillProjection.ts:465-524`; `packages/foundation/modeling/skill-contract/src/SkillProjection.ts:526-561`). Tests prove body tampering, contract-mismatched frontmatter, malformed frontmatter, and arbitrary schema-derived contracts (`packages/foundation/modeling/skill-contract/test/SkillProjection.test.ts:57-115`; `packages/foundation/modeling/skill-contract/test/SkillProjection.test.ts:115-205`).

The analogy has a precise limit. The implementation does **not** parse or validate hand-authored Markdown semantics: only the leading JSON frontmatter is decoded, and the body remains deliberately one-way (`packages/foundation/modeling/skill-contract/src/SkillProjection.ts:43-50`; `packages/foundation/modeling/skill-contract/src/SkillProjection.ts:415-463`). The kernel spec says the same: full Markdown-to-AST inversion is a non-goal, so proof consists of re-render byte equality plus frontmatter equality (`goals/skill-contract-kernel/SPEC.md:3-18`; `goals/skill-contract-kernel/SPEC.md:102-119`). In other words, the committed `SKILL.md` is a generated artifact whose authority is the typed contract. It is not an independently hand-authored artifact that the contract merely validates.

That makes the precedent applicable to H's **mechanism**: schema-first contract, deterministic `@beep/md` AST projection, exact-byte writer, and re-render drift check. It does not prove that the proposed `PacketWorkPlan` fields are semantically complete. `SkillContract` renders a small closed vocabulary, while the GOAL.md sample needs the larger category-(b) vocabulary enumerated above. H should cite this as a rendering-and-drift precedent and explicitly say that its semantic-coverage proof is the fleet render-and-diff migration, not PR #813 by analogy alone.

## 4. Current per-phase lane composition records

The research note's absolute wording, "nowhere" and "oral tradition," is too strong (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:57-73`). Durable records exist, but they are scattered and incomplete.

### What is recorded

- **Reflections record agent identity consistently.** There are 103 non-template reflections in `goals/*/history/reflections/`: 65 say `agent: claude`, 36 `codex`, one `fable`, and one `grok`. Across all 188 reflection files including templates, all 188 have `agent:`, while zero have frontmatter `model:`, `effort:`, `tools:`, or `skills:`. Example schema-shaped frontmatter: `goals/lexical-playground-capability-atlas/history/reflections/2026-08-25-claude.md:1-7`. Command/output is in the appendix.
- **Some phase evidence records actual lane identity, model, effort, and launcher.** The `identity-iri-fibered` P1-P2 evidence says two sequential Codex lanes used GPT-5.6 Sol, xhigh, and `codex exec -s workspace-write`, then names Lane A and Lane B (`goals/identity-iri-fibered/history/p1-p2-evidence.md:1-8`; `goals/identity-iri-fibered/history/p1-p2-evidence.md:26-39`). This is a strong counterexample to "nowhere," but it omits an allowed tool/skill set and an explicit human approver.
- **Some research records intended lane composition.** `knowledge-surface-automation` binds T1 workstreams D/C/B to separate jobs and says each dedicated worktree uses `gpt-5.6-sol`, xhigh, with the orchestrator reviewing and publishing (`goals/knowledge-surface-automation/research/p1-execution-decisions.md:9-30`). This is durable planned routing, but it is prose, not manifest data, and it does not prove that each planned run occurred.
- **Some history artifacts are structured run receipts.** The JSDoc worker eval JSON records `provider`, `model`, and `reasoningEffort` as machine-readable fields, followed by per-worker packet results (`goals/jsdoc-worker-eval/history/outputs/2026-05-12-codex-gpt-5.4-mini-low-worker-eval.json:1-21`; `goals/jsdoc-worker-eval/history/outputs/2026-05-12-codex-gpt-5.4-mini-low-worker-eval.json:21-38`). Its companion research report records the exact command and result (`goals/jsdoc-worker-eval/research/2026-05-12-codex-gpt-5.4-mini-low-worker-eval.md:3-32`). This is a specialized eval receipt, not a fleet packet work-plan convention.
- **QA ledgers sometimes bind model/effort to a sub-phase.** The lexical atlas P2 round ledger records `gpt-5.6-sol` at high effort for rounds 3 and 4 (`goals/lexical-playground-capability-atlas/history/p2-qa/2026-08-25/ROUNDS.md:13-22`). The same packet's implementation lane reports enumerate files, deviations, and verification, but their headers carry date/branch/status rather than agent/model/effort (`goals/lexical-playground-capability-atlas/history/p1-implement/2026-08-25/lane-1-report.md:1-20`; `goals/lexical-playground-capability-atlas/history/p1-implement/2026-08-25/lane-2-report.md:1-18`).
- **A few manifests inventory skills without phase binding.** Only `box-driver` and `firecrawl-driver` have top-level skill inventories, while `oip-web-launch` has a nested `skills` key; no goal manifest has an approver-like key or any `tools` key. The two top-level inventories describe availability during packet authoring rather than allowed execution tools per step (`goals/box-driver/ops/manifest.json:91-132`; `goals/firecrawl-driver/ops/manifest.json:64-105`). Command output below confirms the fleet counts.

The manifest-specific result is unambiguous: no launcher records model, effort, tools, or skills; no phase entry records any of those fields or an agent; two manifests have a top-level skills inventory; and no manifest has an approver-like key. The exact commands and real output are in the appendix under "Reflection and composition census."

### PR-body check and limitation

I attempted the requested live PR-body search with read-only GitHub API calls, including PR #813 and a paginated search for explicit model/effort vocabulary. This environment could not connect to `api.github.com`; the direct web fetch for the PR also returned no page content. I therefore do **not** claim PR bodies are empty. The exact failed command/output was:

```text
$ gh api repos/kriegcloud/beep-effect/pulls/813 --jq '[.number,.title,(.body // "")] | @tsv'
error connecting to api.github.com
check your internet connection or https://githubstatus.com
$ gh api --paginate 'repos/kriegcloud/beep-effect/pulls?state=all&per_page=100' --jq '.[] | select((.body // "") | test("model|effort"; "i")) | [.number,.title,.body] | @tsv'
error connecting to api.github.com
check your internet connection or https://githubstatus.com
```

### Consequence for H

H's motivation survives, but it should say **"fragmented, noncanonical, and not queryable as a packet plan"**, not "nowhere." More importantly, H currently mixes two facts:

1. `PacketWorkPlan` records intended assignment: which agent kind/model/effort, allowed tools/skills, constraints/resources, and approver **should** execute a step.
2. "Which model at which effort **ran** which phase" is execution provenance. It needs a run/receipt or packet event tied to the plan step, not a mutable plan field.

The distinction follows the existing packet-core architecture: events carry sequence, timestamp, actor, and a typed body, while projections derive current state (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:774-826`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:849-905`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1199-1247`). Reshape H so `WorkPlanStep` owns intent and a later `WorkPlanStepRun`/evidence receipt owns observed agent, resolved model, effort, actual tools, start/end, output references, and approval. Otherwise editing the plan after execution can rewrite history.

## 5. Architecture routing

`PacketWorkPlan` belongs in the **existing repo CLI packet core**, not `@beep/schema` and not a new package.

The architectural test is ownership, not whether the implementation uses Effect Schema. `@beep/schema` is for reusable, domain-agnostic Effect schemas, codecs, combinators, and adjacent helpers (`standards/architecture/07-non-slice-families.md:259-325`). A packet phase, an agent launcher, a packet approver, and a GOAL.md budget are repository-operation language. The top-level constitution routes repo operations, generators, policy packs, and automation to tooling (`standards/architecture/07-non-slice-families.md:32-64`), and identifies tooling as developer-operational code (`standards/ARCHITECTURE.md:167-182`). `@beep/repo-cli` already declares itself `family: tooling`, `kind: tool` (`packages/tooling/tool/cli/package.json:1-17`).

The campaign has already made the more specific placement decision. D8 requires one packet-core library colocated behind existing command groups and forbids a premature package (`explorations/packet-system-redesign/MAP.md:255-264`). Candidate 3 explicitly extends the packet-core projector plus Goals/Explore surfaces (`explorations/packet-system-redesign/MAP.md:179-191`), and H itself assigns the four symbols to candidate 3 (`explorations/packet-system-redesign/MAP.md:107-122`). The existing `PacketCore` is private command-owned implementation: the package export map blocks `./commands/Goals/PacketCore/*` (`packages/tooling/tool/cli/package.json:22-41`; `packages/tooling/tool/cli/package.json:89-108`). This is exactly the repo CLI topology's rule that command groups own private schemas, services, renderers, and semantic role files (`standards/architecture/07-non-slice-families.md:327-358`).

Recommended placement:

```text
packages/tooling/tool/cli/src/commands/Goals/
  Goals.schemas.ts                         # GoalManifest references optional workPlan during adoption
  GoalLauncher.render.ts                   # project/render/check GOAL.md
  PacketCore/
    PacketWorkPlan.schemas.ts              # PacketWorkPlan, WorkPlanStep,
                                           # ResponsibleAgent, LauncherRender
```

Keeping the work-plan schema in `PacketCore` makes it root-neutral. `PacketRoot` already covers both `goals` and `explorations` (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:69-104`), while the Explore checker imports the same private packet core (`packages/tooling/tool/cli/src/commands/Explore/Check.ts:17-40`). Keeping the GOAL renderer in the Goals group reflects that `GOAL.md` is currently a goal launcher. The `.render.ts` role is explicitly canonical for command-owned human-facing formatting (`standards/architecture/07-non-slice-families.md:337-352`). If implementation keeps all packet-core schemas in `PacketCore.schemas.ts`, that is architecturally legal but worsens an already broad file; the private `PacketWorkPlan.schemas.ts` shard is the clearer concept boundary.

Two routing consequences must be in H:

1. `GoalManifest.workPlan` should be optional in the compatibility schema until migration completes. The current decoder promises legacy compatibility and ignores bespoke keys (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:416-425`). A required field would contradict that promise immediately.
2. Explorations need an explicit policy. All 65 exploration manifests use their own single wire shape, and the Explore command currently defines only tiny root-specific status projections rather than a full exploration manifest schema (`packages/tooling/tool/cli/src/commands/Explore/Check.ts:42-61`; census in section 1). Either H is goal-only and says so, or candidate 3 adds a typed exploration-manifest boundary that can reference the same `PacketWorkPlan`. Silently attaching the goal schema to explorations would erase their different identity/lifecycle contract.

Schema-first law still applies inside the tooling home. Use schema-backed object models, a discriminated union for finite responsible-agent variants, schema-derived helpers, and schema codecs at JSON boundaries; do not export parallel pure-data interfaces. Those are the repository's executable-contract rules (`standards/ARCHITECTURE.md:114-131`).

## 6. Migration cost

The exact denominator is **142 GOAL.md files: 141 packet launchers plus the `_template` launcher**. None of their manifests has `workPlan` or `packetWorkPlan`. Of the 142, 89 are v2 and 53 are non-v2; 48 are active, 8 paused, 85 completed-retained, and one reference. Thus 56 launchers belong to live/paused work and 86 belong to terminal/reference packets. Command/output is in the appendix.

The existing corpus is not broken on its own terms. There are 425,793 launcher characters total, with median 3,269, p90 3,872, maximum 4,000, and mean 2,998.5. Of 142 files, 138 have a declared launcher budget; all 138 use `maxChars: 4000`, 137 target 3,500 and one targets 3,000, and **none currently exceeds its declared maximum**. Those counts come from the migration census commands in the appendix. H is changing authority and authoring flow, not repairing a budget-failing fleet.

### Honest options

| Option | Mechanics | Cost and risk |
| --- | --- | --- |
| **1. Fleet render-and-diff** | Translate all 141 packet launchers plus `_template` into typed plans, render every GOAL.md, and review semantic and byte diffs. Use the research report's translate → issues/assumptions → stratified review → amend schema → rerun method (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:99-120`). | Highest one-time cost: at least 284 primary file touches before fixtures/tests, 53 non-v2 manifests to reconcile, and human review over 425,793 source characters. The sample says 57.1% of text needs new fields. Exact-byte reproduction is unrealistic unless the schema stores layout/opaque prose; semantic equivalence therefore needs human sign-off. A fleet PR would be collision-prone with 56 active/paused packets and would obscure meaningful launcher changes among formatting churn. Benefit: one authority model immediately after migration. |
| **2. Freeze legacy** | Treat every existing GOAL.md as authored legacy. Only newly created packets use a work plan and generated launcher; doctor never demands a plan on legacy manifests. Optionally freeze the 86 terminal/reference packets permanently and migrate only future/live work. | Lowest immediate migration risk, but two launcher laws persist indefinitely. Read-only status is ambiguous unless files visibly declare `authored-legacy` versus `rendered`; tooling, docs, and tests must support both. Old packets remain unqueryable for planned lane composition, and a resumed legacy packet needs a defined promotion step before editing its launcher. |
| **3. Explicit opt-in with advisory render diff** **(recommended)** | Add an optional versioned work plan plus an explicit launcher authority mode. Make `_template` and the packet-system-redesign self-hosting pilot opt in first. For an opted-in packet, render to memory, compare against committed GOAL.md, report drift and budget status, but do not overwrite until a human approves the translation. Migrate the 56 active/paused launchers in bounded batches; freeze the 86 terminal/reference files unless resumed. | Moderate, spread cost and a temporary dual mode. Requires mode-aware doctor/index behavior, a projection version, golden fixtures for both modes, an assumptions report per translated packet, and a clear "resume promotes legacy" path. It gives real semantic coverage evidence before a blocking ratchet and matches the campaign's existing self-hosting/advisory-to-blocking sequence (`explorations/packet-system-redesign/MAP.md:220-237`; `explorations/packet-system-redesign/MAP.md:239-253`). |

The opt-in mode should be explicit data, not inferred from whether a field happens to exist. A semantic authority change this large should either bump the manifest version or give the nested work plan and launcher projection their own versioned discriminators. The skill-contract precedent uses exactly such a projection discriminator (`skill-contract/skill-md/v1`) and embeds the complete source contract (`packages/foundation/modeling/skill-contract/src/SkillProjection.ts:23-70`).

Migration proof should compare more than bytes. For every translated packet, report:

- all old semantic sections mapped to a typed field, with an issues/assumptions list;
- rendered character count, `targetChars`, `maxChars`, and over-budget sections;
- old-versus-rendered semantic inventory, with deleted or reordered instructions called out;
- source-reference validity and phase-reference validity;
- explicit human approval of the translation before `launcherAuthority: rendered` takes effect.

Once a packet opts in, its committed GOAL.md must fail on hand edits using the skill-contract pattern: deterministic re-render equality plus source-contract equality/provenance. Before opt-in, the same check must remain advisory or inapplicable. This is the only path that makes "READ-ONLY PROJECTION" true without pretending the current 142 files were already generated.

## Recommendation

Ratify H only after the amendment text makes these changes:

1. **Define the full prompt source, not just lane metadata.** `PacketWorkPlan` needs a version, ordered steps, stable step ids, phase references, prerequisites/dependencies, shared resource declarations, and launcher projection config. Each `WorkPlanStep` needs the four explicit prompt parts: typed/ordered `instruction`, `context`, `inputData`, and `outputIndicator`. Scope include/exclude, invariants, acceptance criteria, completion gates, and contextual evidence must have named fields inside those parts. This is the minimum vocabulary demonstrated by the 14-file inventory in section 2.
2. **Make responsibility a tagged union.** `ResponsibleAgent` should distinguish executable agent kinds whose valid config differs. Model and effort belong only on variants that use them; do not reuse launcher `kind` values `codex-goal`/`claude-driver` as if they were a complete agent ontology. Allowed and required tools/skills should be separate, because "may use" and "must load" have different enforcement. The current fleet has only two launcher kinds and no launcher model/effort/tool/skill fields (section 1 and section 4 census).
3. **Reference inherited data instead of copying it per step.** Promote `stopConditions`, `currentSourceOfTruth`, `researchReports`, and `verificationCommands` into typed plan-level registries or defaults, then let steps reference/inherit them and add narrow overrides. Copying the same strings into every step would create drift inside the new source of truth. Their current fleet coverage is uneven: 139/225, 150/225, 112/225, and the verification field was not part of the requested census (section 1 command evidence).
4. **Reuse the approval model.** Candidate 2 already owns `ApprovalReference` and freshness/digest semantics (`explorations/packet-system-redesign/MAP.md:185-190`). A work-plan step should declare the required approval role/subject; an actual approval reference belongs in immutable evidence/event history. Do not introduce a second unsealed `humanApprover: string` convention.
5. **Keep plan and run separate.** Add planned assignment fields under H. Route an observed `WorkPlanStepRun` or equivalent receipt to candidate 4's evidence work, tied to stable plan step id and source digest. This preserves the event-chain rule that recorded history is immutable and projections are derived (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1-12`; `explorations/packet-system-redesign/MAP.md:185-190`).
6. **Narrow `LauncherRender`.** It should carry a projection version, path, `targetChars`, `maxChars`, and deterministic formatting policy, while a `renderGoalLauncher` function builds the `@beep/md` document and a doctor check reports byte/budget drift. Do not put pre-rendered Markdown in the schema. The skill-contract projector is the code precedent (`packages/foundation/modeling/skill-contract/src/SkillProjection.ts:323-398`).
7. **Adopt explicitly.** Use a versioned `authored-legacy` versus `rendered` authority mode, pilot on this campaign and `_template`, run advisory render-and-diff with issues/assumptions, require human translation approval, then ratchet. Freeze 86 terminal/reference launchers; migrate 56 active/paused launchers only when touched or resumed. The exact status counts are in section 6.

With those changes, H earns ratification. Without them, it creates a typed lane-assignment fragment that cannot render most launchers, conflates planned and actual execution, and forces a fleet authority change without a migration law.

## Command evidence appendix

### Sample manifest facts

Command:

```sh
for d in agentic-professional-runtime unified-ai-toolchain file-processing-capability \
  repo-quality-throughput agent-reflection-loop desktop-chat-surface \
  domain-kernel-hardening nightly-research-routine skill-contract-kernel \
  packet-control-plane-core ci-step-watchdog openai-driver \
  configurable-full-document-editor lejeune-knowledge-desk-lab; do
  f="goals/$d/ops/manifest.json"
  jq -r --arg d "$d" '[ $d, (.initiative.created//"<missing>"),
    (.schemaVersion//"<missing>"),
    ((.currentSourceOfTruth//[])|length|tostring),
    ((.researchReports//[])|length|tostring),
    ((.verificationCommands//[])|length|tostring),
    ((.stopConditions//[])|length|tostring),
    ((.phases//[])|length|tostring) ] | @tsv' "$f"
done
```

Real output, with the final five columns equal to source/research/verification/stop/phase counts:

```text
agentic-professional-runtime  2026-05-01  1.0.0                   0   1  0  0  5
unified-ai-toolchain          2026-05-22  1.0.0                   7   0  4  6  12
file-processing-capability    2026-06-02  initiative-manifest/v1  5   3  0  0  7
repo-quality-throughput       2026-06-06  initiative-manifest/v1  11  0  4  4  8
agent-reflection-loop         2026-06-09  initiative-manifest/v1  6   0  4  4  4
desktop-chat-surface          2026-06-12  initiative-manifest/v1  6   0  5  5  4
domain-kernel-hardening       2026-06-29  initiative-manifest/v1  6   0  5  4  4
nightly-research-routine      2026-08-08  initiative-manifest/v2  8   0  5  5  5
skill-contract-kernel         2026-08-13  initiative-manifest/v2  7   8  5  5  5
packet-control-plane-core     2026-08-17  initiative-manifest/v2  7   1  5  4  6
ci-step-watchdog              2026-08-23  initiative-manifest/v2  12  3  9  7  8
openai-driver                 2026-08-24  initiative-manifest/v2  12  1  9  5  5
configurable-full-document-editor  2026-08-24  initiative-manifest/v2  9  1  8  6  5
lejeune-knowledge-desk-lab    2026-08-26  initiative-manifest/v2  7   1  5  4  5
```

### Section character classifier

The classifier assigns the exact category-(b) line ranges listed in section 2 and treats every other line as category (a); category (c) has no ranges.

```sh
awk '
function inrange(n, spec,   a,i,p) { split(spec,a,","); for(i in a){ split(a[i],p,"-"); if(n>=p[1] && n<=p[2]) return 1 } return 0 }
function bspec(f) {
 if (f ~ /agentic-professional-runtime/) return "3-4,6-8,33-46,57-68"
 if (f ~ /unified-ai-toolchain/) return "3-3"
 if (f ~ /file-processing-capability/) return "3-4,32-50,51-70"
 if (f ~ /repo-quality-throughput/) return "3-3,33-46"
 if (f ~ /agent-reflection-loop/) return "3-6,20-43"
 if (f ~ /desktop-chat-surface/) return "3-3,21-25,27-66"
 if (f ~ /domain-kernel-hardening/) return "3-7,17-22,24-54"
 if (f ~ /nightly-research-routine/) return "17-48"
 if (f ~ /skill-contract-kernel/) return "3-5,25-52"
 if (f ~ /packet-control-plane-core/) return "3-4,22-59"
 if (f ~ /ci-step-watchdog/) return "3-4,21-64"
 if (f ~ /openai-driver/) return "3-5,26-64"
 if (f ~ /configurable-full-document-editor/) return "5-8,25-63"
 if (f ~ /lejeune-knowledge-desk-lab/) return "3-3,18-19,21-54"
 return ""
}
{ bytes=length($0)+1; spec=bspec(FILENAME); cat=inrange(FNR,spec)?"b":"a";
  total[FILENAME]+=bytes; by[FILENAME SUBSEP cat]+=bytes; all+=bytes; cats[cat]+=bytes }
END {
 for (i=1;i<ARGC;i++) { f=ARGV[i]; if(total[f]>0)
   printf "%s total=%d a=%d b=%d c=0 b_pct=%.1f\n", f,total[f],
     by[f SUBSEP "a"],by[f SUBSEP "b"],100*by[f SUBSEP "b"]/total[f] }
 printf "SAMPLE total=%d a=%d b=%d c=0 a_pct=%.1f b_pct=%.1f c_pct=0.0\n",
   all,cats["a"],cats["b"],100*cats["a"]/all,100*cats["b"]/all
}' \
  goals/agentic-professional-runtime/GOAL.md \
  goals/unified-ai-toolchain/GOAL.md \
  goals/file-processing-capability/GOAL.md \
  goals/repo-quality-throughput/GOAL.md \
  goals/agent-reflection-loop/GOAL.md \
  goals/desktop-chat-surface/GOAL.md \
  goals/domain-kernel-hardening/GOAL.md \
  goals/nightly-research-routine/GOAL.md \
  goals/skill-contract-kernel/GOAL.md \
  goals/packet-control-plane-core/GOAL.md \
  goals/ci-step-watchdog/GOAL.md \
  goals/openai-driver/GOAL.md \
  goals/configurable-full-document-editor/GOAL.md \
  goals/lejeune-knowledge-desk-lab/GOAL.md
```

Real output:

```text
goals/agentic-professional-runtime/GOAL.md total=3429 a=1706 b=1723 c=0 b_pct=50.2
goals/unified-ai-toolchain/GOAL.md total=2334 a=2276 b=58 c=0 b_pct=2.5
goals/file-processing-capability/GOAL.md total=3268 a=1351 b=1917 c=0 b_pct=58.7
goals/repo-quality-throughput/GOAL.md total=2679 a=1870 b=809 c=0 b_pct=30.2
goals/agent-reflection-loop/GOAL.md total=2335 a=1129 b=1206 c=0 b_pct=51.6
goals/desktop-chat-surface/GOAL.md total=3475 a=1302 b=2173 c=0 b_pct=62.5
goals/domain-kernel-hardening/GOAL.md total=3251 a=947 b=2304 c=0 b_pct=70.9
goals/nightly-research-routine/GOAL.md total=2719 a=887 b=1832 c=0 b_pct=67.4
goals/skill-contract-kernel/GOAL.md total=2842 a=1410 b=1432 c=0 b_pct=50.4
goals/packet-control-plane-core/GOAL.md total=2836 a=1100 b=1736 c=0 b_pct=61.2
goals/ci-step-watchdog/GOAL.md total=3441 a=1009 b=2432 c=0 b_pct=70.7
goals/openai-driver/GOAL.md total=3489 a=1316 b=2173 c=0 b_pct=62.3
goals/configurable-full-document-editor/GOAL.md total=3494 a=1110 b=2384 c=0 b_pct=68.2
goals/lejeune-knowledge-desk-lab/GOAL.md total=3146 a=924 b=2222 c=0 b_pct=70.6
SAMPLE total=42738 a=18337 b=24401 c=0 a_pct=42.9 b_pct=57.1 c_pct=0.0
```

### Reflection and composition census

Commands and real output:

```text
$ rg --files goals | rg '/history/reflections/[^/]+\.md$' | wc -l
188
$ rg -l '^agent:' goals -g '**/history/reflections/*.md' | wc -l
188
$ rg -l '^model:' goals -g '**/history/reflections/*.md' | wc -l
0
$ rg -l '^effort:' goals -g '**/history/reflections/*.md' | wc -l
0
$ rg -l '^tools:' goals -g '**/history/reflections/*.md' | wc -l
0
$ rg -l '^skills:' goals -g '**/history/reflections/*.md' | wc -l
0
$ for f in $(rg --files goals | rg '/history/reflections/[^/_][^/]*\.md$'); do sed -n 's/^agent:[[:space:]]*//p' "$f"; done | sort | uniq -c
     65 claude
     36 codex
      1 fable
      1 grok
$ rg --files goals | rg '/history/reflections/[^/_][^/]*\.md$' | wc -l
103
```

Manifest commands and real output:

```text
$ jq -s '[.[]|select(any(.agentLaunchers[]?; has("model")))]|length' goals/*/ops/manifest.json
0
$ jq -s '[.[]|select(any(.agentLaunchers[]?; has("effort")))]|length' goals/*/ops/manifest.json
0
$ jq -s '[.[]|select(any(.agentLaunchers[]?; has("tools")))]|length' goals/*/ops/manifest.json
0
$ jq -s '[.[]|select(any(.agentLaunchers[]?; has("skills")))]|length' goals/*/ops/manifest.json
0
$ jq -s '[.[] | .phases as $p | if ($p|type)=="array" then $p[]? else $p[]? end | select(has("agent") or has("model") or has("effort") or has("tools") or has("skills"))] | length' goals/*/ops/manifest.json
0
$ jq -s '[.[]|select(has("skills"))]|length' goals/*/ops/manifest.json
2
$ jq -s '[.[]|select(has("tools"))]|length' goals/*/ops/manifest.json
0
$ rg -l '"(humanApprover|approver|approvedBy)"[[:space:]]*:' goals/*/ops/manifest.json | wc -l
0
```

### Migration census and budget

Commands and real output:

```text
$ files=(); for g in goals/*/GOAL.md; do files+=("${g%/GOAL.md}/ops/manifest.json"); done
$ printf 'goal_md_files=%s\n' "${#files[@]}"
goal_md_files=142
$ printf 'actual_packets_excluding_template=%s\n' "$(( ${#files[@]} - 1 ))"
actual_packets_excluding_template=141
$ jq -s '[.[]|select(has("workPlan") or has("packetWorkPlan"))]|length' $files
0
$ jq -r '.schemaVersion // "<missing>"' $files | sort | uniq -c
      2 1.0.0
     51 initiative-manifest/v1
     89 initiative-manifest/v2
$ jq -r '.initiative.status // "<missing>"' $files | sort | uniq -c
     48 active
     85 completed-retained
      8 paused
      1 reference
$ jq -s '[.[]|select(.initiative.status=="active" or .initiative.status=="paused")]|length' $files
56
$ jq -s '[.[]|select(.initiative.status=="completed-retained" or .initiative.status=="superseded" or .initiative.status=="reference")]|length' $files
86
```

Budget commands summarized every GOAL-bearing launcher and printed any overage:

```sh
files=(); for g in goals/*/GOAL.md; do files+=("${g%/GOAL.md}/ops/manifest.json"); done
printf 'goal_launchers_with_budget=%s\n' "$(jq -r '.agentLaunchers[]? | select(.path=="GOAL.md" and has("targetChars") and has("maxChars")) | 1' $files | wc -l)"
jq -r '.agentLaunchers[]? | select(.path=="GOAL.md" and has("maxChars")) | .maxChars' $files | sort -n | uniq -c | awk '{printf "maxChars[%s]=%s\n",$2,$1}'
jq -r '.agentLaunchers[]? | select(.path=="GOAL.md" and has("targetChars")) | .targetChars' $files | sort -n | uniq -c | awk '{printf "targetChars[%s]=%s\n",$2,$1}'
printf 'GOAL files over declared maxChars:\n'
for g in goals/*/GOAL.md; do
  f="${g%/GOAL.md}/ops/manifest.json"
  max=$(jq -r '[.agentLaunchers[]? | select(.path=="GOAL.md")][0].maxChars // empty' "$f")
  if [[ -n "$max" ]]; then
    chars=$(wc -m < "$g")
    if (( chars > max )); then printf '%s chars=%s max=%s\n' "$g" "$chars" "$max"; fi
  fi
done
```

Real output:

```text
goal_launchers_with_budget=138
maxChars[4000]=138
targetChars[3000]=1
targetChars[3500]=137
GOAL files over declared maxChars:
```

The empty tail means no declared overage. Character-distribution command/output:

```text
$ for g in goals/*/GOAL.md; do wc -m < "$g"; done | sort -n | awk '{a[NR]=$1; sum+=$1} END {printf "n=%d min=%d median=%d p90=%d max=%d mean=%.1f total=%d\n",NR,a[1],a[int((NR+1)/2)],a[int(NR*0.9)],a[NR],sum/NR,sum}'
n=142 min=602 median=3269 p90=3872 max=4000 mean=2998.5 total=425793
```
