# cli (lab port of @effected/cli)

[![npm](https://img.shields.io/npm/v/@effected%2Fcli?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

The presentation boundary of a command-line program built on `effect/cli`: who the output is for, and how it reaches them. Plain log lines on the right stream. Colour, glyphs and links only where the terminal and the reader can use them. Documents rendered for a person, an agent or a CI log. Failures reported through your own logger with the right exit code. Prompts that know when there is nobody to ask. Interactive screens and live progress views drawn with Ink. `effect/cli` still owns argument parsing, flags, the command tree and help; this package adds no parser and no command model.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/cli

Everything here shares one property: **you only discover you needed it by shipping bad output to a person or a machine.** None of it fails a type-check, a test, or a review of the code in isolation.

Effect's default logger emits `[00:33:56.619] INFO (#2): message`, which is right for a service and noise for a tool someone is watching. A platform `runMain` reports an unhandled failure through that same default logger, outside the layers your program was given, so it prints on **stdout**, the one stream errors must not use. Colour codes end up in an agent's context window. A prompt fires inside a pipe and hangs. A file name containing `::error::` becomes a workflow command in GitHub Actions. And a decode failure arrives as a structured tree when a user needs a sentence naming the key they got wrong.

This package makes those decisions once, at the edge of the program, from the environment it actually runs in.

## Install

```bash
npm install @effected/cli @effected/env @effected/glob @effected/walker effect
```

```bash
pnpm add @effected/cli @effected/env @effected/glob @effected/walker effect
```

Requires Node.js >=24.11.0. `effect` v4, `@effected/env` (the audience and terminal services), and `@effected/walker` with its `@effected/glob` peer (the project root for editor links) are peer dependencies. The one runtime dependency is `@effected/github-commands`. The package never imports a platform package, so it runs unchanged on Node, Bun and Deno.

Optional peers:

- **`ink` and `react`**, plus **`@types/react`** for TypeScript, for the interactive screens and live views in `@effected/cli/ui`. The root never reaches them, and `./ui` loads neither until a screen first mounts. Without `@types/react`, a program compiled with `skipLibCheck` silently types every screen as `any`.

  ```bash
  npm install ink react @types/react
  ```

- **`@effected/config-file`**, only for `ConfigIssueRenderer`. It is imported as a type, so nothing at runtime reaches for it.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED`. Import from an ES module.

## Quick start

One wiring serves every program: share the audience flags on the root command, run it through `CliAudience.run`, and hand that to `CliRuntime.main` with an `env`.

```ts
import { CliAudience, CliExit, CliMessage, CliRuntime, Doc } from "@effected/cli";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/cli";

const sync = Command.make("sync", {}, () =>
  Effect.gen(function* () {
    yield* CliMessage.info("syncing 2 repositories");
    yield* Doc.print([
      Doc.table(
        [{ header: "Repository" }, { header: "Files", align: "right" }],
        [
          ["acme/widgets", "12"],
          ["acme/gadgets", "3"],
        ],
      ),
    ]);
    yield* CliMessage.warning("acme/gadgets has no default branch");
    // A finding, not a crash: the handler succeeds and the run still exits 1.
    yield* CliExit.set(1);
  }),
);

const root = Command.make("tool").pipe(Command.withSharedFlags(CliAudience.flags()), Command.withSubcommands([sync]));

NodeRuntime.runMain(
  CliRuntime.main(CliAudience.run(root, { version: "1.0.0" }), {
    platform: NodeServices.layer,
    env: {
      audienceEnvVar: "TOOL_AUDIENCE",
      stderrIsTerminal: Effect.sync(() => process.stderr.isTTY === true),
    },
  }),
);
```

```text
$ tool sync
ℹ syncing 2 repositories
Repository    Files
------------  -----
acme/widgets     12
acme/gadgets      3
⚠ acme/gadgets has no default branch
$ echo $?
1
```

At a colour terminal the glyphs are painted and the header is bold. For an agent (`--agent`, `TOOL_AUDIENCE=agent`, or an agent detected from the environment), in a pipe, or under `NO_COLOR`, the same program writes no escape sequence of any kind. Under GitHub Actions, anything the runner could read as a workflow command is neutralized. A failure anywhere renders as a short report on stderr and exits non-zero.

## Audiences

The audience is decided once per run: an audience flag (`--audience <human|agent|ci>`, `--human`, `--agent`, `--ci`), then the override variable you name, then an agent detected from the environment, then CI, else a human. It decides:

| | Human | Agent | CI |
| --- | --- | --- | --- |
| Colour | When the stream has it | Never, even with `FORCE_COLOR` | When the stream has it (messages) |
| `Doc.print` | `ansi`: painted, OSC 8 links | `plain` | `githubLog` under GitHub Actions, else `plain` |
| Width | The terminal's | Unbounded | Unbounded |
| Diagnostics (`CliLog`) | Pretty lines | NDJSON | NDJSON |
| Prompts and screens | When interactive | Never | Never |

Colour follows Node's precedence, per stream: `FORCE_COLOR` decides first and beats `NO_COLOR` (`1`–`3` on, even in a pipe; `0` off). Otherwise there is no colour without a terminal. On a terminal, a non-empty `NO_COLOR`, `NODE_DISABLE_COLORS` or `TERM=dumb` turns it off. `TERM=dumb` also switches to ASCII glyphs and makes the run non-interactive.

## Output

- **`CliMessage`**: `success`, `info`, `warning`, `failure` and `status(vocab, name, text)`. One themed line each, through `Console` rather than the logger, so no log level silences them. Warnings and failures go to stderr.
- **`Doc` and `Render`**: a document IR (headings, paragraphs, lists, tables, trees, counts, count tables, collapsibles, callouts, code blocks, diffs, GitHub annotations) and pure `plain`, `ansi`, `markdown` and `githubLog` renderers. `Doc.print` picks the renderer for the audience, and lays out at the terminal's width only when the stream is a terminal: piped output (`tool | grep`) never wraps. `Doc.line(content, { wrap: false })` keeps one line whole at any width, glyph and colour included. `Render.contextOf` renders outside Effect, for example markdown for a step summary.
- **`CliTheme`, `Token`, `Status`, `Glyphs`**: semantic tokens (`success`, `failure`, `warning`, `info`, `error`, `muted`, `accent`, `emphasis`), an extendable status vocabulary with glyphs and ranks, and Unicode or ASCII glyph sets. Override tokens with `env.theme`.
- **`CliLinks`**: file links that open in VS Code (`vscode://file/…`) or as `file://` URLs, as OSC 8 hyperlinks where the terminal renders them, never for an agent.
- **`Fmt`**: `sanitize`, `width`, `truncate`, `duration`, `percent` and `plural`.

Every string that enters a document or a message is sanitised: escape sequences and control characters are removed, so data cannot paint the terminal or plant a link.

## Failures and exit codes

`CliRuntime.main` reports a failure as a document on stderr, through the audience's renderer: a status line for a typed failure, a tree of rejected values for a schema failure, and a defect's message with a collapsible stack of your own frames (Effect's, Node's and `node_modules` frames hidden). Give an error class a `[CliDoc]()` method to draw itself, or pass a `render` option. Its `details.lines({ status: false })` keeps the run's colour and paths behind your own prefix. The `in: outer › inner` span trail after a failure names only your own spans by default; `env.spans` (`"app"`, `"all"` or `"off"`) chooses, as `env.stackFrames` does for a defect's frames. `"app"` leaves out spans defined in files under `node_modules/@effected/` or `node_modules/effect/`, and fails open: a kit package linked into a workspace, or a bundled program, shows more, never less. A program that is itself installed under `node_modules/@effected/` passes its bin's `import.meta.url` as `env.appModule` to keep its own spans. `env.spansEnvVar` names a variable (say `TOOL_SPANS`) that sets it at run time, as `log.envVar` sets the level. An `Effect.fn` call and its definition are one entry in the trail.

- `CliExit.set(code)` records a findings exit code from a handler that still succeeds. Do not provide `CliExit.layer` yourself under `main`, or the code goes to a second, unread cell.
- `Cancelled` (a prompt quit) exits `130`, and `NotInteractive` (a prompt with nobody to ask) exits `64`, each as one fixed line.
- A usage error exits `64`. `helpOnUsageError: "stderr"` keeps stdout clean for a caller piping it into `jq`.
- Without `main`: `CliRuntime.reportFailures()` is the combinator to apply inside your program, and `CliRuntime.reported(error, code)` marks an error you printed yourself.

`SchemaIssueRenderer.render(issue)` and `ConfigIssueRenderer.render(error)` turn an issue tree into lines like `unknown key at groups.g.rulesetz`.

## Logging

`CliLogger` writes plain lines, with no timestamp, level or fiber id, and routes every level to stderr by default (`stderrFrom` narrows it), so stdout carries only the program's output. Pass `env.log` to `main` for **`CliLog`**: a diagnostics level of its own (`level`, or `envVar` such as `TOOL_LOG_LEVEL`, with core's `--log-level` beating both), pretty lines for a person and NDJSON for an agent or CI, an optional NDJSON log file, and `CliLog.component(name)` tags. `CliLog.status(vocab, name, text)` logs a diagnostic with a painted status glyph (its text still sanitised), and `CliTheme.forAudience` applies the kit's "an agent never gets an escape" rule to a theme you paint with yourself.

## Prompts and screens

A prompt fires only when `CliInteractive` is true: a human audience, a terminal on stdin and stdout, and `TERM` not `dumb`. Otherwise it answers a default you supply, or fails cleanly.

```ts
import { CliPrompt } from "@effected/cli";
import { Flag, Prompt } from "effect/cli";

// Core's prompt as a flag fallback: asks at a terminal, uses "library" in a pipe.
const profile = Flag.String("profile").pipe(
  Flag.withFallbackPrompt(
    CliPrompt.fallback(
      Prompt.Select({ message: "Profile", choices: [{ title: "library", value: "library" }, { title: "application", value: "application" }] }),
      { flag: "profile", otherwise: "library" },
    ),
  ),
);
```

`@effected/cli/ui` adds Ink screens: `CliUi.run`, `prompt` (with an `otherwise`) and `fallback` (for a flag), over the widgets `Select`, `TextInput` (with a `mask` for secrets, always, or from the moment a predicate spots one anywhere in the value, latched until the value is cleared: its `validate` message is drawn unmasked, so never echo the value in it), `MultiSelect`, `Confirm` (with toggles), `Toggle`, `Tabs` and `Viewport`. Your own screens use the key layer (`KeyTable`, `useKeys`, `KeyHelp`) and the theme bridge (`Styled`, `useTheme`, `useGlyphs`, `useTerminalSize`).

```tsx
import { CliUi, Select } from "@effected/cli/ui";

const pickProfile = Select.screen({
  message: "Profile",
  choices: [
    { label: "library", value: "library" },
    { label: "application", value: "application" },
  ],
});

const profile = CliUi.prompt(pickProfile, { otherwise: "library" });
```

`CliUi.map(screen, f)` maps a screen's answer and leaves a cancel alone, so a `Confirm` can back a boolean flag ("confirm, or `--yes`"):

```ts
import { CliUi, Confirm } from "@effected/cli/ui";
import { Flag } from "effect/cli";

const yes = Flag.Boolean("yes").pipe(
  Flag.withFallbackPrompt(
    CliUi.fallback(
      CliUi.map(Confirm.screen({ message: "Publish?" }), (result) => result.confirmed),
      { flag: "yes", otherwise: false },
    ),
  ),
);
```

## Live views

`CliUi.live` folds a stream or a `PubSub` subscription of events into state, and draws **runs** with Ink while they are going: a run starts at `isStart`, redraws on a tick, and commits its final frame at `isTerminal`. Log lines go above the frame through `handle.logConsole`. End with `handle.close`, which folds everything still queued. When nobody is watching (a pipe, an agent, CI), each run's final frame prints once instead: give the view a `final: (state) => Document` and that run prints the document with no Ink or React loaded at all; `render` is then never called on such a run, not even to build an unused string. `render: CliUi.lazyView(() => import("./view.js"))` keeps the view's module, and React, off every run until one draws. `DocView` draws a `Doc` document inside a view byte for byte as `Doc.print` would, and `UiProvider` with `CliUi.context` gives an Ink tree you mount yourself the same theme.

## Testing

- **`@effected/cli/testing`**: `CliTest.sandbox` and `CliTest.run` spawn a built bin hermetically and return `{ exitCode, stdout, stderr }` as data. `TestTerminal` drives core's prompts.
- **`@effected/cli/ui/testing`**: `CliUiTest.render` mounts a screen on in-memory streams (`press`, `type`, `chunk`, `frame`, `result`). `view` mounts a display-only element, `session` drives a whole command's screens (its `transcript` shows what reached the terminal, a live view's `logConsole` lines included, `stdoutWritten`/`stderrWritten` each stream alone as raw bytes, `stdoutTranscript`/`stderrTranscript` each stream alone as plain text, and `renderPath: "production"` makes `clear` observable), and `live` mounts a live view on the production render path with a `TestClock` tick. `CliUiTest.serializer` prints frames as token markup in snapshots: register it in the Vitest config with `snapshotSerializers: ["@effected/cli/ui/testing/serializer"]`, or with `expect.addSnapshotSerializer`. Snapshots are the one place a test needs `expect`, since `assert` has no snapshot form.

In-process, provide `layerTest`s from `@effected/env` and `CliTheme.layerTest`, swap in a capturing `Console`, and assert on both streams. Neither testing entrypoint is reachable from a CLI's runtime imports.

## Documentation

Guides for every part, and the full API reference, are at [effected.spencerbeg.gs/cli](https://effected.spencerbeg.gs/cli): [getting started](https://effected.spencerbeg.gs/cli/getting-started), [audiences and output](https://effected.spencerbeg.gs/cli/output), [prompts and screens](https://effected.spencerbeg.gs/cli/prompts), [live views](https://effected.spencerbeg.gs/cli/live-views), [testing](https://effected.spencerbeg.gs/cli/testing) and [advanced](https://effected.spencerbeg.gs/cli/advanced).

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/cli` 0.13.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/cli/ui/internal/processStreams.ts:5 * One of the three files licensed to touch Node: it reads
- scratchpad/effected/cli/ui/internal/processStreams.ts:7 * The boundary test holds that licence exact.

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
