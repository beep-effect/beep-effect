---
title: "P6: same schemas is proved on the wire for four toolkits; duplicated status and NLP offset fields take the stack types"
date: 2026-11-24
lane: "p6"
reversal: "Restore the hand-spelled kg_candidate_claims status tags and the AiToken/AiSentence start/end S.Natural pairs, and drop property (e) for the non-law toolkits"
---

Every tool already publishes JSON Schema derived from its own Effect schemas (research/2026-11-24-p6-map-agent-surface.md section 3), so MCP schemas are the Effect schemas is proved, not built: property (e) runs as a parameterized case over PracticeKgToolkit, ReviewHubToolkit, LawClaimToolkit and NlpToolkit. Fields that duplicate a stack type migrate: kg_candidate_claims spells a third status vocabulary (S.tag candidate-unreviewed at PracticeKg.tools.ts:506 and a label tag at :697-721) and takes the domain PracticeKgEpistemicStatus; AiToken and AiSentence offsets (Tools/_schemas.ts:123-132,226-230) become a Position in utf16-code-unit in the row that deletes CharPosition. The KG candidate offsets keep their types because the bundle does not record their unit, and typing them as a Position would state an unmeasured unit. The 25 unannotated NLP tools gain four-hint annotations through annotateFourHints (mcp-kit/src/ToolAnnotations.ts:64-75,156). The S.toEncoded success schemas stay, since the published JSON Schema is the encoded side either way. Answers A14.

Amended after independent review. The candidate-claim `label` is produced by SQL (`PracticeKg.queries.ts:59`), so the label change edits that query and the projections test that asserts it, not only the schema. `AiEntity` gains `span` on the wire beside the migrated fields. The NLP tools take their four hints through `Tool.annotate` with `Tool.Readonly`, `Tool.Destructive`, `Tool.Idempotent` and `Tool.OpenWorld` (`.repos/effect/packages/effect/src/ai/Tool.ts:2149,2177,2205,2233`), so `@beep/nlp-processing` gains no `@beep/mcp-kit` edge.
