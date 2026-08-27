# Pack fix report: codemode-openapi-stdlib (round 1)

Fixer: jsdoc-annotation-specialist  
Filter: `scratchpad/codemode/openapi/` and `scratchpad/codemode/stdlib/` only

## Changed files

- `scratchpad/codemode/stdlib/index.ts`
- `scratchpad/codemode/stdlib/StdLib.console.ts`
- `scratchpad/codemode/stdlib/StdLib.date.ts`
- `scratchpad/codemode/stdlib/StdLib.json.ts`
- `scratchpad/codemode/stdlib/StdLib.math.ts`
- `scratchpad/codemode/stdlib/StdLib.number.ts`
- `scratchpad/codemode/stdlib/StdLib.object.ts`
- `scratchpad/codemode/stdlib/StdLib.regexp.ts`
- `scratchpad/codemode/stdlib/StdLib.string.ts`
- `scratchpad/codemode/stdlib/StdLib.url.ts`
- `scratchpad/codemode/stdlib/StdLib.value.ts`
- `scratchpad/codemode/openapi/index.ts`
- `scratchpad/codemode/openapi/OpenAPI.runtime.ts`
- `scratchpad/codemode/openapi/OpenAPI.specification.ts`
- `scratchpad/codemode/openapi/OpenAPI.types.ts`

Runtime behavior is unchanged except documentation-adjacent schema identity:

- `$ScratchpadId.create("codemode/stdlib/...")` plus `$I.annoteSchema` on exported LiteralKits
- same-name `export type Name = typeof Name.Type` companions
- `UpdateOperator` type companion now aliases `.Type` (decoded step); encoded spelling is `UpdateOperatorEncoded`
- `CompoundOperator` same-name Type companion added; `CompoundAssignmentOperator` remains the Encoded alias
- `export { ConsoleMethod }` rewritten to `export { ConsoleMethod } from "..."` so census treats it as a re-export (rejected false positive)

## Items closed

All 36 accepted findings:

| ID | Symbol / surface | Fix |
| --- | --- | --- |
| R1-001 | `invoke` Example | Titled Example: stub `HttpClient` + JSON payload |
| R1-002 | specification owning exports | Leads, `@category`, `@since`, titled Examples on values; type aliases prose+tags |
| R1-003 | types owning exports | Same kind-split upgrade for all 49 owning exports |
| R1-004 | `fromSpec` Example | GET `/health` compile + invalid-options flip |
| R1-005 | StdLib.console module + `formatConsoleMessage` | Module header; formatting Example (`log`/`warn`/`table`) |
| R1-006 | StdLib.date module + owning values | Module header; parse/UTC, setter arity, `setTime` Examples |
| R1-007 | StdLib.json module + `invokeJsonMethod` | Real fileoverview; parse/stringify Example |
| R1-008 | StdLib.math module + owning values | Module header; PI membership, `abs`, `sumPrecise` Examples |
| R1-009 | StdLib.number module + owning values | Module header; constants, `toFixed`/`toString`, `isFinite`/`parseInt` |
| R1-010 | StdLib.object module + owning values | Module header; identity kit, `keys`, `fromEntries` |
| R1-011 | StdLib.regexp module + owning values | Module header; seven values documented |
| R1-012 | StdLib.string module + `invokeStringStatic` | Module header; `fromCharCode(65, 66)` |
| R1-013 | StdLib.url module + owning values | Module header; encode, `canParse`, parse-or-null, href methods |
| R1-014 | StdLib.value module + owning values | Module header; kits, error brand, coercions |
| R1-015 | stdlib barrel module header | Fileoverview + `@packageDocumentation` + `@since 0.0.0` |
| R1-016 | `invoke` `@category` | `execution` → `clients` |
| R1-017 | `invoke` Gotchas + `@see` | Empty input, auth none-vs-fail, cookie, JSON/text/empty body |
| R1-018 | `resolve` Gotchas | Local `#/` only; cycles/missing targets return current |
| R1-019 | `operationOutput` Gotchas | WebSocket / SSE / binary hard failures |
| R1-020 | `validateBaseUrl` / `specServerUrl` | HTTP(S) only, no query/hash, templated servers need `baseUrl` |
| R1-021 | Cookie apiKey | Diagnostic-only lead + Gotchas on cookie / `operationSecurityRequirements` / `invoke` |
| R1-022 | `operationInput` Gotchas | `_2` blocked suffix and location-prefixed collisions |
| R1-023 | types leads | Lifted `$I.annote` descriptions; differentiated carriers/credentials |
| R1-024 | `HttpMethod` Details | Encoded lowercase / decoded uppercase; decode `"post"` Example |
| R1-025 | `InputStyle` / `ParameterLocation` | Unsupported styles; path/query/header only |
| R1-026 | `Document` YAML | Host-parsed; `fromSpec` takes a decoded object |
| R1-027 | `fromSpec` Gotchas | `skipped` on success; only options fail the Effect; `ToolError` return mode |
| R1-028 | `Date.now` Clock | Gotchas on `invokeDateStatic`; ISO vs JSON on `invokeDateMethod` |
| R1-029 | `invokeJsonMethod` lead | Single lead; native-vs-schema Details; circular/Date/URL/`copyIn` Gotchas |
| R1-030 | Math extras / `random`/`sumPrecise` | Extra/missing args; Clock-like `random`; `sumPrecise` sibling |
| R1-031 | `Object.*` rejections | Promise, CodeMode values, prototype, blocked keys |
| R1-032 | RegExp undefined / lastIndex / escape-only static | Gotchas on `toHostRegex`, `invokeRegExpMethod`, `invokeRegExpStatic` |
| R1-033 | `URL.parse` null; methods return `href` | canParse vs parse-or-null; toString/toJSON both href |
| R1-034 | Coercion comments → Gotchas | Arrays via string; `Number()` no-args is `0`; error brand vs `boundedData` |
| R1-035 | Stdlib LiteralKits | `$I.annoteSchema` + same-name Type aliases; Encoded companions documented |
| R1-036 | `formatConsoleMessage` Gotchas | Prefixes, `dir`/`table`, depth 32, circular/opaque/Promise |

## Residual risk

- Examples import kit internals with paths relative to `scratchpad/.jsdoc-loop/generated-docs/examples/` (`../../../codemode/...`). Public OpenAPI constructors are not re-exported from `@beep/scratchpad/codemode` for specification/stdlib helpers.
- `UpdateOperator` same-name alias now points at decoded `1 | -1` rather than encoded `"++" | "--"`. Interpreter uses the schema value (`UpdateOperator.To` / `.Enum`), not the type alias.
- Cookie apiKey / Clock-backed `Date.now` Gotchas are preserved on `ApiKeyCookie`, `operationSecurityRequirements`, `invoke`, and `invokeDateStatic`.
- Census and `docgen:local` were not executed in this subagent (no shell tool on the worker). Parent must run the commands below and re-loop on any remaining mechanical or example-compile failures.

## Commands to run

```bash
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
zsh -ic 'tsgo -p scratchpad/codemode/tsconfig.json --noEmit --pretty false'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
```

Filter census to this pack:

- modules under `codemode/openapi/` and `codemode/stdlib/` should have empty `findings`
- owning exports in those files should have empty `findings` (re-exports including `ConsoleMethod` / `dateMethods` / `objectStatics` are graph edges)
