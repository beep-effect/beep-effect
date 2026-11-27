// Ported from vitest-agent packages/plugin/__test__/process-failure.test.ts at 1cf1ab94 (MIT).
import { FailureSignatureInput, failureSignature } from "@beep/gate-report/FailureSignature";
import {
  coerceErrorText,
  errorDetail,
  formatStackFrame,
  framesOf,
  readField,
  UNREADABLE_FIELD,
} from "@beep/repo-gate-vitest/internal/ErrorText";
import {
  errorFrames,
  errorSignature,
  failureLocation,
  isFrameworkPath,
  topFrame,
} from "@beep/repo-gate-vitest/internal/TopFrame";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import type { VitestError } from "@beep/repo-gate-vitest/internal/VitestShapes";

describe("errorFrames — parsed frames", () => {
  it("uses defaults when frame fields are all missing, and selects no top frame", () => {
    const error: VitestError = { name: "AssertionError", message: "expect(received).toBe(expected)", stacks: [{}] };
    assert.deepStrictEqual(errorFrames(error), [{ method: O.none(), file: "<unknown>", line: 0, column: 0 }]);
    assertNone(topFrame(error));
    assertNone(errorSignature(error));
  });

  it("uses provided values and keeps a missing method absent", () => {
    const frames = errorFrames({
      message: "x",
      stacks: [
        { file: "/some/path/foo.ts", line: 5, column: 3 },
        { method: "namedFn", file: "/some/other/bar.ts", line: 10, column: 2 },
      ],
    });
    assert.deepStrictEqual(frames, [
      { method: O.none(), file: "/some/path/foo.ts", line: 5, column: 3 },
      { method: O.some("namedFn"), file: "/some/other/bar.ts", line: 10, column: 2 },
    ]);
  });

  it("parses a string frame and keeps an unparseable one as unknown", () => {
    const frames = errorFrames({ message: "x", stacks: ["    at fn (/a/b.ts:3:4)", "garbage"] });
    assert.deepStrictEqual(frames, [
      { method: O.some("fn"), file: "/a/b.ts", line: 3, column: 4 },
      { method: O.none(), file: "<unknown>", line: 0, column: 0 },
    ]);
  });

  it("falls back to the raw stack when there are no parsed frames", () => {
    const frames = errorFrames({
      message: "x",
      stack:
        "Error: x\n    at Object.<anonymous> (/repo/test/a.test.ts:7:11)\n    at /repo/node_modules/vitest/dist/x.js:1:1",
    });
    assert.deepStrictEqual(
      A.map(frames, (frame) => frame.file),
      ["/repo/test/a.test.ts", "/repo/node_modules/vitest/dist/x.js"]
    );
    assert.deepStrictEqual(errorFrames({ message: "no stack" }), []);
  });

  it("reads frames that throw on access as none", () => {
    const hostile: VitestError = {
      get stacks(): ReadonlyArray<string> {
        throw new TypeError("no frames");
      },
    };
    assert.deepStrictEqual(framesOf(hostile), []);
  });
});

describe("topFrame and the signature", () => {
  const failure: VitestError = {
    name: "AssertionError",
    message: "expect(2).toBe(3)",
    stacks: [
      { method: "expect", file: "/repo/node_modules/@vitest/expect/dist/index.js", line: 1, column: 1 },
      { method: "wrapper", file: "/repo/packages/demo/test/a.test.ts", line: 3, column: 9 },
    ],
  };

  it("skips framework frames", () => {
    assert.isTrue(isFrameworkPath("node:internal/process"));
    assert.isTrue(isFrameworkPath("/x/vitest/dist/chunk.js"));
    assert.isFalse(isFrameworkPath("/repo/packages/demo/src/a.ts"));
    assertSome(
      O.map(topFrame(failure), (frame) => frame.line),
      3
    );
  });

  it("hashes the error name, assertion shape, top frame function and raw-line bucket", () => {
    assertSome(
      errorSignature(failure),
      failureSignature(
        FailureSignatureInput.make({
          errorName: "AssertionError",
          assertionMessage: "expect(2).toBe(3)",
          topFrameFunction: "wrapper",
          rawLine: O.some(3),
        })
      )
    );
  });

  it("names an anonymous top frame and an unnamed error by their defaults", () => {
    const unnamed: VitestError = { message: "m", stacks: [{ file: "/a.ts", line: 1, column: 1 }] };
    assertSome(
      errorSignature(unnamed),
      failureSignature(
        FailureSignatureInput.make({
          errorName: "Error",
          assertionMessage: "m",
          topFrameFunction: "<anonymous>",
          rawLine: O.some(1),
        })
      )
    );
  });

  it("makes the location relative to the package root only inside it", () => {
    const inside = { method: O.none(), file: "/root/src/a.ts", line: 2, column: 3 };
    assertSome(
      O.map(failureLocation(inside, "/root"), (location) => location.file),
      "src/a.ts"
    );
    assertSome(
      O.map(failureLocation("/elsewhere")(inside), (location) => location.file),
      "/root/src/a.ts"
    );
    assertNone(failureLocation({ ...inside, line: 0 }, "/root"));
  });
});

describe("error text", () => {
  it("coerces field values to text", () => {
    assertNone(coerceErrorText(undefined));
    assertNone(coerceErrorText(null));
    assertSome(coerceErrorText("plain"), "plain");
    assertSome(coerceErrorText({ a: 1 }), '{"a":1}');
    assertSome(coerceErrorText(10n), "10n");
  });

  // Ported from vitest-agent packages/sdk/__test__/coerce-error-text.test.ts at 1cf1ab94 (MIT).
  it("renders an Error's name and message instead of an empty object", () => {
    assertSome(coerceErrorText(new Error("boom")), '{"name":"Error","message":"boom"}');
  });

  it("drops a circular reference instead of falling back to [object Object]", () => {
    const cyclic: Record<string, unknown> = { name: "test" };
    cyclic.self = cyclic;
    assertSome(coerceErrorText(cyclic), '{"name":"test"}');
  });

  it("renders a Redacted value as <redacted>, never its secret", () => {
    assertSome(coerceErrorText({ token: Redacted.make("hunter2") }), '{"token":"<redacted>"}');
  });

  it("marks a value that cannot be printed at all", () => {
    const value = Object.create(null);
    value.toJSON = () => {
      throw new TypeError("no");
    };
    assertSome(coerceErrorText(value), "<unserializable>");
  });

  it("reads a throwing getter as unreadable", () => {
    assertSome(
      readField(() => {
        throw new TypeError("getter");
      }),
      UNREADABLE_FIELD
    );
  });

  it("formats a frame with every field missing", () => {
    assert.strictEqual(formatStackFrame({}), "at <anonymous> (<unknown>:0:0)");
  });

  it("builds a detail with the stack from the raw stack when there are no frames", () => {
    const detail = errorDetail({ message: "m", stack: "Error: m\n    at x (/a.ts:1:1)" });
    assertSome(detail.stack, "Error: m\n    at x (/a.ts:1:1)");
    assertNone(detail.diff);
  });
});
