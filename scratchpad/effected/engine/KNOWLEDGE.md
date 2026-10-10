# engine — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/engine/CLAUDE.md -->
# @effected/engine

Platform-free primitives shared by every front end of an Effect v4 tool:
distribution identity, remediation, launch context, and transport-neutral
process crash guards (`./guard`).

**Design doc:** `@./okf/modules/engine.md` — Load when: changing the public
surface, adding a new cross-front-end primitive, or deciding whether a
capability belongs here versus in `@effected/cli` or a consumer's own
`engine` package.

## Pure tier — no exceptions

`effect` is the only peer, and the only dependency of any kind. No
`process`, no `node:` import, no platform package — not even as a
devDependency edge into `src/`. There is no IO here and nothing to provide
at the edge.

**Nothing in the kit may depend on this package except `@effected/mcp`.**
`@effected/cli` must never depend on it — the two sit at the
same layer, both consumed by a front end, never by each other. Adding a new
dependent is a new Decision, not a drive-by import.

## Public surface

One module per concept. `src/index.ts` is the only re-exporting module.

- `src/Distribution.ts` — `Distribution` (`Schema.Struct` + type),
  `DistributionField` (`Schema.NullOr(Distribution)`), `CurrentDistribution`
  (a `Context.Reference`, not a `Context.Service` — reading it adds nothing
  to `R`), `distributionSuffix`.
- `src/Remediation.ts` — `Remediation` (`Schema.Struct` + type): what a
  caller, usually an agent, should do after a failure.
- `src/LaunchContext.ts` — `LaunchContext` and `ProjectDirInput`: resolves
  where a tool launched by an agent host should treat as its project, from
  caller-supplied `argv`/`env`/`cwd` rather than reading `process` itself.
- `src/ProcessGuard.ts` — `ProcessGuard` (`run`, `parseInjectCrash`) plus the
  `ProcessGuardHost`, `ProcessGuardPolicy`, `ProcessGuardControl`,
  `ProcessGuardOptions` and `ProcessGuardInjection` types: transport-neutral
  crash guards. Exported **only** from the `./guard` subpath
  (`src/guard.ts`), never from `src/index.ts`.

## `./guard` has no runtime import at all

`src/guard.ts` and `src/ProcessGuard.ts` import nothing, not even `effect`
or a type: the guards must be listening before anything a server's
`main.ts` loads evaluates. `__test__/entrypoints.test.ts` pins the source
graph AND the built `dist/dev/pkg/guard.js` graph to `guard` +
`ProcessGuard` with zero packages; `@effected/mcp`'s own entrypoint test
re-checks the installed copy, because `McpGuard.ts` statically imports it.
The host is structural (`on`/`emit`/`stderr`/`exit`), so the purity rule
holds: `process` is passed in by the caller. `setTimeout` (for
`injectCrash`) is the only global used.

`ProcessGuard.run` launches nothing. The caller's `load(guard)` starts the
server and calls `guard.markConnected()` once it is serving (a plain
callback, so a non-Effect LSP and `McpGuard`'s `McpStdio.launch` `onReady`
use the same shape) and `guard.useFormat(fn)` to upgrade the fallback
formatter. Report wording is `McpGuard`'s, unchanged, because `McpGuard.run`
is now this guard plus an MCP launch.

## Test and build

Tests live in `__test__/`, use `@effect/vitest`, assert with `assert.*` —
never `expect`.

```bash
pnpm vitest run --project @effected/engine   # this package's tests, from the repo root
pnpm build --filter @effected/engine         # dev + prod, from the repo root
```

Never run `node savvy.build.ts --target prod` directly: it skips
`build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` that
looks exactly like a clean gate.


---
<!-- okf/modules/engine.md -->
---
type: Module
title: "@effected/engine"
description: The platform-free primitives a carrier-pattern tool's own engine package shares across its front ends — distribution stamping, remediation shape, and launch-context resolution.
status: stable
kind: package
resource: ../../packages/engine
layer: pure
tags: [architecture, bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-10-05T18:45:07Z
  body_sha256: ffaae022b8259b50898acb2e599a17a084deba54030137951ad9631c6eb7f584
---

# @effected/engine

`@effected/engine` is where the primitives every front end of a
carrier-pattern tool shares live, once, fixed. A consumer such as okfit or
vitest-agent ships its own `engine` package that composes its `core` and
its vocabulary into shared programs; this kit package sits *below* that
consumer engine, not beside it — the consumer's engine is the thing that
**stamps `distribution` into envelopes**, and stamping requires reading
`CurrentDistribution`, so the primitive that carries it has to live
somewhere a consumer's engine can depend on without also depending on a
front end.

That is the whole reason this package exists rather than living inside
`@effected/cli` or a future `@effected/mcp`: **a consumer's engine may not
import `@effected/cli`**, whose own rule is that only applications depend
on it (see [`cli.md`](cli.md)). If `Distribution` lived in `cli`, every
consumer engine that wanted to stamp its own distribution would have to
take a `cli` dependency it structurally cannot carry. Putting `Distribution`,
`Remediation` and `LaunchContext` in a package with no dependents but the
two front ends — and one dependent, `@effected/mcp`, sitting above it in
turn — breaks that knot. See
[D1](../decisions/engine-holds-cross-front-end-primitives.md) for the full
reasoning and the rejected alternatives.

## Public surface

One module per concept, static classes with a private constructor where a
concept groups more than one operation — never an `as const` namespace
object, which loses TSDoc on its members in the built `.d.ts`.

| Export | Kind | Contract |
| --- | --- | --- |
| `Distribution` | `Schema.Struct` and type | `{ name: string; version: string }` — the carrier package a bin was installed through. |
| `DistributionField` | schema | `Schema.NullOr(Distribution)`, for envelopes. `null` means installed directly, not "not yet known." |
| `CurrentDistribution` | `Context.Reference<Option<Distribution>>` | `defaultValue: () => Option.none()`. A front end's `main` provides it once. A `Reference`, not a `Service`, so reading it adds nothing to `R`. |
| `distributionSuffix(d)` | free function | `(d: Option<Distribution>) => string`, giving `" via <name> <version>"` or `""`. A free function, not `Distribution.suffix` — a `Schema.Struct` value carries no statics to hang it from. |
| `Remediation` | `Schema.Struct` and type | `{ hint: string; suggestedTool?: string; suggestedArgs?: Record<string, unknown> }`. The shape okfit and Silk both already use, plus vitest-agent's `suggestedArgs`; vitest-agent's `humanHint` maps onto `hint`. |
| `LaunchContext.projectDir(input)` | static function | `({ argv?, env, keys, cwd }): string`. Resolves in this order: the first `argv` value that is neither empty nor a placeholder, then the first `keys` env value that is neither empty nor a placeholder, then `cwd`. Pure — `env` and `cwd` are passed in, never read from `process`. |
| `LaunchContext.isUnsubstituted(value)` | static function | `(value: string): boolean`. Detects a literal `${VAR}` that a host such as Claude Code left unsubstituted. |
| `type ProjectDirInput` | type | The parameter shape `LaunchContext.projectDir` takes. |
| `ProcessGuard.parseInjectCrash(value)` (`./guard`) | static function | `(value: string \| undefined) => ProcessGuardInjection \| undefined`: the shared `<at>:<kind>` grammar for a launcher's test-only crash-injection variable; anything else, or no value, is `undefined`. Import-free like the rest of `./guard`. |
| `ProcessGuard.run(options)` (`./guard`) | static function | `(options: ProcessGuardOptions) => Promise<void>`. Installs `uncaughtException`/`unhandledRejection` listeners on a structural `ProcessGuardHost` (`on`, `emit`, `stderr`, `exit`; Node's `process` satisfies it, pinned by a compile-time test), then awaits `options.load(guard)`. Launches nothing: `load` starts the server on any transport and calls `guard.markConnected()` once serving and `guard.useFormat(fn)` to upgrade the dependency-free formatter. `ProcessGuardPolicy`, a `startup failed` exit 1 on a rejected `load`, and `injectCrash: ProcessGuardInjection` (`at: "load" \| "connected"`, the `"connected"` report raised a tick after `markConnected`) are exactly `McpGuard`'s, which is now this guard plus an MCP launch. |

### Why the guard lives here, on its own subpath

The crash guard was born as `McpGuard.run` in `@effected/mcp/guard`, but
its guard half (listeners, policy, startup failure, `injectCrash`, the
formatter) has nothing to do with MCP, and okfit's LSP front end
(`vscode-languageserver` over stdio) hand-rolled a copy because
`McpGuard.run` also launches through `McpStdio`. The guard therefore
belongs where every front end can reach it without a front-end dependency:
here. It is a subpath, `./guard`, with **no runtime import at all**, so a
`main.ts` imports it statically and its listeners exist before `effect` or
the server graph evaluates — the main entry imports `effect`, so it could
not serve that role. The connected signal is a plain `markConnected()`
callback rather than an Effect or a `start()` return value: an LSP calls it
from its own listening path, and `McpGuard` passes it to
`McpStdio.launch`'s `onReady`, which fires after `load` resolved — a
`start()`-shaped contract could not express that later moment. `engine`
stays pure: the host is structural and `setTimeout` is the only global
touched.

## Not exported, and why

- **Version constants** (an `ENGINE_VERSION` and the like). The bundler
  substitutes `__PACKAGE_VERSION__` in the *consuming* package at build
  time, so a helper shipped from this kit package would report this kit's
  own version, not the consumer's — the one value this primitive must
  never produce. The rule that an engine stamps its own version is taught
  as doctrine, with the build-time constant as a skill recipe, not
  packaged.
- **The platform layer.** Building a platform layer is a decision that
  belongs to the front end's `main`, not to a pure package with no IO at
  all.
- **`Now`.** An injectable clock has exactly one adopter today and stays a
  recipe rather than becoming kit surface it would have to carry forever.

## Tier and dependency rules

[Pure tier](../glossary/library-tier.md): `effect` is the only peer, no
`process`, no `node:` import, no platform package. Nothing in the kit
depends on `@effected/engine` except `@effected/mcp`
(see [`mcp.md`](mcp.md)); `@effected/cli` must not, and no package may add
an edge to it without a new Decision.

## Consumers

[`consumers/okfit`](../consumers/okfit.md) is the register entry that first
named this gap: its own `engine` package is exactly the shape a kit
`Distribution` primitive sits under, and its `Remediation`/`ToolFailure`
copies are one of the near-identical duplicates this package (together with
the phase-2 `@effected/mcp`) exists to collapse.
[`consumers/vitest-agent`](../consumers/vitest-agent.md) is the second: its
`process.exit` handlers and `spawnSync` e2e are `@effected/cli` concerns
(see [D3](../decisions/cli-logger-defaults-all-to-stderr.md) and
[D9](../decisions/cli-testing-uses-core-child-process.md)), but its two
independent ports of `registerToolkit` are the `Remediation`-shaped
duplication this package's `CurrentDistribution` and `Remediation` exports
target directly.

## Testing

- Schema round-trips for `Distribution` and `Remediation`.
- `CurrentDistribution`'s default read with nothing provided, and an
  override.
- `distributionSuffix`'s full truth table (`None`, `Some` with and without
  a version worth naming).
- `LaunchContext.projectDir`: an empty-string env value, a
  `${CLAUDE_PROJECT_DIR}` literal, argv precedence over env, falling
  through to `cwd`.
- A property test asserting `projectDir` never returns an empty string
  when `cwd` is not empty.
- `ProcessGuard` against a host double: listeners before `load`, both
  policies across `markConnected` (including from a non-Effect callback
  after `load` resolved), `startup failed`, formatter fallback, and every
  `injectCrash` phase and kind; the `"connected"` report is asserted absent
  on the `markConnected` tick. `entrypoints.test.ts` pins `./guard`'s
  source and built graphs to zero packages.

## See also

- [D1: `@effected/engine` exists and holds `Distribution`, `Remediation` and `LaunchContext`](../decisions/engine-holds-cross-front-end-primitives.md)
- [`@effected/cli`](cli.md)
- [`@effected/mcp`](mcp.md) (phase 2)
