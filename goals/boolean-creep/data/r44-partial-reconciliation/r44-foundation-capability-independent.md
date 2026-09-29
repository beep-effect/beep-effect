# R44 lane `r44-foundation-capability`: independent reconciliation

- **Source:** `862327c74e`
- **Main:** `8c16e648527a`
- **HEAD / origin/main:** verified without changing refs.
- **Worktree:** clean apart from the live round's untracked report directory.
- **Lane files:** all 165 hash-equal to `frozen-inputs.json`.

| Input | sha256 |
|---|---|
| Seed | `3bb91f7f…` (equals the canonical inventory binding) |
| Receipt | `843c9a76…` |
| Transcript | `acff87c7…` |
| Raw report | empty (`e3b0c442…`) |

**Result:** `independentCoverageAccepted: true` for this lane only. There are no new records, no classification changes, and no unresolved owner questions.

## Scanner run

The scanner exited 0 with `end_turn` after 20 turns. It read 30 files, ran 36 greps (several head-limited, 2 apparently truncated), listed 3 directories and made one empty write.

Its own evidence does not establish full coverage. The empty report earns nothing on its own, and the acceptance below rests on this review.

The scanner's "citation drift" claims are wrong. The canonical anchors 247, 316, 284 and 131 are current. Each points at a first-member line or a declaration line, and the SPEC field rule allows both.

## Coverage of 165 files

I ran three independent passes over every assigned file:

1. **Block pass.** A brace-scoped search for owners with two or more Boolean members found 53 blocks in 21 files. All of them are seeded owners, their constructors and examples, or producers of seeded owners.
2. **Name pass.** Clustering Boolean-like local and key names found 41 clusters in 26 files.
3. **Declaration census.** 140 Boolean declaration lines across 44 files. I read every file with two or more declarations outside a seeded block at the site.

None of the non-seeded candidates is admissible. Each falls into one of these:

- callable predicates or methods
- function parameters
- single-Boolean owners, including `BuilderMeta.isEmpty`, `ProcessLike.isTTY`, `Application.fromCache`, `ValidationResult.valid`, `TierGateAuditRecord.destructive` and `RedactedCause.truncated`
- one Boolean plus a payload, below the rule that an owner needs at least two Booleans: `MinimalFoldStartSearch{exhausted, matches}` and `ToolHandlerResult{isFailure, failureOrigin?}`
- Boolean members split across distinct owners (`LearnCorpus`)
- `ColorInfo | false` exports
- the single wire field `CallToolResult.isError`

The JSON lists each site.

## The 22 seed owners: all upheld

**Qualified (4)**

| Seed | Classification | Evidence |
|---|---|---|
| `color-support-level-flags` | E4 | The ladder `has16m ⇒ has256 ⇒ hasBasic` in `translateLevel` and in the browser constants. |
| `langextract-minimal-fold-segment-kind` | E1/E2 | The regex alternation makes the flags exclusive; the `Match.when` chain never handles both at once. |
| `r2-foundation-unique-match-search` | E1/E2, tagged-union | Writers set exactly one of `ambiguous`, `exhausted` or `Some`. `bestAlignedMatch` reads them exclusively. `match` is an Option payload inside the coarse 8/4 cardinality. |
| `r3-foundation-tier-gate-tool-hints` | E4 | `(readOnly ∧ ¬destructive) ⇒ approved`. |

**D1 (13)**

| Seed | Why the flags are independent |
|---|---|
| `backend-capabilities` | `Composition` ORs each field independently. |
| `annotation-options-include-flags` | Each flag is serialized and gated independently. |
| `corpus-stats-parameters-include-flags` | Independent request toggles. |
| `server-observability-config-toggles` | Independent config toggles. |
| `error-reporter-layer-options-flags` | Independent option knobs. |
| `ai-token-annotation-flags` | Independently observed token facts. |
| `execution-options-cache-trace` | Independent execution knobs. |
| `shacl-validation-result-flags` | The live driver's `conforms = engine.conforms ∧ kept-empty` and `truncated = results > kept` make all four pairs reachable. |
| `source-text-page-nav-flags` | The first, middle, last and only pages cover all four combinations. |
| `supports-color-decision-input-flags` | Independent `isTTY` and `sniffFlags` inputs. |
| `color-heuristic-input-flags` | The same independent inputs, for the heuristic stage. |
| `r2-foundation-retry1-cause-redaction-truncation` | Two independent truncations, OR-folded into one stored fact. |
| `r3-foundation-verified-span-source-failure-facts` | Independently computed equality facts. |

**D2 (5)**

| Seed | External contract |
|---|---|
| `four-hint-annotations` | MCP ToolAnnotations |
| `r31-foundation-capability-mcp-wire-tool-annotations` | MCP wire hints |
| `path-safety-atomic-write-remove-options` | platform-fs remove options |
| `r32-foundation-capability-http-protocol-supports` | RpcClient Protocol contract |
| `r32-foundation-capability-ndjson-protocol-supports` | RpcClient Protocol contract |

## Scope

This reconciliation covers one lane. It does not make the round complete or dry, and it grants no dry-streak, campaign P3, design-ratification or implementation credit. I made no source, inventory or git changes, ran no tests, made no provider calls and did not touch the runtime.
