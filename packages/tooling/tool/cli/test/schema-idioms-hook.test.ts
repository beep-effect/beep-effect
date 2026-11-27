import {
  SCHEMA_IDIOM_STATE_ENV,
  schemaIdiomHookMain,
  schemaIdiomHookOutput,
} from "@beep/repo-cli/commands/SchemaIdioms";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";

const SOURCE = A.join(
  [
    'import * as S from "effect/Schema";',
    "export const Wire = S.Struct({",
    "  timeoutMs: S.Number,",
    "  listenPort: S.Int,",
    "});",
    "",
  ],
  "\n"
);

const decodeHookOutput = S.decodeEffect(
  S.fromJsonString(
    S.Struct({
      hookSpecificOutput: S.Struct({ hookEventName: S.Literal("PostToolUse"), additionalContext: S.String }),
    })
  )
);

const encodePayload = S.encodeEffect(S.fromJsonString(S.Unknown));

const contextOf = (output: O.Option<string>) =>
  O.match(output, {
    onNone: () => Effect.succeedNone,
    onSome: (line) =>
      Effect.map(decodeHookOutput(line), (decoded) => O.some(decoded.hookSpecificOutput.additionalContext)),
  });

const hintedFields = Effect.fn(function* (output: O.Option<string>) {
  const context = yield* contextOf(output);
  return O.match(context, {
    onNone: A.empty<string>,
    onSome: (text) => A.filter(["timeoutMs", "listenPort"], (field) => pipe(text, Str.includes(` ${field}: `))),
  });
});

const payload = (file: string, toolInput: Record<string, unknown>, session: O.Option<string> = O.some("s1")) =>
  encodePayload({
    ...O.match(session, { onNone: () => ({}), onSome: (session_id) => ({ session_id }) }),
    tool_name: "Edit",
    tool_input: { file_path: file, ...toolInput },
  });

const hook = Effect.fn(function* (
  file: string,
  toolInput: Record<string, unknown>,
  state: O.Option<string>,
  session: O.Option<string> = O.some("s1")
) {
  const stdin = yield* payload(file, toolInput, session);
  return yield* schemaIdiomHookOutput(stdin, state);
});

const hookFields = Effect.fn(function* (
  file: string,
  toolInput: Record<string, unknown>,
  state: O.Option<string>,
  session: O.Option<string> = O.some("s1")
) {
  const output = yield* hook(file, toolInput, state, session);
  return yield* hintedFields(output);
});

const sourceFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  const file = path.join(root, "Wire.ts");
  yield* fs.writeFileString(file, SOURCE);
  return { root, file };
});

const decodeChunk = (chunk: string | Uint8Array): string =>
  P.isString(chunk) ? chunk : new TextDecoder().decode(chunk);

const runHookMain = Effect.fn(function* (stdin: string, env: Record<string, string>) {
  const printed = yield* Ref.make(A.empty<string>());
  const stdio = Stdio.make({
    args: Effect.succeed([]),
    stdin: Stream.make(new TextEncoder().encode(stdin)),
    stdout: () => Sink.forEach((chunk: string | Uint8Array) => Ref.update(printed, A.append(decodeChunk(chunk)))),
    stderr: () => Sink.drain,
  });
  yield* schemaIdiomHookMain.pipe(
    Effect.provideService(Stdio.Stdio, stdio),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
  );
  const lines = yield* Ref.get(printed);
  return A.join(lines, "");
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })((it) => {
  it.effect("hints the text a Write, Edit or MultiEdit call wrote", () =>
    Effect.gen(function* () {
      const { file } = yield* sourceFile;
      const write = yield* hook(file, { content: SOURCE }, O.none(), O.none());
      const writeFields = yield* hintedFields(write);
      const writeContext = yield* contextOf(write);
      expect(writeFields).toEqual(["timeoutMs", "listenPort"]);
      expect(O.map(writeContext, Str.startsWith("[schema-idiom] Advisory:"))).toEqual(O.some(true));
      const edit = yield* hookFields(file, { new_string: "  listenPort: S.Int," }, O.none());
      expect(edit).toEqual(["listenPort"]);
      const multiEdit = yield* hookFields(
        file,
        { edits: [{ new_string: "  timeoutMs: S.Number," }, { new_string: "});" }] },
        O.none()
      );
      expect(multiEdit).toEqual(["timeoutMs"]);
    }).pipe(Effect.scoped)
  );

  it.effect("a hint is shown once per field per session", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile;
      const state = O.some(path.join(root, "state.json"));
      const first = yield* hookFields(file, { new_string: "  listenPort: S.Int," }, state);
      expect(first).toEqual(["listenPort"]);
      const again = yield* hook(file, { new_string: "  listenPort: S.Int," }, state);
      expect(again).toEqual(O.none());
      const wider = yield* hookFields(file, { content: SOURCE }, state);
      expect(wider).toEqual(["timeoutMs"]);
      const otherSession = yield* hookFields(file, { new_string: "  listenPort: S.Int," }, state, O.some("s2"));
      expect(otherSession).toEqual(["listenPort"]);
    }).pipe(Effect.scoped)
  );

  it.effect("stays silent on paths it does not hint, bad payloads and missing files", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const { root } = yield* sourceFile;
      const markdown = yield* hook(path.join(root, "README.md"), { content: "x" }, O.none());
      const notJson = yield* schemaIdiomHookOutput("not json", O.none());
      const noToolInput = yield* schemaIdiomHookOutput('{"tool_name":"Edit"}', O.none());
      const missing = yield* hook(path.join(root, "Missing.ts"), { content: SOURCE }, O.none());
      expect([markdown, notJson, noToolInput, missing]).toEqual([O.none(), O.none(), O.none(), O.none()]);
    }).pipe(Effect.scoped)
  );

  it.effect("treats a corrupt or unwritable state file as empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile;
      const corrupt = path.join(root, "corrupt.json");
      yield* fs.writeFileString(corrupt, "{ not an array");
      const fromCorrupt = yield* hookFields(file, { content: SOURCE }, O.some(corrupt));
      expect(fromCorrupt).toEqual(["timeoutMs", "listenPort"]);
      const rewritten = yield* fs.readFileString(corrupt);
      expect(rewritten).toContain("timeoutMs");
      const unwritable = O.some(path.join(root, "absent", "state.json"));
      const first = yield* hookFields(file, { content: SOURCE }, unwritable);
      const second = yield* hookFields(file, { content: SOURCE }, unwritable);
      expect([first, second]).toEqual([
        ["timeoutMs", "listenPort"],
        ["timeoutMs", "listenPort"],
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("the hook program reads stdin and the state variable and prints one line", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile;
      const stdin = yield* payload(file, { content: SOURCE });
      const stated = { [SCHEMA_IDIOM_STATE_ENV]: path.join(root, "main-state.json") };
      const printed = yield* runHookMain(stdin, stated);
      expect(Str.endsWith("\n")(printed)).toBe(true);
      const printedFields = yield* hintedFields(O.some(Str.trimEnd(printed)));
      expect(printedFields).toEqual(["timeoutMs", "listenPort"]);
      const repeated = yield* runHookMain(stdin, stated);
      expect(repeated).toBe("");
      const unstated = yield* runHookMain(stdin, { [SCHEMA_IDIOM_STATE_ENV]: "" });
      const unstatedFields = yield* hintedFields(O.some(Str.trimEnd(unstated)));
      expect(unstatedFields).toEqual(["timeoutMs", "listenPort"]);
      const empty = yield* runHookMain("", {});
      expect(empty).toBe("");
    }).pipe(Effect.scoped)
  );
});
