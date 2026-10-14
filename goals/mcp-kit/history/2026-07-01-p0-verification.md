# P0 Verification — 2026-07-01

Scope: re-verify the pinned `effect/ai` internals named in `SPEC.md`
Constraints / `GOAL.md` "Key design facts" against the installed workspace
source, and produce the concrete new-package wiring checklist for
`packages/foundation/capability/mcp-kit`. No files outside this report were
modified.

## Resolution note (source authority)

The workspace resolves `effect@4.0.0-beta.92` (root `package.json:158`, root
`bun.lock:4358`, `node_modules/effect/package.json` `"version": "4.0.0-beta.92"`
— pin matches `SPEC.md` exactly). `node_modules/effect` is a real materialized
package directory (not a symlink into `.repos/effect-v4`). A diff of
`node_modules/effect/src/ai/McpServer.ts` against
`.repos/effect-v4/packages/effect/src/ai/McpServer.ts` shows the two
trees have **drifted from each other** (JSDoc reformatting on unrelated
overloads — resource-registration doc blocks gained multi-line param
formatting in one but not the other). None of the diffed hunks touch the
areas this packet depends on. Per the task instruction ("verify against what
the workspace actually resolves"), **`node_modules/effect/src/ai/*`
is the authority used below**, not the `.repos/effect-v4` subtree. This
tree-divergence itself is worth a maintenance note (see Open Risks) but does
not affect any claim.

## Verified Internals

| Claim | Current anchor (resolved `node_modules/effect`) | Verdict | Decisive quote |
| --- | --- | --- | --- |
| (a) `failureMode:"return"` typed failures ship as `CallToolResult` with `isError:false` | `McpServer.ts:717-728` — **unchanged, exact line match** | CONFIRMED | `Effect.matchCause({ onFailure: (cause) => new CallToolResult({ isError: true, ... }), onSuccess: (result: any) => new CallToolResult({ isError: false, structuredContent: ..., content: [{ type: "text", text: JSON.stringify(result.encodedResult) }] }) })` (McpServer.ts:717-734). Mechanism confirmed in `Toolkit.ts:240-242`: `tool.failureMode === "return"` folds the failure schema into the *success* result union (`Schema.Union([tool.successSchema, tool.failureSchema, AiError.AiError])`), so a typed "return" failure completes the handler's Effect as a success and lands in the `onSuccess` branch → `isError:false`, JSON in `content[].text`. |
| (b) `McpSchema.EnabledWhen` filters `tools/list` only; `tools/call` dispatch does not re-check it | `callTool` (the `tools/call` dispatcher): `McpServer.ts:255-262` — **exact line match**. `tools/list` handler entry: `McpServer.ts:1451` (`"tools/list": (_, { client, headers }) =>`) — **off by one line from the prior `:1450` citation** (negligible; caused by unrelated line-count drift elsewhere in the 1524-line file, not a semantic change). The actual `EnabledWhen` check lives in the shared `filterByClient` helper at `McpServer.ts:1490-1512`, check itself at `:1506-1507`. | CONFIRMED (line-1 drift, non-invalidating) | `callTool: (request) => Effect.suspend(...): { const handle = toolMap.get(request.name); if (!handle) { return Effect.fail(...) } return handle(request.arguments) }` (McpServer.ts:255-262) — no `EnabledWhen`/`Context` lookup anywhere in this path. Contrast `tools/list`: `"tools/list": (_, { client, headers }) => ... tools: filterByClient(initialized, server.tools, "tool")` (McpServer.ts:1451/1455), and `filterByClient`: `const enabledWhen = Context.getOrUndefined(item.annotations, EnabledWhen); if (!enabledWhen \|\| enabledWhen(client)) { out.push(item[prop]) }` (McpServer.ts:1506-1507). |
| (c) `Toolkit.ts:263-265` annotates spans with raw `parameters` | `Toolkit.ts:263-265` — **exact line match** | CONFIRMED | `yield* Effect.annotateCurrentSpan({ tool: name, parameters: params })` (Toolkit.ts:263-265), inside `Effect.fnUntraced(function*(name: string, params: unknown) {...})` (Toolkit.ts:260), executed before parameter validation/decoding (decode happens later at Toolkit.ts:283-284+). Raw, undecoded caller input reaches the span annotation. |
| (d) `McpServer.ts:336-341` pins protocol version `2025-06-18` | `McpServer.ts:336-341` — **exact line match** | CONFIRMED | `const LATEST_PROTOCOL_VERSION = "2025-06-18"` / `const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-03-26", "2024-11-05", "2024-10-07"]` (McpServer.ts:336-341). `2025-11-25` is absent from the supported list, confirming the "no MCP `2025-11-25` reliance" non-goal is still accurate for this pin. |
| (e) `Layer.orElse` does not exist in effect v4; `layers.reduce(Layer.merge, Layer.empty)` compiles | `node_modules/effect/src/Layer.ts` — no `orElse` export found (`grep "export const orElse"` → no match). `Layer.empty` at `Layer.ts:1095`, `Layer.merge` dual overloads at `Layer.ts:1617-1760` | CONFIRMED | `export const empty: Layer<never> = succeedContext(Context.empty())` (Layer.ts:1095). `Layer.merge` has a two-arg data-first overload: `<RIn2, E2, ROut2, RIn, E, ROut>(self: Layer<ROut2, E2, RIn2>, that: Layer<ROut, E, RIn>): Layer<ROut \| ROut2, E \| E2, RIn \| RIn2>` (Layer.ts:1755) — this is exactly the `(accumulator, item) => ...` shape `Array.prototype.reduce` invokes its callback with, so `layers.reduce(Layer.merge, Layer.empty)` type-checks against this overload. (Note: `Layer.mergeAll` at `Layer.ts:1566` also exists as a more direct alternative for a fixed array, worth considering during implementation.) |
| (f) Optional-secret idiom `Config.redacted(envVar).pipe(Config.option)` at `Uspto.service.ts:398` | `packages/drivers/uspto/src/Uspto.service.ts:398` — **exact line match** | CONFIRMED | `const apiKey = yield* Config.redacted("USPTO_API_KEY").pipe(Config.option);` |

## Drift

**None that invalidates a resolved SPEC/DECISIONS decision.** All six pinned
facts hold at (or within one line of) their cited anchors under the
workspace's actually-resolved `effect@4.0.0-beta.92`. The only deviation
found — the one-line shift on the `tools/list` handler citation
(`:1450` → `:1451`) — is cosmetic (unrelated file-length drift) and the
substantive claim (list-only filtering, `filterByClient`/`EnabledWhen`
mechanism, `callTool` never checking it) is unchanged and independently
confirmed by reading the surrounding code, not just grepping the old line
number.

Secondary, non-blocking observation: the `.repos/effect-v4` subtree text no
longer matches what `node_modules/effect` actually resolves (see Resolution
note above). This doesn't threaten any decision here since node_modules is
authoritative for what actually builds/runs, but P1 implementers should keep
using `node_modules/effect/src/ai/*` as the reference, not
`.repos/effect-v4`, if they need to re-read source during implementation.

## New-Package Wiring Checklist

`packages/foundation/capability/` already has 8 sibling packages
(`api-transport`, `chalk`, `colors`, `file-processing`, `langextract`,
`nlp-processing`, `observability`, `semantic-web`); `api-transport` is the
closest template (small, kit-shaped, minimal live dependencies — vs.
`observability` which pulls in a large OpenTelemetry dependency graph not
relevant here).

**The repo does not have a standalone markdown package-creation checklist
doc** (`docs/` and `standards/` were searched — no hits for
"create-package"/"package creation"). The checklist *is* the `beep create-package`
CLI command; it is code, not prose, and it also runs the tsconfig/alias/docgen
sync automatically. Steps:

1. **Scaffold via the CLI, not by hand.** Run:
   ```sh
   bun run beep create-package mcp-kit --family foundation --kind capability --dry-run \
     --description "Reusable MCP host-construction kit: credential-keyed toolkit composition, api_key_required envelope, tier-gate dispatch, progressive field-tier projection, span hygiene."
   ```
   Preview first with `--dry-run` to confirm the resolved path and file list
   before writing. Command source:
   `packages/tooling/tool/cli/src/commands/CreatePackage/Handler.ts:848-1288`
   (`Command.make("create-package", ...)`); registered as a top-level `beep`
   subcommand at `packages/tooling/tool/cli/src/commands/Root.ts:67`.
   `"capability"` is a valid `--kind` for `--family foundation`
   (`VALID_FOUNDATION_KINDS`, `Handler.ts:113`).

2. **Path resolution is automatic and matches the SPEC target exactly.**
   With `--family foundation --kind capability` and package name `mcp-kit`,
   the handler derives `parentDir = packages/foundation/capability` and
   `packagePath = packages/foundation/capability/mcp-kit` (`Handler.ts:1064-1086`)
   — no `--parent-dir` or `--dir-name` flag needed.

3. **Root workspace glob already covers the new path — expect a SKIP, not an
   edit.** Root `package.json:374` already lists
   `"packages/foundation/capability/*"` in `workspaces`. The scaffold's
   `ensureRootWorkspaceEntry` step (`Handler.ts:707-728`) checks coverage via
   `isPathCoveredByWorkspacePatterns` and only writes to root `package.json`
   if the new path isn't already covered by a glob — for this path it will
   report `SKIP (already covered by an existing workspace entry)`. **No root
   `package.json` edit is expected or required.**

4. **`@beep/identity` registration is automatic.** For a `library`-type
   package (the default, no `--app-kind`), the scaffold registers the package
   name and generates a typed `$McpKitId` accessor in
   `packages/foundation/modeling/identity/src/packages.ts` via
   `ensureIdentityPackageRegistration` (`Handler.ts:795-816`,
   `IDENTITY_PACKAGES_EXPORT_PATH`). This is required for the SPEC's `$I`
   identity-annotation constraint — confirm it landed by checking that file
   for `"mcp-kit"` and `export const $McpKitId` after scaffolding.

5. **tsconfig project references, root path aliases, docgen aliases, and
   biome/syncpack/tstyche wiring are auto-generated — do not hand-edit
   `tsconfig.json`/`tsconfig.packages.json`.** The scaffold calls
   `syncTsconfigAtRoot(repoRoot, { mode: "sync", ... })`
   (`Handler.ts:1235-1239`, command source
   `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.command.ts`)
   immediately after writing files. This updates: root `tsconfig.json` path
   aliases (the `@beep/mcp-kit` / `@beep/mcp-kit/*` entries seen in the
   existing `paths` block, e.g. `tsconfig.json:91-94` for the `colors`/`chalk`
   siblings), `tsconfig.packages.json` project references (the flat list seen
   at `tsconfig.packages.json:172-193` for capability siblings), each
   dependency's `docgen.json` `examplesCompilerOptions.paths` block (pattern:
   `packages/foundation/capability/api-transport/docgen.json:29-51`), and
   dependency-cycle detection (`detectCycles`/`buildRepoDependencyIndex` in
   `TsconfigSync.command.ts`). If this needs to be re-run standalone later
   (e.g. after adding new intra-repo deps to the kit's `package.json`), the
   command is `bun run beep tsconfig-sync` (same handler, `mode: "sync"`).

6. **`turbo.json` needs no edits.** Turborepo task definitions
   (`build`/`lint`/`lint:fix`/`test`/etc. in root `turbo.json`) are
   name-keyed, not package-enumerated — turbo discovers every workspace
   package from the `package.json` `workspaces` glob and runs whichever
   named script that package defines. The scaffolded `package.json` already
   carries matching `build`/`check`/`test`/`lint`/`audit` scripts (see next
   step), so the new package is automatically in scope for every existing
   turbo task with zero `turbo.json` changes.

7. **`package.json` template is auto-generated by `generatePackageJson`**
   (`Handler.ts:1309-1497`) and matches the `api-transport` sibling shape:
   `"beep": {"family": "foundation", "kind": "capability"}` metadata block,
   `sideEffects: []`, `exports` map (`.`, `./*`, `./internal/*: null`,
   `./package.json`), matching `publishConfig.exports` pointing at `dist/`,
   the standard `beep:build`/`beep:check`/`beep:check:tests`/`beep:test`/
   `beep:test:integration`/`beep:lint`/`beep:audit` script family, and a base
   `dependencies: { effect: "catalog:" }` plus
   `devDependencies: { "@effect/vitest": "catalog:", "@types/node": "catalog:" }`.
   **Manual follow-up required:** the generator only seeds `effect` as a
   dependency — add `@beep/identity` (for `$I`), `@beep/schema` (schema-first
   constraint), and `@beep/utils` (per `CLAUDE.md` helper-module precedence)
   by hand once the kit's actual source needs them, mirroring
   `packages/foundation/capability/api-transport/package.json`'s
   `dependencies` block, then re-run `bun run beep tsconfig-sync` so the new
   deps propagate into aliases/docgen/references.

8. **Test harness convention: `@effect/vitest`, `test/` for unit,
   `test/integration/` excluded by default.** Sibling `beep:test` script is
   `bunx --bun vitest run --passWithNoTests --exclude=test/integration/**`
   (api-transport `package.json`); `vitest.config.ts` is a thin
   `mergeConfig(shared, defineConfig({...}))` against the repo-root
   `vitest.shared.ts` (pattern: `api-transport/vitest.config.ts`). The
   scaffold creates empty `test/.gitkeep` and `dtslint/.gitkeep`
   placeholders (`Handler.ts:494-500`) and a `tsconfig.test.json` that
   includes `src`, `test`, `dtslint` (pattern:
   `api-transport/tsconfig.test.json`). Per `CLAUDE.md`, test/dtslint files
   must import package source through the `@beep/mcp-kit` alias, not
   relative paths into `src/`.

9. **`docgen.json` is scaffolded from a template and kept in sync by
   `tsconfig-sync`.** Generated at `Handler.ts` template spec
   `docgen.json.hbs` → `docgen.json`; shape matches
   `api-transport/docgen.json` (`exclude: ["src/internal/**/*.ts"]`,
   `srcLink` pointing at the GitHub tree path, `examplesCompilerOptions`).
   Register the package for docgen is automatic — no separate root docgen
   aggregate list to hand-edit (confirmed no such file found in `docs/`).

10. **Lockfile refresh is automatic unless skipped.** The scaffold runs
    `bun install --lockfile-only` by default (`Handler.ts:735-755`,
    `refreshBunLockfile`) after writing `package.json`; pass
    `--skip-lockfile` only if chaining more manual `package.json` edits
    first (e.g. adding the dependencies from step 7) before a single final
    `bun install`.

11. **Verify the scaffold, then implement.** After scaffolding: confirm
    `packages/foundation/capability/mcp-kit/package.json` `beep.kind` is
    `"capability"`, confirm the workspace/tsconfig/identity sync summary
    printed no unexpected root-file diffs beyond the intended ones, then
    proceed to build the seven SPEC deliverables inside `src/`.

## Open Risks

- **`.repos/effect-v4` subtree vs. resolved `node_modules/effect` have
  diverged** (confirmed by direct diff on `McpServer.ts`). Not
  decision-invalidating today (diffed hunks are unrelated JSDoc formatting),
  but any future re-verification pass should diff both trees for the
  specific lines being cited, not assume they're interchangeable — and
  should prefer `node_modules/effect` since that's what the workspace
  actually builds against.
- **`filterByClient` is a shared helper** used by `tools/list`,
  `resources/list`, `resourceTemplates/list`, and `prompts/list`
  (`McpServer.ts:1425-1455`) — the kit's `EnabledWhen` list-filter helper
  (SPEC deliverable #4) should target this same shared mechanism rather than
  assuming tool-specific filtering logic, since the upstream implementation
  is generic across MCP list-endpoint kinds.
- **The `package.json` dependency auto-seed is minimal** (only `effect`) —
  any implementer running `create-package` verbatim without the manual
  `@beep/identity`/`@beep/schema`/`@beep/utils` follow-up (checklist step 7)
  will hit missing-module errors the moment `$I` or schema-first patterns are
  used; this is easy to miss since the scaffold otherwise "just works."
- **No dry-run was executed against the live repo during this P0 pass** (P0
  is verification-only per `GOAL.md`/`SPEC.md` — no repo files besides this
  report were to be touched). The checklist above is derived from reading
  the `create-package`/`tsconfig-sync` source and the `api-transport` sibling
  output, not from an actual scaffold run; P1 should treat step 1's
  `--dry-run` output as the first real confirmation of this checklist's
  accuracy before committing to the non-dry-run scaffold.
