# github-commands — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/github-commands/CLAUDE.md -->
# @effected/github-commands

The GitHub Actions workflow-command grammar as pure functions: `WorkflowCommand` renders a command with the runner's escaping, and `CommandNeutralizer` makes arbitrary text safe to write to a log. Extracted from `@effected/github-actions` so a boundary-tier package can neutralize without the integrated tier.

**Tier: pure.** No `effect` (it is not even a peer), no `node:` import, no service, no regular dependency, no `@effected/*` edge, `"sideEffects": false`. Never add one: any package at any tier depends on this one, and that only works while it asks for nothing. Its consumers take it as a REGULAR dependency, never a peer: it has no shared-instance contract (static functions, no tag, no `instanceof`), so two copies in a tree are harmless.

**Design doc:** `@./okf/modules/github-commands.md` — Load when: changing either module, or ruling on what the runner reads as a command. The reason it exists is `@./okf/decisions/github-commands-extracted-from-actions.md`.

## The two modules

- **`WorkflowCommand`** (`src/WorkflowCommand.ts`) — `render(name, properties, message)` and the `debug`, `notice`, `warning`, `error`, `group`, `endGroup` and `addMask` helpers, with `AnnotationProperties` mapping readable names (`startLine`) onto the wire's (`line`). The shape is public and frozen: `@effected/github-actions` re-exports it.
- **`CommandNeutralizer`** (`src/CommandNeutralizer.ts`) — `lines(text)` and `text(text)`. The text it is given is not a command; it is DATA that must not become one.

## Rules that are load-bearing

- **The runner has TWO command parsers and a line is a command if either accepts it** (`actions/runner`, `ActionCommand.cs`). V2: `TrimStart()` with .NET whitespace (U+0085 included), then `StartsWith("::")`. Legacy: `IndexOf("##[")`, ANYWHERE in the line. The neutralizer puts a zero-width space before a V2 line and between `##` and `[` at every `##[`. Neutralizing only a start-of-line `##` was the first version's bug, and its tests shared it. **A bare `##` is not a command: leave it alone** (a markdown heading).
- **Idempotent.** A neutralized line matches neither rule, so applying it again changes nothing; `Render.githubLog` in `@effected/cli` relies on that.
- **Split at CR, LF and CRLF**, as the runner does. A lone CR starts a line.
- **There is no exported detector, deliberately.** A detector beside the neutralizer is the implementation's own opinion of a command, and a test using it pins the output as its own oracle. The oracle is `__test__/helpers/runnerCommands.ts`, written independently from the runner's rules and importing nothing from `src/`. Keep it that way.
- **Escaping order in `render`:** the percent sign first, then CR and LF, and for a property value also `:` and `,`. Reversing it re-escapes the `%` of an escape it just wrote.
- **The zero-width space is written by code point** (`String.fromCodePoint(0x200b)`), never as a literal character in the source.

```bash
pnpm vitest run --project @effected/github-commands
pnpm build --filter @effected/github-commands   # never the raw savvy.build.ts
```


---
<!-- okf/modules/github-commands.md -->
---
type: Module
title: "@effected/github-commands"
description: "The GitHub Actions workflow-command grammar as pure functions: render a command, and neutralize text so the runner cannot read it as one."
status: draft
kind: package
resource: ../../packages/github-commands
tags: [github, security, bundle]
generated:
  by: okfit/claude-code
  at: 2026-10-01T01:56:30Z
  body_sha256: ec00324a9e2bb4b2908ade3b8697523de66dc5420fdb5933d3cffabc3946c445
---

# @effected/github-commands

`@effected/github-commands` is the GitHub Actions **workflow-command grammar**
as pure functions. Strings in, strings out: no service, no layer, no `R`, no
`node:` import, no `effect` import at all, `"sideEffects": false`. It does two
things that are the same protocol seen from its two ends.

## The two modules

| Module | Concept |
| --- | --- |
| `WorkflowCommand` | Render a command, `::name key=value::message`, with the runner's escaping: `render`, and `debug`, `notice`, `warning`, `error`, `group`, `endGroup` and `addMask`, plus the `AnnotationProperties` that map readable field names onto GitHub's abbreviated wire names. Moved here unchanged from `@effected/github-actions`, which re-exports it at its entrypoint. |
| `CommandNeutralizer` | The opposite direction: make arbitrary text safe to write to a log. `CommandNeutralizer.lines(text)` splits at the runner's line breaks and returns each line neutralized, and `CommandNeutralizer.text(text)` joins them back. |

## The two-parser rule

The runner reads a command by two parsers (`actions/runner`,
`src/Runner.Common/ActionCommand.cs`, `TryParseV2` then `TryParse`), and a line
is a command if either accepts it:

- **V2:** `TrimStart()` with .NET whitespace (which includes U+0085), then
  `StartsWith("::")`. The neutralizer puts a zero-width space (U+200B, which
  .NET does not count as whitespace) in front of such a line.
- **Legacy:** `IndexOf("##[")`, so `##[` is a command wherever it occurs in the
  line. The neutralizer puts a zero-width space between `##` and `[` at every
  occurrence.

A bare `##` with no `[` straight after it is not a command and is left alone, so
a markdown heading survives. Input is split at CR, LF and CRLF, as the runner
splits a stream. The result is **idempotent**: a neutralized line no longer
matches either rule, so applying it twice, as `Render.githubLog` and the facade
in `@effected/cli` both do, adds nothing.

There is deliberately **no exported detector** (`isCommand`). A detector shipped
beside the neutralizer would be the implementation's own opinion of what a
command is, and a test that used it would pin the code's output as its own
oracle. The oracle lives in the test tree only, written independently from the
runner's source.

## Tier and dependencies

**Pure tier**, per [the tier taxonomy](../glossary/library-tier.md), the lowest
layer. Zero regular dependencies and no peer: nothing in it needs `effect`.
It takes no `@effected/*` edge, ever, so any package at any tier can depend on
it.

Consumers: `@effected/github-actions` (a regular dependency: `ActionLogger`
neutralizes the log text it writes, and the whole actions runtime emits commands
through `WorkflowCommand`) and `@effected/cli` (a regular dependency: the renderers,
`CliMessage`, the failure report and the loggers neutralize under GitHub
Actions). See [why the grammar left `github-actions`](../decisions/github-commands-extracted-from-actions.md).

## What the consumers do with it

A kit path that writes text a consumer supplied sanitises it and, where
`CurrentRuntimeEnv` says the runner is GitHub Actions, neutralizes it. The
failure to do so is a command-injection vector: an error message carrying a
newline and `::add-mask::` or `##[stop-commands]` is read by the runner as a
command.


---
<!-- okf/decisions/github-commands-extracted-from-actions.md -->
---
type: Decision
title: The workflow-command grammar left github-actions for its own pure package
description: "WorkflowCommand and the neutralizer live in the pure @effected/github-commands so a boundary-tier package can neutralize without the integrated github-actions tier and @effect/platform-node."
status: draft
tags: [architecture, deps, security]
generated:
  by: okfit/claude-code
  at: 2026-10-01T01:56:30Z
  body_sha256: 41d764a9a33e21895b928e63021aca642ac44fcb754b1409cb2608e6c7536fbc
---

# The workflow-command grammar left github-actions for its own pure package

## Context

`WorkflowCommand` rendered the GitHub Actions command protocol inside
`@effected/github-actions`, an integrated-tier package with a required peer on
`@effect/platform-node`. Neutralizing text so the runner cannot read it as a
command is the same grammar from the other end, and `@effected/cli` (boundary
tier) needs it: its renderers, `CliMessage`, the failure report and the loggers
all write consumer-supplied text into a log that the runner parses. `cli` could
not take `github-actions` for that: layering forbids a boundary package taking
an integrated one, and it would drag the platform package into every CLI.

The first answer was a copy: `cli` carried its own escaping and its own
neutralizer, with a comment that the duplication was deliberate. The copy made
two implementations of one protocol, and the neutralizer's first version modelled
only one of the runner's two parsers.

## Decision

The grammar moves to a pure, dependency-free package,
[`@effected/github-commands`](../modules/github-commands.md), holding
`WorkflowCommand` (moved unchanged) and `CommandNeutralizer` (the two-parser
rule). `@effected/github-actions` takes a regular `workspace:^` dependency on it
and re-exports `WorkflowCommand` and `AnnotationProperties` from its entrypoint,
so existing consumers keep compiling; `@effected/cli` takes the same regular
dependency and drops its copies.

It is a regular dependency, not a peer, because the peer-or-regular choice is the
[shared-instance contract](../conventions/peer-dependency-discipline.md), and this
package has none: no dependencies, no `effect`, no service, tag or schema class,
static functions and a structural interface, and no `instanceof` anywhere, so two
copies in a tree behave identically and are harmless. The singletons that do need
one shared instance, `effect` and `@effect/platform-node`, are already peers of
the packages that use them.

The reasons:

- One implementation of one protocol, so a correction (the legacy `##[` parser
  anywhere in a line) reaches `ActionLogger`, both `cli` loggers and the
  renderers at once.
- The kit's packages interlock rather than copy: where a pure rule is shared, a
  pure package at the lowest layer is the place, and any tier may depend on it.
- It costs consumers nothing: no `effect`, no platform, and nothing for them to
  install or satisfy, because it arrives as a regular dependency.

## Consequences

- There is no exported detector, so the grammar package never offers a second
  opinion of what a command is; each consumer's tests carry an independent oracle.

This supersedes nothing: it extracts, and the earlier `cli` copy was never a
recorded decision beyond a code comment.
