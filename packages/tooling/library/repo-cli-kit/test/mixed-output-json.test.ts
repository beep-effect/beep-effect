import { jsonObjectTextFromMixedOutput } from "@beep/repo-cli-kit/cli/MixedOutputJson";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Str from "effect/String";

describe("cli/MixedOutputJson", () => {
  it("is None for output with no object", () => {
    assertNone(jsonObjectTextFromMixedOutput(""));
    assertNone(jsonObjectTextFromMixedOutput("plain log line\n"));
    assertNone(jsonObjectTextFromMixedOutput("closing only }"));
  });

  it("extracts the latest decodable top-level object from surrounding log noise", () => {
    assertSome(jsonObjectTextFromMixedOutput('starting\n{"step":1}\nprogress\n{"step":2}\ndone\n'), '{"step":2}');
    assertSome(
      jsonObjectTextFromMixedOutput('{"outer":{"inner":[1,{"deep":true}]}}'),
      '{"outer":{"inner":[1,{"deep":true}]}}'
    );
  });

  it("skips brace spans that are not JSON and keeps the last one that is", () => {
    assertSome(jsonObjectTextFromMixedOutput('{"ok":true} then {not json}'), '{"ok":true}');
    assertNone(jsonObjectTextFromMixedOutput("{not json}"));
  });

  it("ignores braces inside strings, including escaped quotes and escaped backslashes", () => {
    assertSome(jsonObjectTextFromMixedOutput('{"text":"a } b"}'), '{"text":"a } b"}');
    assertSome(jsonObjectTextFromMixedOutput('{"text":"say \\"}\\" now"}'), '{"text":"say \\"}\\" now"}');
    assertSome(jsonObjectTextFromMixedOutput('{"path":"C:\\\\"} trailing'), '{"path":"C:\\\\"}');
  });

  it("treats quotes outside any object as plain text", () => {
    assertSome(jsonObjectTextFromMixedOutput('warn: "unbalanced {"a":1}'), '{"a":1}');
  });

  it("recovers an object nested after an unmatched opening brace by scanning from the end", () => {
    assertSome(jsonObjectTextFromMixedOutput('log { unterminated {"result":{"n":1}}'), '{"result":{"n":1}}');
    assertSome(
      jsonObjectTextFromMixedOutput('{"first":1} { dangling {"text":"}{","list":[{"x":1}]} trailing'),
      '{"text":"}{","list":[{"x":1}]}'
    );
    assertSome(jsonObjectTextFromMixedOutput('{"kept":1} { dangling {bad} no close'), '{"kept":1}');
    assertNone(jsonObjectTextFromMixedOutput("{ never closed"));
  });

  it("stays linear on a flood of balanced objects", () => {
    const flood = A.join(A.replicate('{"i":1}', 20_000), " ");
    assertSome(jsonObjectTextFromMixedOutput(`${flood} {"last":true}`), '{"last":true}');
    assertSome(jsonObjectTextFromMixedOutput(`{ ${Str.repeat(5_000)("{} ")}{"tail":1}`), '{"tail":1}');
  });
});
