# Knowledge-surface inventory

Phase-0, read-only inventory for the knowledge-surface-automation initiative.

## Snapshot and method

- Snapshot: 2026-07-31T21:38:02-05:00 at HEAD `58318884957ae02237099cc40666d30e3c2d943d`.
- Population: paths returned by `git ls-files` in the requested surfaces.
- Scope: `CLAUDE.md`, `AGENTS.md`, `goals/**`, `explorations/**`, `docs/**`,
  `.claude/**`, `.agents/**`, `.codex/**`, `standards/**`, and `.github/**`.
- Excluded: `docs/generated/**`, `docs/_internal/**`, `.git`, `node_modules`, and
  every untracked file, even if present in the worktree.
- The scoped population is 3,805 tracked entries. Text scanning skipped binary
  content. `CLAUDE.md` and `.agents/skills` were counted as tracked symlinks,
  not as a second copy of their targets.
- Path occurrences are non-overlapping anchors. `YeeBois` is “bare” only when
  not immediately preceded by `/`; therefore `/home/name/YeeBois/...` counts
  once under `/home/`, not again under `YeeBois`.
- “Historical” is a conservative path classification: any hit below an explicit
  `history`, `research`, `reviews`, `synthesis`, `findings`, `outputs`,
  `reflections`, `logs`, or `.proofs` directory segment. Everything else is
  classified live/current. In particular, top-level `RESEARCH.md` files and
  authored `docs/**` default to live/current.
- Counts describe this snapshot, not a promise that every hit is defective.
  Portable conventions such as `~/.config/...` need a policy exemption even
  though they match the lexical scan.

## 1. Clone-agnosticism scan

### Headline

There are **1,741 non-overlapping path-anchor occurrences in 406 files**.
The conservative gate split is **298 live/current occurrences** versus
**1,443 archival occurrences**. The live bucket is the initial remediation
target; the archival bucket should default to exemption/rewrite-review rather
than automatic failure.

### Counts by anchor

| Anchor | Occurrences | Interpretation |
| --- | ---: | --- |
| `/home/` | 1,060 | Absolute home paths, including clone/worktree and user-config paths |
| `~/` | 401 | Home-relative paths, including portable config conventions and local mirrors |
| `/tmp/` | 195 | Temporary/scratchpad/runtime paths |
| `/run/media/` | 0 | No tracked occurrence |
| bare `YeeBois` | 85 | Mostly encoded Claude session paths and audit-pattern literals |
| **Total** | **1,741** | Non-overlapping total |

### Counts by surface

| Surface | Occurrences | Share |
| --- | ---: | ---: |
| `goals/**` | 1,236 | 71.0% |
| `explorations/**` | 409 | 23.5% |
| `standards/**` | 58 | 3.3% |
| `docs/**` | 23 | 1.3% |
| `.claude/**` | 11 | 0.6% |
| `.github/**` | 4 | 0.2% |
| `AGENTS.md` + `CLAUDE.md` | 0 | 0.0% |
| `.agents/**` | 0 | 0.0% |
| `.codex/**` | 0 | 0.0% |
| **Total** | **1,741** | **100%** |

### Live versus historical

| Gate disposition | Files | Occurrences | Meaning |
| --- | ---: | ---: | --- |
| Live/current guidance | 133 | 298 | May be executed or trusted by a fresh-clone agent |
| Historical/research artifact | 273 | 1,443 | Captured provenance, outputs, logs, or review evidence |
| **Total** | **406** | **1,741** | |

The split is intentionally conservative in favor of finding live risk. For
example, `standards/effect-first-development.md` is live even where a path is
only evidence, while `goals/ontology-workbench/research/**` is archival even
where a reader might copy a command. A future gate should allow per-file or
per-line overrides rather than relying forever on directory names.

### Semantic hit types

For the 1,461 `/home/` and `~/` anchors, a mutually exclusive line-context
heuristic gives this first-pass type distribution:

| Type | Occurrences | Rule of thumb |
| --- | ---: | --- |
| `user-config-cache-path` | 591 | Dot-config/cache paths below a user home |
| `machine-local-mirror-path` | 423 | `YeeBois` tree outside the current beep worktree |
| `beep-worktree-path` | 317 | beep-effect checkout or worktree path |
| `scratchpad-session-context` | 33 | Claude transcript/session/scratchpad path |
| `other-home-path` | 97 | Remaining home path |

The remaining disjoint anchors are 195 `temp-path` occurrences and 85
`encoded-home-or-audit-literal` occurrences. The type heuristic is suitable
for triage, not an enforcement contract: a line containing two kinds inherits
one context label.

Concrete live examples:

| Repo-relative location | Matched text | Why live |
| --- | --- | --- |
| `.claude/skills/mcp-jetbrains/SKILL.md` | `/home/elpresidank/YeeBois/projects/beep-effect` | A skill tells an agent which project path to use |
| `.claude/skills/claude-frontend-lane/SKILL.md` | `/home/elpresidank/YeeBois/projects/beep-effect2` | A machine-specific companion checkout is operational guidance |
| `goals/ai-metrics-stack/ops/manifest.json` | `/home/elpresidank/YeeBois/projects/beep-effect-worktrees/ai-metrics-p6-proof` | A manifest retains executable commands with a local worktree path |
| `.claude/settings.json` | `~/.claude/memory/beep-effect` | Portable home convention, but still a lexical hit needing an exemption |
| `.claude/skills/portless/SKILL.md` | `/tmp/portless` | Product documentation for a conventional temp directory |

Concrete archival examples:

| Repo-relative location | Matched text | Why archival |
| --- | --- | --- |
| `goals/ontology-workbench/research/ontosphere-survey-report.md` | `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere` | Source-checkout provenance in a survey report |
| `explorations/academia-corpus-mining/research/paper-catalog.jsonl` | `~/YeeBois/research/academia-2026-07` | Corpus-location provenance in a generated catalog |
| `goals/openclaw-workstation-agent/history/p0/spike-2/logs/P1-positive-final.log` | `/tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect2/.../scratchpad` | Literal captured proof log |

### Top offender files

| Occurrences | Class | File |
| ---: | --- | --- |
| 64 | archival research | `goals/ontology-workbench/research/ontosphere-survey-report.md` |
| 60 | historical log | `goals/openclaw-workstation-agent/history/p0/spike-1-filesystem-writer/a5/run-full-writer/a5-token-swap-state-log.log` |
| 59 | archival catalog | `explorations/academia-corpus-mining/research/paper-catalog.jsonl` |
| 53 | archival research | `goals/legal-document-intake/research/librarian-critic.md` |
| 44 | archival research | `explorations/agent-effectiveness-pulse/research/pulse/skill-usage.md` |
| 34 | live standard | `standards/effect-first-development.md` |
| 32 | archival research | `explorations/effect-orchestration-patterns/research/failure-vs-defect-error-helpers.md` |
| 32 | archival research | `explorations/openclaw-deployment-platform/research/adversarial-review.md` |
| 28 | archival research | `explorations/graph-3d-navigation/research/infranodus-method-corpus.md` |
| 28 | archival research | `goals/graph-3d-view/research/infranodus-method-corpus.md` |
| 21 | live standard | `standards/git-worktrees.md` |
| 15 | live control data | `goals/codex-security-findings-2026-07-08/ops/triage.json` |

## 2. Skills inventory

### Lock summary

`skills-lock.json` is version 1 with 26 skills: **21 local** and **5
GitHub-backed**. Every entry has `computedHash`; no entry has a commit SHA,
resolved commit, tag digest, or equivalent immutable upstream revision.

| Skill | sourceType | source | Hash fields | Ref / skillPath |
| --- | --- | --- | --- | --- |
| `atom-reactivity-specialist` | local | `repo-local` | `computedHash` | — |
| `claude-frontend-lane` | local | `repo-local` | `computedHash` | — |
| `crispen` | local | `repo-local` | `computedHash` | — |
| `effect-first-development` | local | `repo-local` | `computedHash` | — |
| `effect-services` | local | `repo-local` | `computedHash` | — |
| `effect-v4-imports` | local | `repo-local` | `computedHash` | — |
| `explore` | local | `repo-local` | `computedHash` | — |
| `grill-me` | github | `mattpocock/skills` | `computedHash` | `main`; `skills/productivity/grill-me/SKILL.md` |
| `grill-with-docs` | local | `repo-local` | `computedHash` | — |
| `jsdoc-annotation-specialist` | local | `repo-local` | `computedHash` | — |
| `mcp-graphiti-memory` | local | `repo-local` | `computedHash` | — |
| `mcp-jetbrains` | local | `repo-local` | `computedHash` | — |
| `onepassword-secret-refs` | local | `repo-local` | `computedHash` | — |
| `oracle` | local | `repo-local` | `computedHash` | — |
| `ponytail` | github | `DietrichGebert/ponytail` | `computedHash` | `main`; `skills/ponytail/SKILL.md` |
| `ponytail-review` | github | `DietrichGebert/ponytail` | `computedHash` | `main`; `skills/ponytail-review/SKILL.md` |
| `portless` | local | `repo-local` | `computedHash` | — |
| `quality-review-fix-loop` | local | `repo-local` | `computedHash` | — |
| `reflect` | local | `repo-local` | `computedHash` | — |
| `repo-symbol-discovery` | local | `repo-local` | `computedHash` | — |
| `schema-first-development` | local | `repo-local` | `computedHash` | — |
| `schema-model-specialist` | local | `repo-local` | `computedHash` | — |
| `shadcn` | github | `shadcn-ui/ui` | `computedHash` | `main`; `skills/shadcn/SKILL.md` |
| `teach` | github | `mattpocock/skills` | `computedHash` | `main`; `skills/productivity/teach/SKILL.md` |
| `turborepo` | local | `repo-local` | `computedHash` | — |
| `yeet` | local | `repo-local` | `computedHash` | — |

The five GitHub entries resolve an upstream repository and skill path, but not
an immutable commit: every `ref` is floating `main`, and `computedHash` is a
local content hash rather than a Git commit identifier.

### skills.sh suspects

No tracked lock or skill file contains a `skills.sh` provenance marker, so
skills.sh origin is not provable from tracked data alone.

| Suspect | What the lock proves | Upstream repo+commit resolvable from lock alone? |
| --- | --- | --- |
| `oracle` | local `repo-local` content | No repo and no commit |
| `portless` | local `repo-local` content | No repo and no commit |
| `turborepo` | local `repo-local` content | No repo and no commit; the skill text says it is based on official docs |
| `shadcn` | repo `shadcn-ui/ui`, path `skills/shadcn/SKILL.md`, ref `main` | Repo yes; immutable commit no |

Thus the four suspects are recognizable as externally inspired/official-skill
content, but only `shadcn` retains an upstream repository in the lock, and none
retains a commit.

### `.claude/skills` versus `.agents/skills`

- `.agents/skills` is the tracked symlink `../.claude/skills`; there are not two
  independent tracked trees.
- Restricted to tracked files, the logical tree contains 30 skill directories
  and 112 files.
- Skill sets are identical, and every corresponding file is byte-identical by
  construction because both names resolve to the same file.
- Precise tree drift: **0 skill-name differences and 0 file-byte differences**.
- Precise lock coverage drift: four tracked skill directories are absent from
  `skills-lock.json`: `browser-qa-loop`, `exif-provenance`,
  `motion-evidence-review`, and `qa-session-ops`.
- There are no lock-only skills.

## 3. Goals inventory

### Manifests and lifecycle

There are 109 tracked `goals/*/ops/manifest.json` files: 108 real packets plus
`goals/_template`. Every tracked packet directory has a manifest; missing
manifest count is **0**.

| schemaVersion | Manifests | Notes |
| --- | ---: | --- |
| `initiative-manifest/v2` | 43 | 42 packets plus `_template` |
| `initiative-manifest/v1` | 57 | Canonical v1 holdouts |
| `1.0.0` | 5 | Older accepted legacy token |
| missing | 4 | No `schemaVersion` member |
| **Total** | **109** | 108 packets plus template |

Lifecycle status distribution for the 108 real tracked packets:

| Status | Count |
| --- | ---: |
| active | 29 |
| paused | 1 |
| completed-retained | 74 |
| superseded | 0 |
| reference | 4 |

### The 57 explicit v1 holdouts

- `agent-effectiveness-loop`, `agent-pipeline-velocity`, `agent-reflection-loop`, `beep-schema-topology`, `box-driver`, `canonical-slice-factory`
- `chat-input-and-theming`, `chat-surface-parity`, `codex-security-findings-2026-06`, `codex-security-findings-2026-06-17`, `codex-security-findings-2026-07-08`, `desktop-chat-surface`
- `domain-kernel-hardening`, `effect-native-migration`, `epistemic-claim-lifecycle-gate`, `fallow-advisory-ratchets`, `fallow-quality-enforcement`, `fallow-zero-dead-code`
- `file-processing-capability`, `firecrawl-driver`, `form`, `gov-legal-data-driver-codegen`, `gov-legal-data-driver-delivery`, `identity-iri-core`
- `langextract-capability`, `law-practice-office-action-extraction-rung`, `law-practice-office-action-spike`, `legal-document-intake`, `lint-advisory-hardening`, `lint-toolchain-modernization`
- `m365-driver`, `m365-mcp`, `mcp-host-retrofit`, `mcp-kit`, `official-data-sync-foundation`, `one-round-loop`
- `ontology-agent-surface`, `ontology-interop-roadmap`, `ontology-workbench`, `oppold-corpus-pipeline`, `oppold-corpus-refresh`, `pandoc-ast-foundation`
- `provenance-shared-claim-kernel`, `quality-gate-ratchets`, `repo-cli-modularization`, `repo-crispening-orchestration`, `repo-quality-throughput`, `rich-text-foundation`
- `schema-first-v4-capabilities`, `schema-first-zero-actionables`, `semantic-foundation`, `skillopt-training-pilot`, `standards-remediation`, `storybook-app`
- `uspto-mcp`, `workspace-thread-domain`, `yeet-agent-ergonomics`

The five `1.0.0` packets are `agentic-professional-runtime`,
`ai-metrics-stack`, `canvas`, `jsdoc-worker-eval`, and
`unified-ai-toolchain`.

The four manifests with no version are `nlp-adjunct-port`,
`oip-web-production-hardening`, `repo-quality-convergence`, and
`trustgraph-doc-ontology`.

### `goals/INDEX.md` drift

The tracked INDEX is stale relative to the tracked manifest population:

- INDEX says **110 packets: 31 active**, while tracked manifests normalize to
  **108 packets: 29 active**.
- Two INDEX rows have no manifest in `git ls-files`:
  `coding-agent-effectiveness-evidence-loop` and
  `knowledge-surface-automation`, both shown as active.
- There are no manifest-only rows and no status mismatches among the 108 shared
  packet IDs.

This is an important tracked-snapshot result: untracked packet directories may
exist in the worktree, but the phase-0 population excludes them. The generated
tracked INDEX has moved ahead of its tracked inputs.

## 4. Explorations inventory

There are **40 tracked exploration packets**, plus `explorations/_template`
and the non-packet cohort metadata directory `explorations/_gold-intake`.
All 40 packets have `ops/manifest.json`; `INBOX.md` is empty; every packet slug
is mentioned somewhere in `ATLAS.md`.

| Dimension | Value | Count |
| --- | --- | ---: |
| stage | capture | 6 |
| stage | research | 1 |
| stage | align | 2 |
| stage | graduate | 31 |
| status | active | 23 |
| status | parked | 2 |
| status | graduated | 15 |

### Declared goal graduation/provenance

Thirty-two exploration manifests declare at least one `links.goals` target;
there are **49 declared exploration-to-goal links** total.

| Exploration | Declared goals |
| --- | --- |
| `agent-chat-interface` | `rich-text-foundation`, `workspace-thread-domain`, `desktop-chat-surface` |
| `agent-effectiveness-pulse` | `harness-otel-adoption`, `harness-hygiene-mechanical`, `coding-agent-effectiveness-evidence-loop` |
| `agent-execution-sandbox` | `agent-execution-authority` |
| `agent-memory-tiers-bitemporal-edges` | `epistemic-bitemporal-edge-core`, `epistemic-contradiction-triage` |
| `agent-pipeline-velocity` | `agent-pipeline-velocity` |
| `atlas-synthesis` | `epistemic-claim-lifecycle-gate`, `law-practice-office-action-spike` |
| `citation-grounding-hallucination-guard` | `citation-verified-span-substrate`, `citation-extraction-engine` |
| `computable-workspace-geometry` | `pretext-driver`, `dock-substrate-landing` |
| `court-vocabulary-resolver` | `court-reporter-vocabulary` |
| `deterministic-doc-structure-extraction` | `law-doc-structure-oa-slice` |
| `docx-roundtrip-interop` | `pandoc-ast-foundation` |
| `domain-layer-hardening` | `domain-kernel-hardening` |
| `effect-jsdoc-quality` | `effect-jsdoc-quality` |
| `effect-orchestration-patterns` | `effect-v4-workflow-engine-spike` |
| `gov-legal-data-driver-codegen` | `gov-legal-data-driver-codegen`, `gov-legal-data-driver-delivery`, `gov-legal-mcp` |
| `graph-3d-navigation` | `graph-3d-view` |
| `identity-as-iri` | `identity-iri-core`, `identity-iri-fold` |
| `ingestion-security-secret-governance` | `ingestion-secret-scrub` |
| `ip-attorney-time-tracking` | `law-time-capture-spine` |
| `legal-ontology-landscape` | `semantic-foundation` |
| `local-first-projection-sync` | `projection-dispatch-core` |
| `local-first-voice` | `voice-composer-slice` |
| `mcp-auth-gated-registration` | `mcp-kit`, `uspto-mcp`, `mcp-host-retrofit`, `agent-execution-authority` |
| `microsoft-365-integration` | `m365-driver`, `m365-mcp` |
| `multi-provider-llm-dispatch-fallback` | `llm-provider-subscription-auth` |
| `ontology-agent-surface` | `ontology-agent-surface` |
| `openclaw-deployment-platform` | `openclaw-workstation-agent` |
| `rag-retrieval-projection` | `hybrid-retrieval-fusion-core` |
| `secure-document-download-proxy` | `secure-document-delivery` |
| `skillopt-training-pilot` | `skillopt-training-pilot` |
| `solo-firm-docketing` | `law-docketing-patent-spine`, `law-docketing-reliability` |
| `uspto-patent-driver-depth` | `uspto-prosecution-read`, `uspto-ptmnfee2-ingest` |

The eight packets with no declared goal are:

- Active/capture: `agent-governance-control-plane`,
  `epistemic-belief-view-revision`, `knowledge-workspace`,
  `model-artifact-admission`, `project-intelligence`, and `stack-installer`.
- Parked/align: `academia-corpus-mining` and `effect-ontology-harvest`.

These are not structural orphans: all eight are placed in the matching Active
or Parked ATLAS section/prose, and the absence of a goal matches their current
lifecycle.

### Rough stale/orphan pass

- **Structural orphans: 0.** Every tracked packet has a manifest and README,
  and every slug is present in ATLAS.
- **Unresolved tracked link: 1.** `agent-effectiveness-pulse` declares
  `coding-agent-effectiveness-evidence-loop`, whose manifest is not tracked in
  this snapshot. The other 48 exploration-to-goal links resolve.
- **Potential lifecycle review: 1.** `computable-workspace-geometry` remains
  active at stage `graduate` while both goals declared in its exploration
  manifest are completed-retained. ATLAS explicitly says follow-ons remain, so
  this is a review candidate, not a finding of stale status.
- **Provenance asymmetry: 7 directed pairs.** The exploration side alone lists
  `agent-effectiveness-pulse` → `coding-agent-effectiveness-evidence-loop`,
  `docx-roundtrip-interop` → `pandoc-ast-foundation`,
  `gov-legal-data-driver-codegen` → `gov-legal-data-driver-delivery`, and
  `mcp-auth-gated-registration` → `agent-execution-authority`. The goal side
  alone claims `agent-chat-interface` → `chat-surface-parity`,
  `atlas-synthesis` → `provenance-shared-claim-kernel`, and
  `computable-workspace-geometry` → `ontology-workbench-migration`.
- The exploration side contains 49 pairs and the goal side 48; aggregate
  counts still understate the seven pair-level disagreements.

## 5. Finding-class taxonomy

These names are proposed as stable gate classes.

| Gate class | Count | Definition | Examples |
| --- | ---: | --- | --- |
| `host-path-in-live-guidance` | 298 occurrences | Anchor outside an explicit archival directory | `.claude/skills/mcp-jetbrains/SKILL.md`; `standards/git-worktrees.md`; `goals/ai-metrics-stack/ops/manifest.json` |
| `host-path-in-historical-artifact` | 1,443 occurrences | Anchor below an archival/research/proof directory | `goals/ontology-workbench/research/ontosphere-survey-report.md`; `explorations/academia-corpus-mining/research/paper-catalog.jsonl`; `goals/openclaw-workstation-agent/history/p0/spike-2/logs/P1-positive-final.log` |
| `skill-lock-coverage-drift` | 4 skills | Tracked skill directory missing from lock | `browser-qa-loop`; `exif-provenance`; `motion-evidence-review`; `qa-session-ops` |
| `unresolvable-skill-source` | 21 skills | Lock says only local `repo-local`, so upstream repo+commit is absent | `oracle`; `portless`; `turborepo` |
| `floating-github-skill-source` | 5 skills | Repo/path known but only floating `main`, with no commit SHA | `grill-me`; `ponytail`; `shadcn` |
| `manifest-v1-legacy` | 57 manifests | Explicit `initiative-manifest/v1` holdout | `agent-effectiveness-loop`; `firecrawl-driver`; `yeet-agent-ergonomics` |
| `manifest-schema-version-gap` | 9 manifests | Five `1.0.0` plus four missing-version manifests | `ai-metrics-stack`; `nlp-adjunct-port`; `trustgraph-doc-ontology` |
| `index-drift` | 2 rows | INDEX packet/status row absent from tracked manifest truth | `coding-agent-effectiveness-evidence-loop`; `knowledge-surface-automation` in `goals/INDEX.md` |
| `exploration-goal-provenance-asymmetry` | 7 directed pairs | Link exists on only one side of exploration↔goal metadata | `agent-effectiveness-pulse`/`coding-agent-effectiveness-evidence-loop`; `agent-chat-interface`/`chat-surface-parity`; `computable-workspace-geometry`/`ontology-workbench-migration` |
| `unresolved-exploration-goal-link` | 1 link | Exploration target has no tracked manifest | `agent-effectiveness-pulse` → `coding-agent-effectiveness-evidence-loop` |

Negative controls worth encoding, although they are not observed findings:

| Control class | Count | Evidence |
| --- | ---: | --- |
| `skill-tree-drift` | 0 | `.agents/skills` is a symlink to `.claude/skills`; same tracked bytes |
| `goal-packet-missing-manifest` | 0 | All 108 tracked packet directories have manifests |
| `exploration-orphan` | 0 | All 40 packets have manifests/READMEs and ATLAS placement |

## 6. Open questions and judgment calls

1. Should portable conventions such as `~/.config`, `~/.codex`, `~/.bun`, and `/tmp/portless` receive a documented-convention exemption distinct from archival exemption?
2. Should executable command blocks inside research remain live even when their file receives a directory-based archival exemption?
3. Should paths in completed-retained manifests remain live? This report says yes because manifests remain control-plane inputs.
4. Should `computedHash` be complemented by immutable upstream commit and acquisition provenance?
5. Are `oracle`, `portless`, and `turborepo` deliberate repo-local forks needing “forked from” metadata?
6. Should `.agents/skills` remain a symlink contract, or should gates support two materialized trees for tools that do not preserve symlinks?
7. Are the four tracked-but-unlocked skills intentionally outside the lock population?
8. Does “v1 holdout” mean 57 explicit v1 files or all 66 non-v2 manifests? This report keeps the classes separate.
9. Should INDEX generation enumerate only `git ls-files` manifests so tracked INDEX cannot run ahead of tracked truth?
10. Are exploration `links.goals` exhaustive while goal `provenance.exploration` is primary-only, requiring permitted asymmetry rather than equality?
11. Should active/graduate explorations name outstanding candidates structurally after all currently linked goals close?
12. Should `_gold-intake` be encoded as reserved cohort metadata rather than inferred as a non-packet from its missing manifest?
