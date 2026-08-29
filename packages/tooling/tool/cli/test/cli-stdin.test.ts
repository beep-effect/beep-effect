import { CommandStdinSource, readStdinDocument, StdinDocumentError } from "@beep/repo-cli/test/Cli";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

const MESSAGES = {
  missingFlag: "test command requires --from-stdin.",
  noStdin: "test command --from-stdin received no stdin.",
  readFailurePrefix: "Failed to read the test document from stdin",
};

// Tests always inject the stdin source: a real stdin.text() read blocks until
// the pipe reaches EOF, and test runners hold their workers' stdin open.
const stdinSource = (text: () => Promise<string>, interactive = false) =>
  Effect.provideService(CommandStdinSource, { interactive: () => interactive, text });

describe("StdinDocumentError", () => {
  it("carries the caller's message", () => {
    const error = StdinDocumentError.make({ message: "no stdin" });
    expect(error.message).toBe("no stdin");
    expect(error._tag).toBe("StdinDocumentError");
  });
});

describe("readStdinDocument", () => {
  it.effect("refuses when the --from-stdin flag was not passed", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(readStdinDocument(false, MESSAGES));

      expect(failure.message).toBe(MESSAGES.missingFlag);
    })
  );

  it.effect("refuses when stdin is an interactive terminal", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        readStdinDocument(true, MESSAGES).pipe(stdinSource(() => Promise.resolve(""), true))
      );

      expect(failure.message).toBe(MESSAGES.noStdin);
    })
  );

  it.effect("returns the piped document whole", () =>
    Effect.gen(function* () {
      const text = yield* readStdinDocument(true, MESSAGES).pipe(stdinSource(() => Promise.resolve('{"a":1}\n')));

      expect(text).toBe('{"a":1}\n');
    })
  );

  it.effect("wraps a failed read in the caller's phrasing", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        readStdinDocument(true, MESSAGES).pipe(stdinSource(() => Promise.reject(new Error("pipe burst"))))
      );

      expect(failure.message).toContain(MESSAGES.readFailurePrefix);
      expect(failure.message).toContain("pipe burst");
    })
  );
});
