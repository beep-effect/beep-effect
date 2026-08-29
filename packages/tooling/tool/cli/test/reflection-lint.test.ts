import { lintCommand } from "@beep/repo-cli";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Unknown } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, FileSystem, Layer, Path, Runtime } from "effect";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { withTempWorkingDirectory } from "./support/CommandTest.ts";

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = Unknown.encodeUnknownSyncFromJsonString;

const expectReportedFailure = (exit: Exit.Exit<unknown, unknown>) => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(1);
  }
};

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);

const writeCompletedGoal = Effect.fn("writeCompletedGoal")(function* (slug: string, reflectionRequired?: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join("goals", slug, "ops"), { recursive: true });
  yield* fs.writeFileString(
    path.join("goals", slug, "ops", "manifest.json"),
    `${encodeJson({
      schemaVersion: "initiative-manifest/v1",
      initiative: { id: slug, title: slug, status: "completed-retained" },
      ...(reflectionRequired === undefined ? {} : { reflectionRequired }),
    })}\n`
  );
});

const VALID_REFLECTION = `---
goal: example
agent: claude
date: 2026-06-09
trigger: closeout
confidence: high
findings:
  - category: tooling-friction
    confidence: medium
    instruction: Do the thing.
    explanation: Because of the evidence.
todos:
  - Codify the thing.
---

# Reflection
`;

const VALID_REFLECTION_CRLF = Str.replaceAll("\n", "\r\n")(VALID_REFLECTION);

const writeActiveGoal = Effect.fn("writeActiveGoal")(function* (slug: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join("goals", slug, "ops"), { recursive: true });
  yield* fs.writeFileString(
    path.join("goals", slug, "ops", "manifest.json"),
    `${encodeJson({
      schemaVersion: "initiative-manifest/v1",
      initiative: { id: slug, title: slug, status: "active" },
    })}\n`
  );
});

const writeReflection = Effect.fn("writeReflection")(function* (slug: string, file: string, body: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join("goals", slug, "history", "reflections"), { recursive: true });
  yield* fs.writeFileString(path.join("goals", slug, "history", "reflections", file), body);
});

type ReflectionLintFixture = {
  readonly reflectionRequired?: boolean;
  readonly reflection?: {
    readonly body: string;
    readonly file: string;
  };
};

const runReflectionLintFixture = Effect.fn("runReflectionLintFixture")(function* (fixture: ReflectionLintFixture = {}) {
  yield* writeCompletedGoal("example", fixture.reflectionRequired);
  if (fixture.reflection !== undefined) {
    yield* writeReflection("example", fixture.reflection.file, fixture.reflection.body);
  }
  return yield* Effect.exit(runLintCommand(["reflection-artifacts"]));
});

const expectReflectionLintSuccess = Effect.fn("expectReflectionLintSuccess")(function* (
  fixture: ReflectionLintFixture
) {
  const exit = yield* runReflectionLintFixture(fixture);
  expect(Exit.isSuccess(exit)).toBe(true);
});

describe("reflection-artifacts lint command", { concurrent: false }, () => {
  it(
    "blocks a reflectionRequired completed goal with no reflection artifact",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const exit = yield* runReflectionLintFixture();
            expectReportedFailure(exit);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "passes when a schema-valid reflection artifact is present",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          expectReflectionLintSuccess({
            reflection: { body: VALID_REFLECTION, file: "2026-06-09-claude.md" },
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "accepts CRLF-delimited reflection frontmatter",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          expectReflectionLintSuccess({
            reflection: { body: VALID_REFLECTION_CRLF, file: "2026-06-09-claude.md" },
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "blocks when a reflection artifact has invalid frontmatter",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const exit = yield* runReflectionLintFixture({
              reflection: { body: "# no frontmatter here\n", file: "2026-06-09-claude.md" },
            });
            expectReportedFailure(exit);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "blocks completed goals when reflectionRequired is absent and no reflection artifact exists",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const exit = yield* runReflectionLintFixture({});
            expectReportedFailure(exit);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "treats an explicit reflectionRequired opt-out as a non-blocking advisory",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(expectReflectionLintSuccess({ reflectionRequired: false })).pipe(
          provideScopedLayer(testLayer)
        )
      ),
    20_000
  );

  it(
    "passes when a completed goal without reflectionRequired has a valid reflection",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          expectReflectionLintSuccess({
            reflectionRequired: false,
            reflection: { body: VALID_REFLECTION, file: "2026-06-09-claude.md" },
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  // The PR #365 YAML traps hid in a completed-only gap: an invalid reflection
  // in an ACTIVE packet passed this lint while goals doctor failed it. The
  // frontmatter gate now covers every packet.
  it(
    "blocks an active goal whose reflection file has no frontmatter block",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeActiveGoal("in-flight");
            yield* writeReflection("in-flight", "2026-08-17-claude.md", "# no frontmatter here\n");
            const exit = yield* Effect.exit(runLintCommand(["reflection-artifacts"]));
            expectReportedFailure(exit);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  // Present-but-invalid frontmatter is the decode-failure path — this is the
  // literal receipt-10 trap: a colon-space inside an unquoted plain scalar
  // turns the explanation into a YAML mapping error.
  it(
    "blocks an active goal whose present frontmatter does not decode",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeActiveGoal("in-flight");
            yield* writeReflection(
              "in-flight",
              "2026-08-17-claude.md",
              Str.replace(
                "explanation: Because of the evidence.",
                'explanation: the template emitted "icon": [] here.'
              )(VALID_REFLECTION)
            );
            const exit = yield* Effect.exit(runLintCommand(["reflection-artifacts"]));
            expectReportedFailure(exit);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "does not apply the closeout-presence gate to active goals",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeActiveGoal("in-flight");
            yield* writeReflection("in-flight", "2026-08-17-claude.md", VALID_REFLECTION);
            yield* writeActiveGoal("no-reflections-yet");
            const exit = yield* Effect.exit(runLintCommand(["reflection-artifacts"]));
            expect(Exit.isSuccess(exit)).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );
});
