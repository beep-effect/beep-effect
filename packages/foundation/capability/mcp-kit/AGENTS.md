# @beep/mcp-kit Agent Guide

## Purpose & Fit
- Reusable MCP host-construction kit: credential-keyed toolkit composition, api_key_required envelope, tier-gate dispatch, progressive field-tier projection, span hygiene.

## Surface Map
| Surface | Key exports | Notes |
| --- | --- | --- |
| `SourceAuth.ts` | `SourceAuthGate`, `SourceAuthRegistration`, `resolveSourceCredential`, `decideSourceAuthMount` | schema-first per-source credential-gate registry; `Config.redacted(envVar).pipe(Config.option)` resolution |
| `ToolkitComposition.ts` | `GatedLayer`, `gatedLayer`, `composeGatedLayers` | folds credential-gated layers; `hard` vanishes at composition, `none`/`soft` always mount |
| `ApiKeyRequired.ts` | `ApiKeyRequiredFailure`, `apiKeyRequiredFailure` | `failureMode: "return"` envelope for sources whose credential is absent at call time |
| `TierGate.ts` | `TierGateOutcome`, `TierGateAuditRecord`, `TierGateVerdict`, `ToolCallRequest`, `TierGateShape`, `TierGate`, `TierGatePolicy`, `fromApprovedToolsPolicy`, `TierGateDispatchResult`, `dispatchWithTierGate`, `withEnabledWhenApprovedTool` | fail-closed `tools/call` dispatch wrapper (the real security boundary); every gated call — approved or refused — produces a `TierGateAuditRecord`; `withEnabledWhenApprovedTool` affects `tools/list` visibility only |
| `FieldTier.ts` | `FieldTierName`, `FieldTierSet`, `defineFieldTiers`, `stripNulls`, `projectFieldTier`, `estimateJsonSize`, `OversizedFieldProjection`, `ProjectWithinBudgetOptions`, `FieldProjectionOutcome`, `projectWithinBudget`, `ColumnarEnvelope`, `toColumnarEnvelope`, `FetchableHandle` | named minimal/balanced/complete `Schema.Struct` tiers, columnar reshaping, and fetchable handles for oversized payloads (never inline) |
| `SanitizedSpan.ts` | `defaultSanitizedSpanKeys`, `sanitizeTracerAttributes`, `withSanitizedToolSpan`, `sanitizedToolkit` | suppresses raw tool `parameters` from reaching span attributes; `sanitizedToolkit` is a drop-in replacement for `McpServer.toolkit(...)` with dispatch wrapped in `withSanitizedToolSpan` (upstream offers no dispatch-wrapping seam, so this mirrors `registerToolkit`'s registration loop) |
| `ToolAnnotations.ts` | `FourHintAnnotations`, `annotateFourHints`, `readOnlyToolHints`, `destructiveWriteToolHints` | applies the four MCP tool-behavior hints in one call |
| `index.ts` | `VERSION` | curated barrel re-exporting all of the above |

## Laws
- Follow repository laws through command discovery.
- Run `bun run beep docs laws`.
- Prefer tersest equivalent helper forms when behavior is unchanged.
- In `test/` and `dtslint/`, import package source through `@beep/mcp-kit` or other `@beep/*` package aliases; keep relative imports for local helpers, fixtures, and snapshots only.
- Keep package guidance concise and avoid duplicating long policy prose.

## Quick Recipes
```ts
import { VERSION } from "@beep/mcp-kit"
```

## Verifications
- `bunx turbo run test --filter=@beep/mcp-kit`
- `bunx turbo run test:integration --filter=@beep/mcp-kit`
- `bunx turbo run lint --filter=@beep/mcp-kit`
- `bunx turbo run check --filter=@beep/mcp-kit`

## Contributor Checklist
- [ ] New exports include jsdoc metadata
- [ ] Tests added or updated for behavior changes
- [ ] `bun run check` passes
- [ ] `bun run test` passes
- [ ] `bun run lint` passes
