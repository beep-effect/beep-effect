# env — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/env/CLAUDE.md -->
# @effected/env

Effect-native environment detection: which agent or CI is running a program,
what the terminal can do (colour level, hyperlinks, columns), and which audience
the output is for. Read once through `Config`, swapped in tests with `layerTest`.

**Design doc:** `@./okf/modules/env.md` — Load when: changing the public
surface, adding a detector, or deciding whether a capability belongs here
versus in `@effected/cli` or `@effected/engine`.

## Boundary tier — purity rules

`effect` is the only peer. **Never add an `@effected/*` or runtime
dependency.** `@effected/workspaces` is a devDependency for the `SourceBoundary`
purity test only.

- `src/` has no `process` reads, no `node:`, `@effect/platform*` or
  `@effected/*` imports, and no `console.*` or stdout writes.
  `__test__/purity.test.ts` runs a `SourceBoundary` scan that enforces exactly
  this. `node:` imports are allowed in `__test__/`.
- Nothing is read at import time. Every read happens inside a layer's
  construction Effect, through `Config`.
- House style: static classes with private constructors, or `Context.Service`
  classes carrying static `layer` and `layerTest`. No `as const` namespace
  objects.
- One module per concept; `src/index.ts` is the only re-exporting module.
  Detectors live under `src/internal/` and are not exported.

## The three oracles

Never pin this package's own output as the oracle in a test.

- Colour depth: Node's `tty.WriteStream.prototype.getColorDepth`.
- OSC 8 hyperlink support: std-osc8's own shipped test cases.
- Agent and CI detection: std-env 4.3.0's table, transcribed from source.

## Test and build

Tests live in `__test__/`, use `@effect/vitest`, assert with `assert.*` —
never `expect`.

```bash
pnpm vitest run --project @effected/env   # this package's tests, from the repo root
pnpm build --filter @effected/env         # dev + prod, from the repo root
```

Never run `node savvy.build.ts --target prod` directly: it skips
`build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` that
looks exactly like a clean gate.


---
<!-- okf/modules/env.md -->
---
type: Module
title: "@effected/env"
description: The boundary package that detects who is running a program and in what terminal — agent, CI, colour level, hyperlink support and width — through Config, with no node imports and no import-time reads.
status: draft
kind: package
resource: ../../packages/env
layer: boundary
tags: [architecture, bundle, dx]
sources:
  - id: boundary-test
    resource: ../../packages/env/__test__/purity.test.ts
    title: "env purity: no process read, node: import, platform or kit import, or console write in src"
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T15:30:50Z
  body_sha256: 610207b5c161bf36106aba97830e7658da704c3e9ef8a23fb86429b044908753
---

# @effected/env

`@effected/env` answers two questions for any front end of a tool: *who is
running this* and *what can the terminal do*.[^boundary-test]
It is a [boundary-tier](../glossary/library-tier.md) package with `effect` as
its only peer, no `node:` import, and nothing read at import time. Every
environment variable goes through `Config`, so a test controls it. Each
service is a `Context.Service` class with a static `layer` and `layerTest`;
`layerTest` is the only way a test changes the environment. `RuntimeEnv`
itself is a `Schema.Class` data snapshot, carried by the `CurrentRuntimeEnv`
service.

It is its own package, and a required peer of `@effected/cli`, so that MCP
servers, engines and a Vitest plugin can detect without a CLI dependency; see
[its own package](../decisions/env-is-its-own-package.md).

## Public surface

| Export | Contract |
| --- | --- |
| `RuntimeEnv` and `CurrentRuntimeEnv` | `RuntimeEnv` is the snapshot `Schema.Class`: `{ agent: Option<string>, ci: Option<CiName>, terminal: Option<{ name, version: Option<string> }> }`. `agent` is the agent *family* (`claude` for Claude Code, which sets `AI_AGENT=claude-code_2-1-285_agent`): a known family name, or a value starting with one then `-` or `_`, is folded to the family; an unknown `AI_AGENT` value stays as lower-cased. `CiName` is the literal union of `github-actions` and `generic`, so a consumer matches `ci` exhaustively and a persisted snapshot naming any other CI no longer decodes (0.1.0 only ever wrote those two). Every `Option` field is `Schema.OptionFromNullOr` behind `withDecodingDefaultTypeKey`, so the snapshot persists as plain JSON through `Schema.fromJsonString(RuntimeEnv)`, with `null` for absent (`Schema.Option` does not: its JSON form is a tagged object that decodes back to an error). Fields added after 0.1.0 must decode when absent, so a persisted snapshot keeps decoding; a frozen 0.1.0 wire literal in the tests pins it. It is a data class, not a service tag: no kit service is a `Schema.Class`, and this service's whole shape is one immutable value, so `CurrentRuntimeEnv` is the `Context.Service` carrying it. `RuntimeEnv.fromRecord(env)` is the same computation as a pure function of a record (an empty or `undefined` value reads as unset). `CurrentRuntimeEnv.layer` needs nothing and reads the ambient `ConfigProvider` once when built, so it is safe inside a stdio MCP server, but core's default provider snapshots `process.env` once per process and the layer is memoized by reference, so a long-lived host uses `CurrentRuntimeEnv.layerFrom(source)` (a record or a `ConfigProvider`), a `Layer.fresh` layer per call that two sources in one graph never share; `layerTest(overrides?)` takes `{ agent?, ci?, terminal? }` as `Option`s, defaults every field to `None`, and never touches `Config`. |
| `TerminalEnv` | `stdinIsTerminal`; per-stream `stdout` and `stderr`, each `{ isTerminal, color, hyperlinks, columns }`; `width(fallback)`, which reads stdout columns, then `COLUMNS`, then the fallback; and a standalone `colorLevel(stream)`. A snapshot, not live. `layer(options?: TerminalEnvOptions)` takes `{ stderrIsTerminal?: Effect<boolean> }` and requires `Stdio` and `Terminal`; `layerStdio(options?)` is the same snapshot from `Stdio` and `Config` alone, with no `Terminal` and `columns` `None`, for a long-lived host that must not build `NodeTerminal`; `layerTest(partial?: TerminalEnvTestOptions)` takes `{ stdinIsTerminal?, stdout?, stderr? }`. `colorLevel(stream)` needs `Stdio` and `Config` only, and answers with an ambient `TerminalEnv`'s stdout colour when one is provided. `hyperlinks` is terminal capability only; `stderr.columns` is stdout's width. |
| `Audience` | `human`, `agent` or `ci`. Precedence: a valid override environment variable, then agent, then CI, then human, so an agent inside a CI job gets agent output. `source` is `override`, `detected` or `flag`. `layer(options?: AudienceOptions)` takes `{ envVar?: string }` and requires `CurrentRuntimeEnv`; `layerTest(kind, source?)` fixes the kind, with `source` defaulting to `override` and accepting `override`, `detected` or `flag`; `Audience.detect(env)` is the pure agent, then CI, then human rule over a `RuntimeEnv`. |
| `EnvOverride` | Reads a variable that picks a mode *within* an audience. `readResult` returns `{ audience, accepted, rejected }` and never logs, so a host owns the wording, the stream and any dedupe; `read` is the logging convenience over it. Without its `source` option `readResult` reads the fiber's `ConfigProvider` on every call, so a reader built once at module level is tested by providing a provider around the read; `source` (a record re-read per call, or a provider) is for a long-lived host, and a host that wants it and testability builds the options inside a function that takes the source (vitest-agent A8). An invalid value logs one warning and yields `None`; it never fails the run. Warnings go through `Effect.logWarning`, which writes to stdout unless `References.LogToStderr` is set, so a stdio-sensitive host routes logs to stderr. The kit never learns a consumer's literals. |

Colour follows Node's `getColorDepth` precedence
([decision](../decisions/force-color-honoured-node-precedence.md)). Node's
win32 branch reads `process.platform`, which this package never touches, so
`OS=Windows_NT` stands in for it at the same place in the order: after the
disable checks and the TTY gate, before `TMUX`, CI and `TERM`, and always
truecolor. That approximates Node on Windows 10 build 14931 and later; an
older build gets more colour than Node would give. Hyperlink
detection is a port of std-osc8's pure core
([decision](../decisions/osc8-ported-not-wrapped.md)); hyperlinks being off
for the agent audience is applied in `cli`, where the audience is known, not
here.

## Bound by

- [`dependency-policy`](../conventions/dependency-policy.md)
- [`peer-dependency-discipline`](../conventions/peer-dependency-discipline.md)
- [`testing-standards`](../conventions/testing-standards.md)

## See also

- [`@effected/cli`](cli.md)
- [`@effected/engine`](engine.md)

[^boundary-test]: `packages/env/__test__/purity.test.ts`, which pins the no-`node:` and no-import-time-read rules; the exports are pinned in `entrypoints.test.ts`
