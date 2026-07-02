# @beep/uspto-mcp Agent Guide

## Purpose & Fit
- Thin MCP host wiring @beep/uspto through @beep/mcp-kit: credential-keyed composition, api_key_required envelope, field-tier projection.

## Surface Map
| Surface | Key exports | Notes |
| --- | --- | --- |
| `UsptoSourceAuth.ts` | `UsptoSourceAuthRegistration` | the shared `soft`-gate `SourceAuth` registration for `USPTO_API_KEY`, consumed by both tools |
| `UsptoDocumentTiers.ts` | `usptoDocumentFieldTiers`, `DocumentsProjectionOutput`, `projectDocumentsWithinBudget` | array-level field-tier budget projector composed from `@beep/mcp-kit`'s `projectFieldTier`/`toColumnarEnvelope`/`estimateJsonSize` |
| `UsptoTools.ts` | `UsptoToolError`, `UsptoMcpFailure`, `UsptoSearchApplicationsTool`, `UsptoGetDocumentsTool`, `UsptoToolkit` | the two-tool toolkit; failures are a union of the kit's `ApiKeyRequiredFailure` and post-gate `UsptoToolError` |
| `UsptoHandlers.ts` | `UsptoToolkitHandlersLive` | resolves the shared credential via `@beep/mcp-kit`'s `resolveSourceCredential` before ever calling `@beep/uspto` |
| `Server.ts` | `makeServerLayer`, `UsptoMcpServerConfig` | stdio MCP server layer; composes the toolkit through `@beep/mcp-kit`'s `composeGatedLayers`/`gatedLayer`/`sanitizedToolkit` |
| `bin.ts` | `SERVER_CONFIG` | stdio entrypoint; provides `NodeStdio` and launches the server |
| `index.ts` | `VERSION` | package entry point |

## Laws
- Follow repository laws through command discovery.
- Run `bun run beep docs laws`.
- Prefer tersest equivalent helper forms when behavior is unchanged.
- In `test/` and `dtslint/`, import package source through `@beep/uspto-mcp` or other `@beep/*` package aliases; keep relative imports for local helpers, fixtures, and snapshots only.
- Keep package guidance concise and avoid duplicating long policy prose.

## Quick Recipes
```ts
import { VERSION } from "@beep/uspto-mcp"
```

## Verifications
- `bunx turbo run test --filter=@beep/uspto-mcp`
- `bunx turbo run test:integration --filter=@beep/uspto-mcp`
- `bunx turbo run lint --filter=@beep/uspto-mcp`
- `bunx turbo run check --filter=@beep/uspto-mcp`

## Contributor Checklist
- [ ] New exports include jsdoc metadata
- [ ] Tests added or updated for behavior changes
- [ ] `bun run check` passes
- [ ] `bun run test` passes
- [ ] `bun run lint` passes
