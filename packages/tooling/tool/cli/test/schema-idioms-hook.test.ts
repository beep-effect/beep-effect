import {
  SCHEMA_IDIOM_STATE_ENV,
  SchemaIdiomHookOutput,
  schemaIdiomHookMain,
  schemaIdiomHookOutput,
} from "@beep/repo-cli/commands/SchemaIdioms";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
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

const COMMENTED = A.join(
  [
    'import * as S from "effect/Schema";',
    "export const Wire = S.Struct({",
    "  timeoutMs: S.Number,",
    "});",
    "/* Added documentation:",
    "timeoutMs: S.Number,",
    "*/",
    "",
  ],
  "\n"
);

const COMMENT_EDIT = "/* Added documentation:\ntimeoutMs: S.Number,\n*/";

const SHA256_HEX = /^[0-9a-f]{64}$/;

const OWNER_ONLY = 0o600;

const decodeHookOutput = S.decodeEffect(S.fromJsonString(SchemaIdiomHookOutput));

const encodePayload = S.encodeEffect(S.fromJsonString(S.Unknown));

const StateEntries = S.String.pipe(S.Array, S.fromJsonString);

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

const payload = (
  toolName: string,
  file: string,
  toolInput: Record<string, unknown>,
  session: O.Option<string> = O.some("s1")
) =>
  encodePayload({
    ...O.match(session, { onNone: () => ({}), onSome: (session_id) => ({ session_id }) }),
    tool_name: toolName,
    tool_input: { file_path: file, ...toolInput },
  });

const hook = Effect.fn(function* (
  toolName: string,
  file: string,
  toolInput: Record<string, unknown>,
  state: O.Option<string>,
  session: O.Option<string> = O.some("s1")
) {
  const stdin = yield* payload(toolName, file, toolInput, session);
  return yield* schemaIdiomHookOutput(stdin, state);
});

const hookFields = Effect.fn(function* (
  toolName: string,
  file: string,
  toolInput: Record<string, unknown>,
  state: O.Option<string>,
  session: O.Option<string> = O.some("s1")
) {
  const output = yield* hook(toolName, file, toolInput, state, session);
  return yield* hintedFields(output);
});

const sourceFile = Effect.fn(function* (source: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  const file = path.join(root, "Wire.ts");
  yield* fs.writeFileString(file, source);
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
      const { file } = yield* sourceFile(SOURCE);
      const write = yield* hook("Write", file, { content: SOURCE }, O.none());
      const writeFields = yield* hintedFields(write);
      const writeContext = yield* contextOf(write);
      expect(writeFields).toEqual(["timeoutMs", "listenPort"]);
      expect(O.getOrElse(writeContext, () => "")).toMatch(/^\[schema-idiom\] Advisory:/);
      const edit = yield* hookFields("Edit", file, { old_string: "x", new_string: "  listenPort: S.Int," }, O.none());
      expect(edit).toEqual(["listenPort"]);
      const multiEdit = yield* hookFields(
        "MultiEdit",
        file,
        { edits: [{ new_string: "  timeoutMs: S.Number," }, { new_string: "});" }] },
        O.none()
      );
      expect(multiEdit).toEqual(["timeoutMs"]);
    })
  );

  it.effect("a hint is shown once per field per session", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile(SOURCE);
      const state = O.some(path.join(root, "state.json"));
      const first = yield* hookFields("Edit", file, { new_string: "  listenPort: S.Int," }, state);
      expect(first).toEqual(["listenPort"]);
      const again = yield* hook("Edit", file, { new_string: "  listenPort: S.Int," }, state);
      assertNone(again);
      const wider = yield* hookFields("Write", file, { content: SOURCE }, state);
      expect(wider).toEqual(["timeoutMs"]);
      const otherSession = yield* hookFields("Edit", file, { new_string: "  listenPort: S.Int," }, state, O.some("s2"));
      expect(otherSession).toEqual(["listenPort"]);
    })
  );

  it.effect("decodes only Edit, MultiEdit and Write payloads with a session", () =>
    Effect.gen(function* () {
      const { file } = yield* sourceFile(SOURCE);
      const refused = yield* Effect.all(
        [
          hook("Read", file, {}, O.none()),
          hook("Grep", file, { content: SOURCE }, O.none()),
          hook("Write", file, { new_string: "  listenPort: S.Int," }, O.none()),
          hook("Edit", file, { content: SOURCE }, O.none()),
          hook("MultiEdit", file, { edits: [] }, O.none()),
          hook("Write", file, { content: SOURCE }, O.none(), O.none()),
          hook("Write", file, { content: SOURCE }, O.none(), O.some("")),
        ],
        { concurrency: 1 }
      );
      A.forEach(refused, (output) => assertNone(output));
      const control = yield* hookFields("Write", file, { content: SOURCE }, O.none());
      expect(control).toEqual(["timeoutMs", "listenPort"]);
    })
  );

  it.effect("an edit that only adds a comment repeating a field line hints nothing and consumes no key", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile(COMMENTED);
      const statePath = path.join(root, "state.json");
      const state = O.some(statePath);
      const silent = yield* Effect.all(
        [
          hook("Edit", file, { old_string: "/* old note */", new_string: COMMENT_EDIT }, state),
          hook("MultiEdit", file, { edits: [{ new_string: COMMENT_EDIT }] }, state),
          hook("Edit", file, { new_string: "timeoutMs: S.Number," }, state),
        ],
        { concurrency: 1 }
      );
      A.forEach(silent, (output) => assertNone(output));
      const stateWritten = yield* fs.exists(statePath);
      expect(stateWritten).toBe(false);
      const write = yield* hookFields("Write", file, { content: COMMENTED }, state);
      expect(write).toEqual(["timeoutMs"]);
    })
  );

  it.effect("stays silent on paths it does not hint, bad payloads and missing files", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const { root } = yield* sourceFile(SOURCE);
      const silent = yield* Effect.all(
        [
          hook("Write", path.join(root, "README.md"), { content: "x" }, O.none()),
          schemaIdiomHookOutput("not json", O.none()),
          schemaIdiomHookOutput('{"tool_name":"Edit"}', O.none()),
          hook("Write", path.join(root, "Missing.ts"), { content: SOURCE }, O.none()),
        ],
        { concurrency: 1 }
      );
      A.forEach(silent, (output) => assertNone(output));
    })
  );

  it.effect("persists only owner-only digests of the hint keys", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile(SOURCE);
      const statePath = path.join(root, "state.json");
      const shown = yield* hookFields("Write", file, { content: SOURCE }, O.some(statePath), O.some("session-secret"));
      expect(shown).toEqual(["timeoutMs", "listenPort"]);
      const text = yield* fs.readFileString(statePath);
      const entries = yield* S.decodeEffect(StateEntries)(text);
      expect(A.length(entries)).toBe(2);
      expect(A.every(entries, (entry) => SHA256_HEX.test(entry))).toBe(true);
      expect(
        A.filter([root, "session-secret", "timeoutMs", "listenPort"], (raw) => pipe(text, Str.includes(raw)))
      ).toEqual([]);
      const info = yield* fs.stat(statePath);
      expect(info.mode & 0o777).toBe(OWNER_ONLY);
    })
  );

  it.effect("discards legacy plaintext state entries and tightens an existing state file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile(SOURCE);
      const statePath = path.join(root, "legacy.json");
      const legacy = yield* S.encodeEffect(StateEntries)([`s1\t${file}\ttimeoutMs\tduration`]);
      yield* fs.writeFileString(statePath, legacy, { mode: 0o644 });
      yield* fs.chmod(statePath, 0o644);
      const shown = yield* hookFields("Write", file, { content: SOURCE }, O.some(statePath));
      expect(shown).toEqual(["timeoutMs", "listenPort"]);
      const text = yield* fs.readFileString(statePath);
      expect(pipe(text, Str.includes(root))).toBe(false);
      const entries = yield* S.decodeEffect(StateEntries)(text);
      expect(A.every(entries, (entry) => SHA256_HEX.test(entry))).toBe(true);
      const info = yield* fs.stat(statePath);
      expect(info.mode & 0o777).toBe(OWNER_ONLY);
    })
  );

  it.effect("treats a corrupt or unwritable state file as empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile(SOURCE);
      const corrupt = path.join(root, "corrupt.json");
      yield* fs.writeFileString(corrupt, "{ not an array");
      const fromCorrupt = yield* hookFields("Write", file, { content: SOURCE }, O.some(corrupt));
      expect(fromCorrupt).toEqual(["timeoutMs", "listenPort"]);
      const rewritten = yield* fs.readFileString(corrupt);
      const entries = yield* S.decodeEffect(StateEntries)(rewritten);
      expect(A.length(entries)).toBe(2);
      const unwritable = O.some(path.join(root, "absent", "state.json"));
      const first = yield* hookFields("Write", file, { content: SOURCE }, unwritable);
      const second = yield* hookFields("Write", file, { content: SOURCE }, unwritable);
      expect([first, second]).toEqual([
        ["timeoutMs", "listenPort"],
        ["timeoutMs", "listenPort"],
      ]);
    })
  );

  it.effect("the hook program reads stdin and the state variable and prints one line", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const { root, file } = yield* sourceFile(SOURCE);
      const stdin = yield* payload("Write", file, { content: SOURCE });
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
    })
  );
});
