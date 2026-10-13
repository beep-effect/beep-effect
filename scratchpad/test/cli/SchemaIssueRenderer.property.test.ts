import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SchemaIssueRenderer } from "../../effected/cli/SchemaIssueRenderer.ts";

const runs = { arbitrary: fcRuns(100) };
const target = S.Struct({ port: S.Finite });
const JsonInput = S.fromJsonString(S.Struct({ port: S.String }));

// This formatter consumes issue trees, not its string output. Fidelity is
// measured by reconstructing the rejected input through its JSON codec.
it.effect.prop("issue formatting preserves the rejected path and survives input serialization", [Arbitrary.schema(S.String)], ([port]) =>
  Effect.gen(function* () {
    const input = { port };
    const issue = yield* S.decodeUnknownEffect(target)(input).pipe(Effect.flip);
    const lines = SchemaIssueRenderer.render(issue.issue);
    assert.strictEqual(lines.length, 1);
    assert.include(lines[0] ?? "", "at port");
    assert.include(lines[0] ?? "", "number");
    assert.deepStrictEqual(SchemaIssueRenderer.render(issue.issue), lines);
    const encoded = yield* S.encodeEffect(JsonInput)(input);
    const decoded = yield* S.decodeEffect(JsonInput)(encoded);
    const reconstructed = yield* S.decodeUnknownEffect(target)(decoded).pipe(Effect.flip);
    assert.deepStrictEqual(SchemaIssueRenderer.render(reconstructed.issue), lines);
  }), runs);
