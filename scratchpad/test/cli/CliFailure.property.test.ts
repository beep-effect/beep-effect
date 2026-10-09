import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CliFailure } from "../../effected/cli/CliFailure.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";
import { Render } from "../../effected/cli/Render.ts";

const runs = { arbitrary: fcRuns(100) };
const context = Render.contextOf({ audience: "agent" });
it.effect.prop("failure formatting preserves each sanitized line and is stable through text encoding", [Arbitrary.schema(S.String)], ([message]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(S.fromJsonString(S.String))(message);
  const decoded = yield* S.decodeEffect(S.fromJsonString(S.String))(encoded);
  const doc = CliFailure.toDoc(Cause.fail(message), { spans: "off" });
  assert.deepStrictEqual(CliFailure.toDoc(Cause.fail(decoded), { spans: "off" }), doc);
  const rendered = Render.plain(doc, context);
  assert.strictEqual(Fmt.sanitize(rendered), rendered);
  for (const line of Fmt.sanitize(message).split(/\r\n|\r|\n/)) assert.include(rendered, Str.trim(line));
  assert.deepStrictEqual(Render.plain(CliFailure.toDoc(Cause.fail(Fmt.sanitize(message)), { spans: "off" }), context), rendered);
}), runs);

it.effect.prop("stack position parsing preserves function, path and coordinates across path and file-URL spellings", [Arbitrary.schema(S.String), Arbitrary.schema(S.Finite), Arbitrary.schema(S.Finite)], ([text, row, column]) => Effect.sync(() => {
  const file = `/repo/file-${encodeURIComponent(text.toWellFormed()).replace(/\(/g, "%28").replace(/\)/g, "%29")}.ts`;
  const line = Math.max(1, Math.floor(Math.abs(row % 1000)));
  const col = Math.max(1, Math.floor(Math.abs(column % 1000)));
  const pathError = new Error("failed");
  pathError.stack = `Error: failed\n at operation (${file}:${line}:${col})`;
  const urlError = new Error("failed");
  urlError.stack = `Error: failed\n at operation (file://${file.replace(/%/g, "%25")}:${line}:${col})`;
  const pathReport = Render.plain(CliFailure.toDoc(Cause.die(pathError)), context);
  const urlReport = Render.plain(CliFailure.toDoc(Cause.die(urlError)), context);
  assert.strictEqual(urlReport, pathReport);
  assert.include(pathReport, `operation ${file}:${line}:${col}`);
  assert.strictEqual(Fmt.sanitize(pathReport), pathReport);
}), runs);
