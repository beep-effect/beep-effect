# github-commands (lab port of @effected/github-commands)

[![npm](https://img.shields.io/npm/v/@effected%2Fgithub-commands?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/github-commands)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

The GitHub Actions workflow-command grammar as pure functions: render a command with the runner's escaping, and neutralize text so the runner cannot read it as one. Strings in, strings out. No service, no layer, no platform, no `effect`, and no dependency at all.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, still in `0.x`
> development. It has no dependencies, not even `effect`.
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version. Full
> policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/github-commands

The runner reads every line a step writes, and a line it recognises as a command does what the command says: `::add-mask::` redacts, `::error::` raises an annotation, `::stop-commands::` turns processing off. Text a program did not write itself, such as an error message or a file name, can therefore carry a command. The runner has two parsers, so "starts with `::`" is only half the rule: the legacy one finds `##[` anywhere in a line.

This package is the rule written once. `WorkflowCommand` builds the commands you mean to write, with the escaping the protocol needs. `CommandNeutralizer` defangs the text you did not mean as one.

## Install

```bash
npm install @effected/github-commands
```

```bash
pnpm add @effected/github-commands
```

Requires Node.js >=24.11.0. No dependencies and no peers. ESM-only: import it from an ES module.

## Usage

```ts
import { CommandNeutralizer, WorkflowCommand } from "@effected/github-commands";

WorkflowCommand.error("build failed", { file: "src/main.ts", startLine: 12 });
// "::error file=src/main.ts,line=12::build failed"

WorkflowCommand.warning("deprecated: 50% of calls\nuse v2", { title: "API: v1" });
// "::warning title=API%3A v1::deprecated: 50%25 of calls%0Ause v2"

CommandNeutralizer.text("prefix ##[add-mask]secret\n::error::x");
// a zero-width space inside the ##[ and before the ::, so neither parser reads a command
```

- **`WorkflowCommand`**: `render(name, properties, message)` and the `debug`, `notice`, `warning`, `error`, `group`, `endGroup` and `addMask` helpers. Annotation properties use readable names (`startLine`, `startColumn`) and go out as the wire's (`line`, `col`). The message escapes `%`, CR and LF; a property value also escapes `:` and `,`; the `%` goes first so an escape is never escaped twice.
- **`CommandNeutralizer`**: `lines(text)` and `text(text)`. A bare `##` is left alone, so a markdown heading is unharmed. It splits at CR, LF and CRLF as the runner does, and it is idempotent: neutralizing twice changes nothing.

[`@effected/github-actions`](https://www.npmjs.com/package/@effected/github-actions) re-exports `WorkflowCommand`, and [`@effected/cli`](https://www.npmjs.com/package/@effected/cli) neutralizes its output through `CommandNeutralizer` whenever the runner is GitHub Actions.

## Documentation

The guide and the API reference are at [effected.spencerbeg.gs/github-commands](https://effected.spencerbeg.gs/github-commands).

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/github-commands` 0.1.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
