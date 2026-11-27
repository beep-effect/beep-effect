/**
 * The Claude Code `PostToolUse` hook program for schema idiom hints: decode
 * the hook input from stdin, hint the just-written text of the edited file,
 * drop hints this session already saw, and print them as
 * `hookSpecificOutput.additionalContext`.
 *
 * **Details**
 *
 * The program never fails and prints nothing when there is no new hint, when
 * the input does not decode, or on any error: the hint is advisory. Only an
 * `Edit` or `Write` payload with a non-empty `session_id` decodes; a
 * `MultiEdit` payload does not, because a new string found in the final file
 * does not prove which occurrence an earlier edit of the same call wrote.
 * Plain stdout from a `PostToolUse` hook reaches only the debug log,
 * which is why the message travels as `additionalContext` (see
 * `.claude/hooks/law-pulse.sh`). The state file holds only SHA-256 digests of
 * the `(session, file, field, kind)` keys and is written owner-only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constFalse } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { SchemaIdiomHintInput, SchemaIdiomKind } from "./SchemaIdiomHints.model.ts";
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

const STATE_FILE_MODE = 0o600;

/**
 * **Example** (Decode an Edit payload)
 *
 * ```ts
 * import { SchemaIdiomEditHookInput } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownOption(SchemaIdiomEditHookInput)({
 *   session_id: "s1",
 *   tool_name: "Edit",
 *   tool_input: { file_path: "src/a.ts", old_string: "a", new_string: "b" },
 * })
 * console.log(input._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIdiomEditHookInput extends S.Opaque<SchemaIdiomEditHookInput, { readonly brand: unique symbol }>()(
  S.Struct({
    session_id: S.NonEmptyString,
    tool_name: S.tag("Edit"),
    tool_input: S.Struct({ file_path: S.String, new_string: S.String }),
  }).pipe(
    $I.annoteSchema("SchemaIdiomEditHookInput", {
      description:
        "A PostToolUse payload for a Claude Code Edit call: the session, the edited file and the new string.",
    })
  )
) {}

/**
 * **Example** (Decode a Write payload)
 *
 * ```ts
 * import { SchemaIdiomWriteHookInput } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownOption(SchemaIdiomWriteHookInput)({
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
export class SchemaIdiomWriteHookInput extends S.Opaque<SchemaIdiomWriteHookInput, { readonly brand: unique symbol }>()(
  S.Struct({
    session_id: S.NonEmptyString,
    tool_name: S.tag("Write"),
    tool_input: S.Struct({ file_path: S.String, content: S.String }),
  }).pipe(
    $I.annoteSchema("SchemaIdiomWriteHookInput", {
      description: "A PostToolUse payload for a Claude Code Write call: the session, the written file and its content.",
    })
  )
) {}

/**
 * **Example** (Refuse a payload from another tool)
 *
 * ```ts
 * import { SchemaIdiomHookInput } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(SchemaIdiomHookInput)
 * console.log(decode({ session_id: "s1", tool_name: "Write", tool_input: { file_path: "a.ts", content: "x" } })._tag) // "Some"
 * console.log(decode({ session_id: "s1", tool_name: "Read", tool_input: { file_path: "a.ts" } })._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaIdiomHookInput = S.Union([SchemaIdiomEditHookInput, SchemaIdiomWriteHookInput]).pipe(
  S.toTaggedUnion("tool_name"),
  $I.annoteSchema("SchemaIdiomHookInput", {
    description: "The Claude Code PostToolUse payloads the schema idiom hint reads, keyed by tool_name: Edit or Write.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaIdiomHookInput = typeof SchemaIdiomHookInput.Type;

/**
 * **Example** (Build the hook output)
 *
 * ```ts
 * import { SchemaIdiomHookOutput } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * const output = SchemaIdiomHookOutput.make({
 *   hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "[schema-idiom] Advisory: ..." },
 * })
 * console.log(output.hookSpecificOutput.hookEventName) // "PostToolUse"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIdiomHookOutput extends S.Opaque<SchemaIdiomHookOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    hookSpecificOutput: S.Struct({
      hookEventName: S.tag("PostToolUse"),
      additionalContext: S.String,
    }),
  }).pipe(
    $I.annoteSchema("SchemaIdiomHookOutput", {
      description: "The PostToolUse hook output that injects the advisory message into the model's context.",
    })
  )
) {}

const decodeHookInput = S.decodeUnknownEffect(S.fromJsonString(SchemaIdiomHookInput));

const encodeHookOutput = S.encodeEffect(S.fromJsonString(SchemaIdiomHookOutput));

const SeenHints = S.Array(S.String).pipe(
  $I.annoteSchema("SeenHints", {
    description: "Entries of the hint state file, oldest first; only SHA-256 digest entries are kept.",
  })
);

const SeenHintsJson = S.fromJsonString(SeenHints);

const HintKey = S.Tuple([S.String, S.String, S.String, SchemaIdiomKind]).pipe(
  $I.annoteSchema("SchemaIdiomHintKey", {
    description: "The (session, file, field, kind) tuple a shown hint is remembered by, before it is digested.",
  })
);

const encodeHintKey = S.encodeEffect(S.fromJsonString(HintKey));

const isSeenDigest = S.is(Sha256Hex);

const writtenFragments = (input: SchemaIdiomHookInput): O.Option<A.NonEmptyReadonlyArray<string>> =>
  SchemaIdiomHookInput.match(input, {
    Edit: (edit) => O.some(A.of(edit.tool_input.new_string)),
    Write: () => O.none(),
  });

const hintKey = Effect.fn("SchemaIdioms.hintKey")(function* (session: string, file: string, hint: SchemaIdiomHint) {
  const digest = yield* Digest.Digest;
  const key = yield* encodeHintKey([session, file, hint.field, hint.kind]);
  return yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(key));
});

const isSymbolicLinkState = Effect.fn("SchemaIdioms.isSymbolicLinkState")(function* (statePath: O.Option<string>) {
  const fs = yield* FileSystem.FileSystem;
  return yield* O.match(statePath, {
    onNone: () => Effect.succeed(false),
    onSome: (file) =>
      fs.lstat(file).pipe(
        Effect.map((info) => info.type === "SymbolicLink"),
        Effect.orElseSucceed(constFalse)
      ),
  });
});

const readSeen = Effect.fn("SchemaIdioms.readSeenHints")(function* (statePath: O.Option<string>) {
  const fs = yield* FileSystem.FileSystem;
  return yield* O.match(statePath, {
    onNone: () => Effect.succeed(A.empty<string>()),
    onSome: (file) =>
      fs
        .readFileString(file)
        .pipe(
          Effect.flatMap(S.decodeUnknownEffect(SeenHintsJson)),
          Effect.map(A.filter(isSeenDigest)),
          Effect.orElseSucceed(A.empty<string>)
        ),
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
        Effect.flatMap((text) => fs.writeFileString(file, text, { mode: STATE_FILE_MODE })),
        Effect.andThen(fs.chmod(file, STATE_FILE_MODE)),
        Effect.ignore
      ),
  });
});

/**
 * Compute the hook's stdout for one `PostToolUse` payload.
 *
 * **Details**
 *
 * Hints the edited file only when {@link isSchemaIdiomHintPath} accepts it.
 * A `Write` hints the whole file; an `Edit` hints only fields lying inside
 * its new string when that string occurs exactly once in the edited file.
 * With a state file, each hint is shown once per
 * `(session, file, field, kind)` key, remembered there as a SHA-256 digest;
 * a hint that is not shown consumes no key. A state path that is a symbolic
 * link is refused: nothing is printed and its target is not written.
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
    const refusedState = yield* isSymbolicLinkState(statePath);
    if (refusedState || !isSchemaIdiomHintPath(file)) {
      return O.none<string>();
    }
    const text = yield* fs.readFileString(file);
    const hints = schemaIdiomHints(SchemaIdiomHintInput.make({ file, text, written: writtenFragments(input) }));
    if (!A.isReadonlyArrayNonEmpty(hints)) {
      return O.none<string>();
    }
    const keyed = yield* Effect.forEach(
      hints,
      (hint) =>
        Effect.map(hintKey(input.session_id, file, hint), (key): readonly [SchemaIdiomHint, string] => [hint, key]),
      { concurrency: 1 }
    );
    const seen = yield* readSeen(statePath);
    const seenSet = HashSet.fromIterable(seen);
    const fresh = A.filter(keyed, ([, key]) => !HashSet.has(seenSet, key));
    if (!A.isReadonlyArrayNonEmpty(fresh)) {
      return O.none<string>();
    }
    yield* writeSeen(
      statePath,
      A.appendAll(
        seen,
        A.map(fresh, ([, key]) => key)
      )
    );
    const output = yield* encodeHookOutput(
      SchemaIdiomHookOutput.make({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: renderSchemaIdiomHintMessage(A.map(fresh, ([hint]) => hint)),
        },
      })
    );
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
export const schemaIdiomHookMain: Effect.Effect<void, never, FileSystem.FileSystem | Stdio.Stdio | Digest.Digest> =
  Effect.gen(function* () {
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
  }).pipe(Effect.ignoreCause, Effect.withSpan("SchemaIdioms.schemaIdiomHookMain"));
