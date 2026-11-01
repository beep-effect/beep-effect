# @beep/cli-kit

The presentation boundary of a command-line program built on `effect/cli`: who the output is for, and how it reaches them. Plain log lines on the right stream. Colour, glyphs and links only where the terminal and the reader can use them. Documents rendered for a person, an agent or a CI log. Failures reported through your own logger with the right exit code. Prompts that know when there is nobody to ask. `effect/cli` still owns argument parsing, flags, the command tree and help; this package adds no parser and no command model.

## Why this package

Everything here shares one property: **you only discover you needed it by shipping bad output to a person or a machine.** None of it fails a type-check, a test, or a review of the code in isolation.

Effect's default logger emits `[00:33:56.619] INFO (#2): message`, which is right for a service and noise for a tool someone is watching. A platform `runMain` reports an unhandled failure through that same default logger, outside the layers your program was given, so it prints on **stdout**, the one stream errors must not use. Colour codes end up in an agent's context window. A prompt fires inside a pipe and hangs. A file name containing `::error::` becomes a workflow command in GitHub Actions. And a decode failure arrives as a structured tree when a user needs a sentence naming the key they got wrong.

This package makes those decisions once, at the edge of the program, from the environment it actually runs in. It builds on `effect`, `@beep/runtime-env` (the audience and terminal services), `@beep/walker` (the project root for editor links) and `@beep/github-commands`, and it never imports a platform package, so it runs unchanged on Node and Bun. `ConfigIssueRenderer` takes the structural `{ readonly issue }`, so the root needs no `@beep/config-file` dependency.

## Usage

### Quick start

One wiring serves every program: share the audience flags on the root command, run it through `CliAudience.run`, and hand that to `CliRuntime.main` with an `env`.

```ts
import { CliAudience, CliExit, CliMessage, CliRuntime, Doc } from "@beep/cli-kit";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Command from "effect/cli/Command";
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

### Audiences

The audience is decided once per run: an audience flag (`--audience <human|agent|ci>`, `--human`, `--agent`, `--ci`), then the override variable you name, then an agent detected from the environment, then CI, else a human. It decides:

| | Human | Agent | CI |
| --- | --- | --- | --- |
| Colour | When the stream has it | Never, even with `FORCE_COLOR` | When the stream has it (messages) |
| `Doc.print` | `ansi`: painted, OSC 8 links | `plain` | `githubLog` under GitHub Actions, else `plain` |
| Width | The terminal's | Unbounded | Unbounded |
| Diagnostics (`CliLog`) | Pretty lines | NDJSON | NDJSON |
| Prompts and screens | When interactive | Never | Never |

Colour follows Node's precedence, per stream: `FORCE_COLOR` decides first and beats `NO_COLOR` (`1`–`3` on, even in a pipe; `0` off). Otherwise there is no colour without a terminal. On a terminal, a non-empty `NO_COLOR`, `NODE_DISABLE_COLORS` or `TERM=dumb` turns it off. `TERM=dumb` also switches to ASCII glyphs and makes the run non-interactive.

### Output

- **`CliMessage`**: `success`, `info`, `warning`, `failure` and `status(vocab, name, text)`. One themed line each, through `Console` rather than the logger, so no log level silences them. Warnings and failures go to stderr.
- **`Doc` and `Render`**: a document IR (headings, paragraphs, lists, tables, trees, counts, count tables, collapsibles, callouts, code blocks, diffs, GitHub annotations) and pure `plain`, `ansi`, `markdown` and `githubLog` renderers. `Doc.print` picks the renderer for the audience, and lays out at the terminal's width only when the stream is a terminal: piped output (`tool | grep`) never wraps. `Doc.line(content, { wrap: false })` keeps one line whole at any width, glyph and colour included. `Render.contextOf` renders outside Effect, for example markdown for a step summary.
- **`CliTheme`, `Token`, `Status`, `Glyphs`**: semantic tokens (`success`, `failure`, `warning`, `info`, `error`, `muted`, `accent`, `emphasis`), an extendable status vocabulary with glyphs and ranks, and Unicode or ASCII glyph sets. Override tokens with `env.theme`.
- **`CliLinks`**: file links that open in VS Code (`vscode://file/…`) or as `file://` URLs, as OSC 8 hyperlinks where the terminal renders them, never for an agent.
- **`Fmt`**: `sanitize` and `stripControls`, `width`, `truncate`, `duration`, `percent` and `plural`. `sanitize` keeps line breaks for documents; `stripControls` is the single-line strict form for a field built from text an attacker controls (it also removes CR, LF and tab).

Every string that enters a document or a message is sanitised: escape sequences and control characters are removed, so data cannot paint the terminal or plant a link.

### Failures and exit codes

`CliRuntime.main` reports a failure as a document on stderr, through the audience's renderer: a status line for a typed failure, a tree of rejected values for a schema failure, and a defect's message with a collapsible stack of your own frames (Effect's, Node's and `node_modules` frames hidden). Give an error class a `[CliDoc]()` method to draw itself, or pass a `render` option. Its `details.lines({ status: false })` keeps the run's colour and paths behind your own prefix. The `in: outer › inner` span trail after a failure names only your own spans by default; `env.spans` (`"app"`, `"all"` or `"off"`) chooses, as `env.stackFrames` does for a defect's frames. `"app"` leaves out spans defined in files under the kit's own packages or `node_modules/effect/`, and fails open: a kit package linked into a workspace, or a bundled program, shows more, never less. A program that is itself installed beside the kit passes its bin's `import.meta.url` as `env.appModule` to keep its own spans. `env.spansEnvVar` names a variable (say `TOOL_SPANS`) that sets it at run time, as `log.envVar` sets the level. An `Effect.fn` call and its definition are one entry in the trail.

- `CliExit.set(code)` records a findings exit code from a handler that still succeeds. Do not provide `CliExit.layer` yourself under `main`, or the code goes to a second, unread cell.
- `Cancelled` (a prompt quit) exits `130`, and `NotInteractive` (a prompt with nobody to ask) exits `64`, each as one fixed line.
- A usage error exits `64`. `helpOnUsageError: "stderr"` keeps stdout clean for a caller piping it into `jq`.
- Without `main`: `CliRuntime.reportFailures()` is the combinator to apply inside your program, and `CliRuntime.reported(error, code)` marks an error you printed yourself.

`SchemaIssueRenderer.render(issue)` and `ConfigIssueRenderer.render(error)` turn an issue tree into lines like `unknown key at groups.g.rulesetz`.

### Logging

`CliLogger` writes plain lines, with no timestamp, level or fiber id, and routes every level to stderr by default (`stderrFrom` narrows it), so stdout carries only the program's output. Pass `env.log` to `main` for **`CliLog`**: a diagnostics level of its own (`level`, or `envVar` such as `TOOL_LOG_LEVEL`, with core's `--log-level` beating both), pretty lines for a person and NDJSON for an agent or CI, an optional NDJSON log file, and `CliLog.component(name)` tags. `CliLog.status(vocab, name, text)` logs a diagnostic with a painted status glyph (its text still sanitised), and `CliTheme.forAudience` applies the kit's "an agent never gets an escape" rule to a theme you paint with yourself.

### Prompts

A prompt fires only when `CliInteractive` is true: a human audience, a terminal on stdin and stdout, and `TERM` not `dumb`. Otherwise it answers a default you supply, or fails cleanly.

```ts
import { CliPrompt } from "@beep/cli-kit";
import * as Flag from "effect/cli/Flag";
import * as Prompt from "effect/cli/Prompt";
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

### Testing

`@beep/cli-kit/testing` holds the test doubles, and nothing reachable from the root imports it: `CliTest.sandbox` and `CliTest.run` spawn a built bin hermetically and return `{ exitCode, stdout, stderr }` as data, and `TestTerminal` drives core's prompts. In-process, provide the `layerTest`s from `@beep/runtime-env` and `CliTheme.layerTest`, swap in a capturing `Console`, and assert on both streams.

## Features

- Audience detection and flags (`CliAudience`), interactivity (`CliInteractive`), colour (`CliColor`) and the environment layer (`CliEnv`).
- One-line status messages (`CliMessage`), diagnostics (`CliLog`, `CliLogger`), exit codes (`CliExit`) and the program boundary (`CliRuntime`).
- A document IR with four pure renderers (`Doc`, `Render`), semantic tokens, statuses and glyph sets (`Token`, `Status`, `Glyphs`, `CliTheme`), and editor links (`CliLinks`, `LinkTarget`).
- Failure documents (`CliFailure`), issue renderers (`SchemaIssueRenderer`, `ConfigIssueRenderer`), GitHub annotations (`GithubAnnotation`) and prompts with a fallback (`CliPrompt`, `Cancelled`, `NotInteractive`).
- Text formatting with a display-width model (`Fmt`).

Every option bag and record is a branded `S.Opaque` schema with an `X.Encoded` companion: the functions take `X.Encoded`, so plain object literals work, and the schema validates the same shape. The document IR nodes are `S.TaggedStruct`s, one union per family (`Inline`, `Block`, `TreeNode`), built by plain constructors that admit nested records once.

## Named importers

The capability gate for `foundation/capability` requires at least two importing packages:

- `@beep/repo-cli`: `Yeet/internal/MonitorComments.ts` strips the attacker-controlled fields of every `[yeet]` comment line with `Fmt.stripControls`, and `Accounts/Accounts.view.ts` fits the accounts board by display width with `Fmt.truncate` and `Fmt.width`.
- `@beep/repo-ai-metrics`: `src/agent-effectiveness.ts` strips untrusted worker-eval policy codes with `Fmt.stripControls` before they reach a doctor message.

The scratchpad `cli` `./ui` half (Ink screens and live views) imports it too, until it leaves the lab at the packet's close (SPEC W4-m).

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/cli-kit

# from packages/foundation/capability/cli-kit
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` and import package source through `@beep/cli-kit/<Module>` aliases. `test/boundary.test.ts` reads `src` as raw text (`import.meta.glob` with `?raw`) and holds the root boundary: nothing reachable from `.` is a test double, and the root and `./testing` name no Ink, React, lab `./ui`, platform or `node:` module. `CliStdin.test.ts` and `CliTest.test.ts` spawn Node on the fixtures in `test/fixtures`. `goals/effected-promotion/ops/cli-kit-sanitize-differential.ts` compares `Fmt.stripControls` with the two private sanitizers it replaced, and `goals/effected-promotion/ops/cli-kit-bench.ts` counts the grapheme work of the renderers. `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Port notes

### Added exports

- `Fmt.stripControls` (and `stripControls`): the single-line strict sanitizer (W4-d).
- `@beep/cli-kit/LinkTarget`: `UrlTarget`, `FileTarget`, `LinkTarget`, `LinkTargetInput` and `admitLinkTarget`, out of `Doc.ts` so the renderers read link targets without importing the document builders.
- `@beep/cli-kit/internal/declared`: the declared schemas for non-data option fields (`AnyNumber`, `DisplayPath`, `LinksService`).

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's row of the lab ledger (`bb2134fcb952e07580c4cebf2586c901f090ef5b:scratchpad/effected/PORT_LEDGER.json`). Citations under `scratchpad/test/cli/` are lab-era paths; they resolve at `b6e739944591010fd3bbc62b12088ac2b51623b8`.

- **native-runtime** — The lab uses Effect collections, Record/Clock/FileSystem helpers, explicit delegates and readonly unfrozen data where upstream used native runtime operations, frozen data and a Promise-based filesystem helper. (test/Doc.test.ts:277; Doc.counter.plural.test.ts:84; Glyphs.test.ts:38; Token.test.ts:27; Status.test.ts:91; scratchpad/test/cli/ui/MultiSelect.test.ts; CliHelpRouting.test.ts; scratchpad/test/cli/ui/inkChalk.test.ts:17; scratchpad/test/cli/ui/CliUiTest.ergonomics.test.ts:182)
- **identity-keys** — The lab replaces identity Sets with ancestor scans or owned symbol-keyed maps and uses composed Context keys instead of upstream string keys. (test/CliFailure.test.ts:288; scratchpad/test/cli/ui/CliUi.live.lazy.test.ts:34; module suite test/**)
- **tagged-errors** — The lab uses identity-backed schema errors and typed loader wrappers where upstream used native errors or unknown failures, with corresponding constructor, field, name and stack differences. (test/Cancelled.test.ts:72; test/CliRuntime.test.ts:223; scratchpad/test/cli/ui/inkMissing.test.ts:26; scratchpad/test/cli/ui/CliUi.live.lazy.test.ts:34,57; module suite test/**)
- **schema-first** — The lab derives document, style and key models from executable schemas and named LiteralKit domains where upstream relied on handwritten types and guards. (test/Doc.test.ts:7; scratchpad/test/cli/ui/keys.test.ts:30,38,46; test/Token.test.ts; test/Status.test.ts; test/scanAudience.differential.test.ts)
- **numeric-domains** — The lab adds finite-number schema domains for document metadata and ExitRequested where upstream exposed unvalidated number fields. (test/Doc.test.ts:7 (schema-valid constructor results); test/CliRuntime.test.ts:223 (ExitRequested payload); module suite test/**)
- **type-safety** — The lab replaces unsafe casts with typed structures and narrowing, widens Status.def for core names and centralizes deliberate invalid-test casts. (test/deliberatelyInvalid.ts; test/CliAudience.run.test.ts; test/Status.test.ts:69; scratchpad/test/cli/ui/fakeStreams.regressions.test.ts:6,71; module suite test/**)
- **tsgo-diagnostics** — The lab adds diagnostic-required dual overloads, schema matching, Clock polling and explicit layer provisioning, and replaces async lazy wrappers with promise boundaries. (test/CliLogger.test.ts:44; test/CliTheme.test.ts; scratchpad/test/cli/ui/UiTheme.test.ts; scratchpad/test/cli/ui/keys.test.ts:177; scratchpad/test/cli/ui/CliUi.run.test.ts:290; module suite test/**)
- **effect-first** — The lab uses Effect function wrappers, native Effect helpers and explicit scoped layers, adding named tracing around helpers that upstream left untraced. (test/CliLog.file.test.ts:100; test/CliRuntime.test.ts; scratchpad/test/cli/ui/CliUi.fallback.test.ts; module suite test/**)
- **effect-imports** — The lab imports Effect modules through effect/* paths where upstream grouped them through the root effect barrel. (module suite test/**)
- **identity-annotations** — The lab adds composed @beep/identity identifiers and schema/field annotations to CLI models and errors where upstream supplied no such metadata. (module suite test/**; test/Cancelled.test.ts:72; scratchpad/test/cli/ui/keys.test.ts:30)
- **test-environment** — The lab points process fixtures and serializer registration at lab sources and removes the 12 bundler-dependent declaration gates by operator ruling. (upstream declarations.test.ts (12 removed gates); test/CliStdin.test.ts; scratchpad/test/cli/ui/CliUi.live.exit.test.ts; scratchpad/test/cli/ui/CliUiTest.serializer.test.ts)
- **reachability** — The lab retargets source walkers, root-reference controls and runtime licences to lab paths and the Effect import graph instead of upstream package layout. (test/boundary.test.ts; scratchpad/test/cli/boundary.test.ts; scratchpad/test/cli/ui/CliUi.live.reach.test.ts)
- **upstream-bug** — The lab rejects inherited log-level names with one warning and level None where upstream accepted prototype properties as levels. (test/CliLog.options.test.ts:64)
- **upstream-bug** — The lab counts accepted terminal input only where upstream counted rejected post-end offers as read keys. (test/TestTerminal.regressions.test.ts:6)
- **upstream-bug** — The lab clamps initial Select indices before enabled-choice search where upstream could highlight an unsubmitable disabled choice. (scratchpad/test/cli/ui/Select.test.ts:20)
- **upstream-bug** — The lab preserves trailing spaces and whitespace-only indentation in Verbatim text where upstream trimmed them away in the three text renderers. (test/Render.plain.test.ts:23; test/Render.ansi.test.ts:37; test/Render.githubLog.test.ts:23)
- **upstream-bug** — The lab sanitizes and folds TextInput display segments where upstream rendered hostile value bytes directly, while retaining the original submitted value. (scratchpad/test/cli/ui/widgetText.test.ts:73,98)
- **upstream-bug** — The lab clips every Viewport resize repaint to the current terminal layout where upstream briefly emitted a stale-width row. (scratchpad/test/cli/ui/Viewport.test.ts:335)
- **upstream-bug** — The lab recognizes ST as well as BEL OSC terminators where upstream transcripts exposed hyperlink protocol bytes as visible text. (scratchpad/test/cli/ui/CliUiTest.session.transcript.test.ts:106)
- **upstream-bug** — CliRuntime.reported guards conversion and returns a marked CliRuntimeError with an unprintable-failure message, errorReported=false and the selected exit code compared with upstream: reporting a failure whose string conversion throws emits the fallback diagnostic, then dies with the conversion exception and loses the requested exit code (test/CliRuntime.coverage.test.ts:19).
- **upstream-bug** — Doc.link and layout select URLs with the URL-member schema guard; file links retain their file label and normalized target without the invalid url key compared with upstream: a schema-valid file link carrying url: undefined enters the URL branch, loses its default file label and can crash during target sanitization (test/Doc.test.ts:417; test/layout.test.ts:496).
- **upstream-bug** — Issue entries deduplicate structurally by message and complete path, retaining both rejected locations while keeping their existing display format compared with upstream: issue deduplication uses a dotted display string, collapsing a literal a.b key and the nested path a then b when their messages match (test/internal/format.property.test.ts:10).
- **upstream-bug** — All three reducers return the same submitted state for every later action, retaining the selected value, confirmation answer and selected items compared with upstream: select, Confirm and MultiSelect continue changing reducer state after Enter in the same input chunk, so the returned answer can differ from the submitted answer (scratchpad/test/cli/ui/CliUiTest.chunk.test.ts:51,61,69).
- **upstream-bug** — Markdown text escaping includes exclamation marks, preserving text and link nodes without creating an image compared with upstream: literal exclamation text immediately before a rendered link forms Markdown image syntax instead of text followed by a link (test/Render.markdown.oracle.test.ts:67).
- **upstream-bug** — Rows, labels, details and selected items render from the same mount-time state collections used for submission compared with upstream: select and MultiSelect repaint replacement props after rerender but submit values from their original mount-time choices or sections (scratchpad/test/cli/ui/Select.test.ts:87; scratchpad/test/cli/ui/MultiSelect.test.ts:97).
- **upstream-bug** — Select truncates initial indices, maps NaN to zero, clamps and searches for an existing enabled choice; infinity boundary behavior remains intact compared with upstream: fractional or NaN initial indices can highlight disabled row zero despite an available enabled choice; a missing fractional array entry is treated as enabled (scratchpad/test/cli/ui/Select.test.ts:21).
- **upstream-bug** — Layout reserves a margin and clips single-row children against current Ink dimensions, including input title, value, validation error and help compared with upstream: textInput, highlighted/plain Toggle and column Tabs rely on lagging hook widths, allowing intended single rows to wrap during immediate resize repaints (scratchpad/test/cli/ui/widget-resize.test.ts:21).
- **upstream-bug** — screenAfter tracks grapheme heads and continuation cells, applies carriage return and G/H coordinates to display cells and clears complete overwritten graphemes compared with upstream: terminal transcript overwrites use UTF-16 offsets, leaving an orphan emoji surrogate or deleting a suffix after wide CJK text; G cursor commands always reset to column one (scratchpad/test/cli/ui/testing/terminalModel.coverage.test.ts:6; scratchpad/test/cli/ui/testing/terminalModel.property.test.ts:19).
- **upstream-bug** — TextInput sanitizes the whole value, maps its raw cursor and splits the cleaned result; escape payloads stay hidden and CRLF folds once while raw submission remains unchanged compared with upstream: sanitizing raw cursor slices independently exposes CSI/OSC payload text when the cursor splits an escape, and folds a split CRLF into two spaces (scratchpad/test/cli/ui/widgetText.test.ts:150).
- **schema-first** — New runtime schema values own EditorLinks, Sandbox, RunOptions, RunResult, CliLogFile, CliPromptTarget, AnnotationLevel, GithubAnnotationProperties, GlyphSet, StatusDef, ConfirmAction, SelectAction, MultiSelectAction, ViewportState, ViewportRow, ViewportMove, TextInputState and TabsAction; AudienceKind literals feed the flag; Doc reuses shared schemas compared with upstream: editorLinks, subprocess data, log/prompt payloads, annotation metadata, GlyphSet, StatusDef, widget actions and viewport/text-input state are erased declarations or duplicate runtime vocabularies (test/CliTest.property.test.ts:11; scratchpad/test/cli/ui/Viewport.property.test.ts:33; test/GithubAnnotation.property.test.ts:55).
- **numeric-domains** — Their new executable schemas use S.Finite, rejecting NaN and infinities during codec validation while existing subprocess and reducer construction stays unvalidated compared with upstream: runResult.exitCode, GlyphSet.spinnerIntervalMs, viewport state numbers, TextInputState.cursor and TabsAction.jump have only unrestricted TypeScript number contracts (test/CliTest.property.test.ts:30; test/Glyphs.property.test.ts:9; scratchpad/test/cli/ui/Viewport.property.test.ts:33; scratchpad/test/cli/ui/TextInput.property.test.ts:8; scratchpad/test/cli/ui/Tabs.property.test.ts:8).
- **identity-annotations** — Meaningful schema/message annotations cover DuplicateToggleKeyError, NoEnabledChoiceError, MissingDocViewThemeError, LiveTickError, ScreenExited, DuplicateItemKey, DuplicateViewportKeyError, MissingUiThemeError, InkNotLoaded, ScreenContextError, LazyViewStateError, ConsoleTrace and CliUiTestError; the first eight gain direct-file exports compared with upstream: thirteen reducer, widget and bridge/test-runtime errors omit schema descriptions or message metadata; several error classes are private to their source modules (scratchpad/test/cli/ui/reducer-error-metadata.test.ts:20; scratchpad/test/cli/ui/widget-error-metadata.test.ts:8; scratchpad/test/cli/ui/bridge-error-metadata.test.ts:18).
- **tsgo-diagnostics** — refreshFailureTarget separates audience-only and audience-plus-required-settings calls and requires settings for currying; new internal lineTextAround exposes both data-first and curried overloads compared with upstream: refreshFailureTarget advertises optional settings for currying and a combined optional-argument data-first signature; the cursor mapper has no upstream API (test/internal/failureTarget.coverage.test.ts:19; scratchpad/test/cli/ui/widgetText.test.ts:171).
- **effect-first** — inkChalk recovers only non-interrupt causes, allowing injected filesystem interruption to propagate while retaining unresolved/missing-chalk fallback and the forced Effect/FileSystem shape compared with upstream: upstream Promise filesystem resolution is ported to FileSystem Effects; the previous port catches every cause and turns an injected realPath self-interruption into successful None (scratchpad/test/cli/ui/internal/inkChalk.coverage.test.ts:24).
- **upstream-bug** — The lab resolves an envVar target with path: undefined instead of taking upstream’s crashing path branch (test/CliLog.file.test.ts:102).
- **upstream-bug** — The lab’s file codec preserves explicit-path precedence instead of changing upstream’s destination to envVar on round-trip (test/CliLog.file.test.ts:115; test/CliLog.property.test.ts:39).
- **upstream-bug** — The lab returns typed MissingArgument for an invalid flag sibling instead of upstream’s MissingOption construction defect (test/CliPrompt.test.ts:99; scratchpad/test/cli/ui/CliUi.fallback.test.ts:108).
- **upstream-bug** — The lab propagates interrupted logger initialization instead of upstream’s fallback rebuild and program execution (test/CliMain.test.ts:297).
- **upstream-bug** — The lab wraps immutable errors with their original cause and exit code instead of upstream’s secondary marker-installation defect (test/CliRuntime.coverage.test.ts:38).
- **upstream-bug** — The lab safely warns and disables the file sink for unprintable filesystem defects instead of upstream’s failed drain and scope finalizer (test/internal/fileSink.coverage.test.ts:13).
- **upstream-bug** — The lab degrades only the failed live run when error formatting throws instead of upstream’s terminated controller (scratchpad/test/cli/ui/CliUiLive.coverage.test.ts:146).
- **upstream-bug** — The lab clips KeyHelp and Confirm, Select and MultiSelect rows during resize instead of upstream’s overflowing interim repaints (scratchpad/test/cli/ui/widget-resize.test.ts:19).
- **upstream-bug** — The lab preserves TextInput submission across subsequent keys in one chunk instead of upstream’s canceled or changed answer (scratchpad/test/cli/ui/TextInput.coverage.test.ts:52).
- **upstream-bug** — The lab scrolls whole emoji and flag graphemes instead of upstream’s code-point fragments (scratchpad/test/cli/ui/TextInput.coverage.test.ts:84).
- **upstream-bug** — The lab rejects resize through an ended screen handle instead of upstream’s mutation of the next screen (scratchpad/test/cli/ui/testing/CliUiTest.coverage.test.ts:169).
- **upstream-bug** — The lab clamps shrinking uncontrolled tabs to the remaining active label instead of upstream’s empty selected position (scratchpad/test/cli/ui/Tabs.coverage.test.ts:40).
- **schema-first** — The lab adds executable schemas and derived types for twenty newly modeled payloads instead of upstream’s erased interfaces (test/round3-config-schemas.test.ts:26; test/round3-key-input-schema.test.ts:15; scratchpad/test/cli/ui/KeyTable.property.test.ts:43).
- **numeric-domains** — The lab’s new columns, confirmation row and chosen-index schemas reject nonfinite numbers during validation while upstream has only number types (test/round3-config-schemas.test.ts:80; scratchpad/test/cli/ui/Confirm.property.test.ts:30; scratchpad/test/cli/ui/MultiSelect.property.test.ts:25).
- **identity-annotations** — The lab replaces Style placeholders with semantic field metadata and annotates newly modeled schemas instead of upstream’s unnamed executable contracts (test/Token.test.ts:15; test/round3-key-input-schema.test.ts:15).
- **type-safety** — The lab types reported results as E | Error with explicit recovery narrowing instead of upstream’s overstated E subtype guarantee (test/CliRuntime.test.ts:252; test/CliRuntime.test.ts:282).

### Promotion shifts (wave 4-C)

- `./ui`, `./ui/testing` and `./ui/testing/serializer` are not part of this package: the Ink half is deferred as `@beep/ink` (W4-m), deleted from the lab when the packet closed; it imported this package's leaves (last held at `bb2134fcb952e07580c4cebf2586c901f090ef5b:scratchpad/effected/cli`).
- `CliMessage.status` dispatches on a `Status` vocabulary in first position; it was `dual(4, …)` with an optional fourth parameter, so a three-argument data-first call ran as data-last (#1928 remedy, W4-j).
- Optional schema fields are exact optional keys (`S.optionalKey`, EF-40 from #2145), so a present key holding `undefined` is rejected where upstream's `S.optional` accepted it; the explicit-undefined tests pin that rejection (W4-j, EF-40 branch).
- A `file:` stack frame becomes a path by `fileURLToPath`'s rules without importing `node:url` (#2152): an encoded `/` or `\`, or a host other than `localhost`, leaves the frame as written.
- Option bags and records are branded `S.Opaque` classes taking `X.Encoded`; the service shapes are derived from their `Context.Service` classes; `Column` is a tagged IR node; `parseHex`, `fileUrlPath` and `capOf` return `Option`.
- Span names carry their owner (`CliMessage.status`, `Doc.print`, `FileSink.make`, …).
- `erasableSyntax.test.ts` and `entrypoints.test.ts` are gone: `tsconfig.base.json`'s `erasableSyntaxOnly` enforces the first, and `boundary.test.ts` absorbs the second.

## Provenance

Ported from upstream `@effected/cli` (MIT, C. Spencer Beggs) through the effected port, then promoted from the scratchpad into this workspace package by `goals/effected-promotion` (wave 4, 4-C). The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices. Schema identities moved from `@beep/scratchpad/effected/cli/*` to `@beep/cli-kit/*`.

### Attribution

- Upstream package: `@effected/cli` 0.13.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`$HOME/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)

## License

[MIT](LICENSE)
