import { goalsCommand } from "@beep/repo-cli/test/Goals";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Ref } from "effect";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);
const absoluteExplorationPath = "/etc/passwd";

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

describe("goals doctor provenance path security", () => {
  it(
    "reports an absolute exploration path as invalid without probing it",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectFile("bun.lock", "");
            yield* writeProjectFile(
              "goals/demo/ops/manifest.json",
              `${encodeJson({
                schemaVersion: "initiative-manifest/v2",
                initiative: { id: "demo", title: "demo", status: "paused" },
                lifecycle: "paused",
                completionGate: {
                  operator: "yeet",
                  requiresPullRequest: true,
                  requiresMergeable: true,
                  statement: "Ship via yeet.",
                  grandfathered: false,
                },
                provenance: { exploration: absoluteExplorationPath },
              })}\n`
            );
            yield* writeProjectFile("goals/demo/README.md", "# demo\n\n## Status\n\nLifecycle: `paused`\n");
            yield* writeProjectFile(
              "goals/goals-doctor.baseline.jsonc",
              `${encodeJson({ schemaVersion: "goals-doctor-baseline/v1", findings: [] })}\n`
            );

            const fs = yield* FileSystem.FileSystem;
            const unsafeProbeCount = yield* Ref.make(0);
            const instrumentedFileSystem: FileSystem.FileSystem = {
              ...fs,
              exists: (target) =>
                target === absoluteExplorationPath
                  ? Ref.update(unsafeProbeCount, (count) => count + 1).pipe(Effect.andThen(fs.exists(target)))
                  : fs.exists(target),
            };

            yield* runGoalsCommand(["doctor"]).pipe(
              Effect.provideService(FileSystem.FileSystem, instrumentedFileSystem)
            );

            expect(yield* Ref.get(unsafeProbeCount)).toBe(0);
            expect((yield* TestConsole.errorLines).join("\n")).toContain(
              `provenance.exploration "${absoluteExplorationPath}" is an invalid path`
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );
});
