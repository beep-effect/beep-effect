/**
 * The Claude Code `PostToolUse` hook program for schema idiom hints: decode
 * the hook input from stdin, hint the just-written text of the edited file,
 * drop hints this session already saw, and print them as
 * `hookSpecificOutput.additionalContext`.
 *
 * **Details**
 *
 * The program never fails and prints nothing when there is no new hint, when
 * the input does not decode, or on any error: the hint is advisory. Plain
 * stdout from a `PostToolUse` hook reaches only the debug log, which is why
 * the message travels as `additionalContext` (see `.claude/hooks/law-pulse.sh`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { SchemaIdiomHintInput } from "./SchemaIdiomHints.model.ts";
import { isSchemaIdiomHintPath, schemaIdiomHints } from "./SchemaIdiomHints.ts";
import { renderSchemaIdiomHintMessage } from "./SchemaIdioms.render.ts";
import type { SchemaIdiomHint } from "./SchemaIdiomHints.model.ts";

const $I = $RepoCliId.create("commands/SchemaIdioms/SchemaIdioms.hook");

/**
 * Environment variable naming the file that remembers which hints a session
 * has already seen; `.claude/hooks/schema-idiom.sh` sets it.
 *
 * **Example** (Read the variable name)
 *
 * ```ts
 * import { SCHEMA_IDIOM_STATE_ENV } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * console.log(SCHEMA_IDIOM_STATE_ENV) // "BEEP_SCHEMA_IDIOM_STATE"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SCHEMA_IDIOM_STATE_ENV = "BEEP_SCHEMA_IDIOM_STATE";

const STATE_LIMIT = 2000;

/**
 * **Example** (Decode an Edit tool payload)
 *
 * ```ts
 * import { SchemaIdiomHookToolInput } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownOption(SchemaIdiomHookToolInput)({ file_path: "src/a.ts", new_string: "x" })
 * console.log(input) // Some with new_string Some("x")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIdiomHookToolInput extends S.Opaque<SchemaIdiomHookToolInput, { readonly brand: unique symbol }>()(
  S.Struct({
    file_path: S.String,
    new_string: S.OptionFromOptionalKey(S.String),
    content: S.OptionFromOptionalKey(S.String),
    edits: S.OptionFromOptionalKey(S.Struct({ new_string: S.String }).pipe(S.Array)),
  }).pipe(
    $I.annoteSchema("SchemaIdiomHookToolInput", {
      description:
        "The tool_input of a Claude Code Edit, MultiEdit or Write call: the edited file and the text written into it.",
    })
  )
) {}

/**
 * **Example** (Decode a hook payload)
 *
 * ```ts
 * import { SchemaIdiomHookInput } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownOption(SchemaIdiomHookInput)({
 *   session_id: "s1",
 *   tool_name: "Write",
 *   tool_input: { file_path: "src/a.ts", content: "x" },
 * })
 * console.log(input._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIdiomHookInput extends S.Opaque<SchemaIdiomHookInput, { readonly brand: unique symbol }>()(
  S.Struct({
    session_id: S.String.pipe(S.withDecodingDefaultKey(Effect.succeed(""))),
    tool_name: S.String,
    tool_input: SchemaIdiomHookToolInput,
  }).pipe(
    $I.annoteSchema("SchemaIdiomHookInput", {
      description: "The Claude Code PostToolUse hook payload fields the schema idiom hint reads.",
    })
  )
) {}

const decodeHookInput = S.decodeUnknownEffect(S.fromJsonString(SchemaIdiomHookInput));

const SeenHints = S.Array(S.String).pipe(
  $I.annoteSchema("SeenHints", {
    description: "Keys of the (session, file, field, kind) hints already shown, oldest first.",
  })
);

const SeenHintsJson = S.fromJsonString(SeenHints);

const HookOutput = S.Struct({
  hookSpecificOutput: S.Struct({
    hookEventName: S.tag("PostToolUse"),
    additionalContext: S.String,
  }),
}).pipe(
  $I.annoteSchema("SchemaIdiomHookOutput", {
    description: "The PostToolUse hook output that injects the advisory message into the model's context.",
  })
);

const encodeHookOutput = S.encodeEffect(S.fromJsonString(HookOutput));

const writtenText = (input: SchemaIdiomHookToolInput): O.Option<string> =>
  O.firstSomeOf([
    input.new_string,
    input.content,
    O.map(input.edits, (edits) =>
      A.join(
        A.map(edits, (edit) => edit.new_string),
        "\n"
      )
    ),
  ]);

const hintKey = (session: string, file: string, hint: SchemaIdiomHint): string =>
  A.join([session, file, hint.field, hint.kind], "\t");

const readSeen = Effect.fn("SchemaIdioms.readSeenHints")(function* (statePath: O.Option<string>) {
  const fs = yield* FileSystem.FileSystem;
  return yield* O.match(statePath, {
    onNone: () => Effect.succeed(A.empty<string>()),
    onSome: (file) =>
      fs
        .readFileString(file)
        .pipe(Effect.flatMap(S.decodeUnknownEffect(SeenHintsJson)), Effect.orElseSucceed(A.empty<string>)),
  });
});

const writeSeen = Effect.fn("SchemaIdioms.writeSeenHints")(function* (
  statePath: O.Option<string>,
  seen: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  yield* O.match(statePath, {
    onNone: () => Effect.void,
    onSome: (file) =>
      S.encodeEffect(SeenHintsJson)(A.takeRight(seen, STATE_LIMIT)).pipe(
        Effect.flatMap((text) => fs.writeFileString(file, text)),
        Effect.ignore
      ),
  });
});

/**
 * Compute the hook's stdout for one `PostToolUse` payload.
 *
 * **Details**
 *
 * Hints the edited file only when {@link isSchemaIdiomHintPath} accepts it,
 * limited to the lines just written (`new_string`, `content`, or each
 * MultiEdit `new_string`). With a state file, each hint is shown once per
 * `(session, file, field, kind)` key and remembered there.
 *
 * **Example** (Ignore a payload that does not decode)
 *
 * ```ts
 * import { schemaIdiomHookOutput } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = schemaIdiomHookOutput("not json", O.none())
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param stdin - The raw hook payload.
 * @param statePath - The file that remembers hints already shown, if any.
 * @returns The JSON line to print, or none.
 * @category use-cases
 * @since 0.0.0
 */
export const schemaIdiomHookOutput = Effect.fn("SchemaIdioms.schemaIdiomHookOutput")(
  function* (stdin: string, statePath: O.Option<string>) {
    const fs = yield* FileSystem.FileSystem;
    const input = yield* decodeHookInput(stdin);
    const file = input.tool_input.file_path;
    if (!isSchemaIdiomHintPath(file)) {
      return O.none<string>();
    }
    const text = yield* fs.readFileString(file);
    const hints = schemaIdiomHints(SchemaIdiomHintInput.make({ file, text, written: writtenText(input.tool_input) }));
    const seen = yield* readSeen(statePath);
    const seenSet = HashSet.fromIterable(seen);
    const fresh = A.filter(hints, (hint) => !HashSet.has(seenSet, hintKey(input.session_id, file, hint)));
    if (!A.isReadonlyArrayNonEmpty(fresh)) {
      return O.none<string>();
    }
    yield* writeSeen(
      statePath,
      A.appendAll(
        seen,
        A.map(fresh, (hint) => hintKey(input.session_id, file, hint))
      )
    );
    const output = yield* encodeHookOutput({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: renderSchemaIdiomHintMessage(fresh) },
    });
    return O.some(output);
  },
  Effect.catchCause(() => Effect.succeed(O.none<string>()))
);

/**
 * The hook program: read the payload from stdin and the state file path from
 * {@link SCHEMA_IDIOM_STATE_ENV}, then print the output line when there is one.
 *
 * **Example** (Run with an empty stdin)
 *
 * ```ts
 * import { schemaIdiomHookMain } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(schemaIdiomHookMain)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const schemaIdiomHookMain: Effect.Effect<void, never, FileSystem.FileSystem | Stdio.Stdio> = Effect.gen(
  function* () {
    const stdio = yield* Stdio.Stdio;
    const stdin = yield* stdio.stdin.pipe(Stream.decodeText(), Stream.mkString);
    const statePath = yield* Config.option(Config.String(SCHEMA_IDIOM_STATE_ENV)).pipe(
      Config.map(O.filter(Str.isNonEmpty))
    );
    const output = yield* schemaIdiomHookOutput(stdin, statePath);
    yield* O.match(output, {
      onNone: () => Effect.void,
      onSome: (line) => Stream.run(Stream.make(`${line}\n`), stdio.stdout()),
    });
  }
).pipe(Effect.ignoreCause, Effect.withSpan("SchemaIdioms.schemaIdiomHookMain"));
