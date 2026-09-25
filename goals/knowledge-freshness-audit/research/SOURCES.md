# Sources and provenance

Observed 2026-09-24. Repository observations use baseline commit
b007ddd5a0df7fab0c9fbabc4c9f1b434b5f6a98 unless otherwise recorded.
The operator directly requested and approved this campaign; it did not graduate
from an exploration packet. Do not invent exploration lineage.

## Governing repository sources

| Source | Use |
| --- | --- |
| [AGENTS.md](../../../AGENTS.md) | Repository laws, secrets, generated scripts, quality/closeout, Graft routing |
| [Architecture constitution](../../../standards/ARCHITECTURE.md) | Binding architecture |
| [Non-slice families](../../../standards/architecture/07-non-slice-families.md) | Tooling and driver ownership |
| [Driver boundaries](../../../standards/architecture/03-driver-boundaries.md) | External API wrapper placement |
| [Goals standard](../../../goals/README.md) and [template](../../../goals/_template/) | Packet shape, lifecycle, launcher, reflection |
| [Parent SPEC](../../knowledge-surface-automation/SPEC.md) | Inherited workstream doctrine |
| [Parent manifest](../../knowledge-surface-automation/ops/manifest.json) | Recorded parent state, distinct from potentially stale prose |
| [Parent decisions](../../knowledge-surface-automation/research/p2-grill-decisions.md) | Ratified provenance, gate, and report decisions |
| [Report approvals](../../knowledge-surface-automation/research/p1-fp-eyeball-verdicts.md) | Scope of prior operator false-positive reviews |
| [Bootstrap report](../../knowledge-surface-automation/research/p1-report-bootstrap-adopt-plan.md) | Plan-only compiler proof |
| [Research ownership](../../../research/README.md) | Immutable merged research and single-writer ledger |
| [Docs ownership](../../../docs/README.md) | Authored, generated, and private documentation |
| [Generated standards policy](../../../standards/generated-artifacts.policy.md) | Dedicated whole-repo refresh PRs |
| [Yeet skill](../../../.claude/skills/yeet/SKILL.md) | Local proof, publication, review replies, mergeable closeout |
| [ADHD skill](../../../.claude/skills/adhd/SKILL.md) | Divergence/focus method and disclosed adaptation |

## Existing code and provenance inputs

| Source | What it establishes |
| --- | --- |
| [Knowledge group](../../../packages/tooling/tool/cli/src/commands/Knowledge/) | Current finding/reference/semantic-delta implementations |
| [Skills group](../../../packages/tooling/tool/cli/src/commands/Skills/) | Updater behavior, schemas, Shadcn provenance pilot |
| [Root skills lock](../../../skills-lock.json) | Live v1 source/ref/hash metadata |
| [Notion lock](../../../plugins/notion/plugin.lock.json) | Pinned source and draft integrity placeholders |
| [Plugin marketplace](../../../.agents/plugins/marketplace.json) | Separate bundled-plugin distribution |
| [Heavy admission](../../../packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts) | Actual docs-only path policy |
| [Package script policy](../../../packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts) | Generated-script source of truth |
| [JSDoc inventory](../../../packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts) | Structural documentation checks, not prose truth |

Git inventory and source inspection support local observations. CLI help supports
available command shape, not successful execution of every command. Pilot leads
remain unverified repair candidates until their required evidence is collected.

## External sources

| Primary source | Observed claim/use | Limitation |
| --- | --- | --- |
| [TypeSafe index](https://docs.typesafe.ai/llms.txt) | API documentation discovery | Index is not accuracy proof |
| [Coding agents](https://docs.typesafe.ai/introduction/coding-agents.md) | Jev returns typed decisions, not generated code/text | Vendor capability description |
| [Models](https://docs.typesafe.ai/models.md) | jev-1.13.0, pricing, context, aliases | Mutable; refresh before spend |
| [API](https://docs.typesafe.ai/api.md) | Endpoint, structured answers, usage and errors | No paid trial performed |
| [Citation cookbook](https://docs.typesafe.ai/cookbooks/citation_check.md) | Exact matching plus semantic context classification | Small older-model example, not our benchmark |
| [Known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) | Adversarial/context/date/numeric limits | Vendor-disclosed, not exhaustive |
| [Confidence](https://docs.typesafe.ai/confidence.md) | Confidence derives from probabilities | Not empirical accuracy |
| [Legal index](https://docs.typesafe.ai/legal.md) | Links to retention/privacy terms and enterprise ZDR | No assumption of enterprise treatment |

Public Markdown was retrieved directly over HTTPS when the web reader could not
handle an endpoint. Summaries retain source URLs and observation dates, not full
third-party pages. The planning PR vendors no new upstream content and asserts
no new license determination. Later skill snapshots must retain source licenses
and applicable notices.

## Freshness rule

A source pointer is provenance, not perpetual validity. Before execution, refresh
mutable capabilities and vendor facts, while preserving this dated planning
record. Retain evidence content/context and immutable source identity for accepted
determinations. A stale retrieval, unavailable source, or model recollection
cannot stand in for verification.
