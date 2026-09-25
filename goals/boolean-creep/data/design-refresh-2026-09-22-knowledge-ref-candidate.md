# RefCandidate adjudication / P2 audit

Source HEAD: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
The owner source bytes were compared to `git show <HEAD>:<path>` and matched.
An immutable `inventory.start.jsonl` copy was captured before source inspection.
The old row is D1 at2244; actual private owner is2261. No tracked writes occurred.

## Finding and disposition

Old D1 rationale is refuted by complete writer enumeration: independent pattern
context can coexist with ungoverned syntax, but pairing ambiguity cannot. Two
separate flag/Option-presence relationships are explicit at2648 and2690.
Propose designed E3/E2, derived/internal/tagged-union, Tier1, 512/10.

Kind has FOUR declared members, including reserved upstream (57-71), although
only three are emitted. The suggested384 representable count misses this fact;
384 is just the emitted-kind slice. The selected finite projection includes all
three Boolean members and all four Option-presence slots, but excludes metadata,
payload values and nested-ref variants. Nested ref already has a union; remove
outer kind/payload duplication instead of redesigning that public wire schema.

`cardinality-proof.json` records all ten source-derived tuples and their axes.
This arithmetic/source enumeration was executed by Python; the scanner witnesses
in the design are source-derived, not runtime fixture results. No tests ran.

## Discovery and scope

Graft scoped search covered all RefCandidate and pairing/ungoverned uses; schema
search confirmed KnowledgeRefKind and all nested member schemas; test search
located the existing golden/error/ordering fixtures. Graft callers RefCandidate
has no graph edges, so its negative result was not treated as closure proof.
Direct exact-symbol/member search after Graft completed local use accounting.
Three factories create every candidate. Collection, ordering, slug pre-resolution,
resolution/classification and observation/identity construction are all audited.

ClassificationInput is a distinct exported broader raw-input owner. The other
lane reports a hold for that qualification; this proposal preserves the existing
classifier API and constructs its already-required input at the current callsite.
It claims no deletion of public classifier guards or acceptance changes there.

No product implementation, independent P3, census/dry-round, publication or merge
credit. Parent is the sole canonical inventory/design writer.

## Input SHA-256 bindings

- `inventory.start.jsonl`: `de0477d42e7c44de5d1f41e869565bce230d2378542f9ed4d1785bf28f69cf38`
- `goals/boolean-creep/GOAL.md`: `560a143a9a389f361a14c08d15818ab7fb988be6b85f4f403ee17cb64f2d188d`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `.claude/skills/schema-first-development/SKILL.md`: `bcd55b12b37c7d1d334351b52c2571558faa85ca5977261bb5861623e323eeb5`
- `.claude/skills/graft/SKILL.md`: `ac2174c568e0059c3a3516f9911efe87456e337c3103064d2827a5447fe0063b`
- `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts`: `d5e890c27397f55dd21d003a13426430b65360ec76d572565e71787a03292aa8`
- `packages/tooling/tool/cli/test/knowledge-refs.test.ts`: `94cf4a86180258f8c938d9a50eb55640ec039c799d2ab6e640d6f6f893298ecb`
- `packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts`: `8359e2c68161e01fba2e93bbac6f5fc522cf869ca3c0fa6a20703509d883c707`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`

## Proposal SHA-256 bindings

- `proposed-row.json`: `6f6a1abe97a03b12a38c54f0e11bd687066c02859515855258e3f70efbf27597`
- `proposed-design.md`: `ec2afe409759560494ab4f7470021e04d3daabdf3796eec9b21a5d1bc9a5d992`
- `cardinality-proof.json`: `ae8c60bee060b7311c9ef11df346e0643c7aabd1422ece8790aa8e7a66f1cf3e`

Parent integration: input hashes verified; starting inventory preserved at `history/inventory/2026-09-22-pre-knowledge-websocket-refresh.jsonl`. No implementation or independent-review credit.
