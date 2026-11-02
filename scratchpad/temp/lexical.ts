/**
 * Scratch program: build a Markdown AST with `@beep/md` constructors, project it
 * onto the `@beep/lexical-schema` serialized editor state, encode that state to
 * its JSON wire form, and write it to a `.json` file.
 *
 * Run: `bun scratchpad/temp/lexical.ts [output-path]`
 */

import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import { EditorStateFromJson, type SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { markdownDocument, runScratch, specFor, writeTextFile } from "./shared.ts";

// Projection: Md.Document -> Lexical SerializedEditorState.
const projectToEditorState = documentToEditorState;

// Serialization: SerializedEditorState -> JSON string (schema-owned codec).
const serializeEditorState: (state: SerializedEditorState) => Effect.Effect<string, S.SchemaError> =
  S.encodeEffect(EditorStateFromJson);

const program = Effect.fn("renderLexicalState")(function* () {
  const spec = specFor("scratchpad/temp/out/index.lexical.json");
  const state = yield* projectToEditorState(markdownDocument);
  yield* Effect.log(`lexical root has ${state.root.children.length} top-level nodes`);
  const json = yield* serializeEditorState(state);
  yield* writeTextFile(spec.outputPath, json);
});

runScratch(program());
