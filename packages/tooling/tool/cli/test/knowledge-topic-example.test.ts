import { collectMarkdownFences } from "@beep/repo-cli/commands/Laws";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Str from "effect/String";

it.layer(BunServices.layer)("TopicName documentation contract", (it) => {
  A.forEach(
    [
      "standards/effect-first-development.md",
      ".claude/skills/effect-first-development/references/always-never-core.md",
    ],
    (sourcePath) => {
      it.effect(
        `preserves valid segments and rejects empty ones in ${sourcePath}`,
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const markdown = yield* fs.readFileString(path.join(repoRoot, sourcePath));
          const fences = A.filter(collectMarkdownFences(sourcePath, markdown), (fence) =>
            Str.includes("export const TopicName =")(fence.body)
          );
          expect(fences).toHaveLength(1);
          const fence = A.getUnsafe(fences, 0);
          const scratchRoot = path.join(repoRoot, ".beep");
          yield* fs.makeDirectory(scratchRoot, { recursive: true });
          const fixture = yield* fs.makeTempDirectoryScoped({
            directory: scratchRoot,
            prefix: "knowledge-topic-example-",
          });
          const programPath = path.join(fixture, "topic-contract.ts");
          yield* fs.writeFileString(
            programPath,
            A.join(
              [
                fence.body,
                'import { assertTrue, assertFalse } from "@effect/vitest/utils";',
                "const accepts = S.is(TopicName);",
                'assertTrue(accepts("alpha"));',
                'assertTrue(accepts("alpha:beta"));',
                'assertTrue(accepts("alpha:beta:gamma"));',
                'assertFalse(accepts(""));',
                'assertFalse(accepts(":alpha"));',
                'assertFalse(accepts("alpha::beta"));',
                'assertFalse(accepts("alpha:"));',
                'assertFalse(accepts(":"));',
              ],
              "\n"
            )
          );
          const executablePath = yield* fs.realPath(programPath);
          const child = yield* ChildProcess.make("bun", [executablePath], {
            cwd: repoRoot,
            stdin: "ignore",
            stdout: "inherit",
            stderr: "inherit",
          });
          const exitCode = yield* child.exitCode;
          expect(exitCode, `${sourcePath}:${fence.line}`).toBe(0);
        })
      );
    }
  );
});
