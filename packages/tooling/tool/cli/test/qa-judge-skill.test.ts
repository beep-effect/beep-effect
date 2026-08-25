import { QaJudgeContract, QaJudgeSkillOptions, runQaJudgeSkill } from "@beep/repo-cli/commands/Qa";
import { renderSkillMarkdown } from "@beep/skill-contract";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { vi } from "vitest";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const expectedMarkdown = Result.getOrThrow(renderSkillMarkdown(QaJudgeContract));

describe("commands/Qa judge-skill", () => {
  it.effect("writes the rendered artifact bytes to the requested path, creating parent directories", () =>
    Effect.acquireUseRelease(
      Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix: "beep-qa-judge-skill-" })),
      Effect.fnUntraced(function* (dir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const target = path.join(dir, "nested", "SKILL.md");

        yield* runQaJudgeSkill(QaJudgeSkillOptions.make({ write: O.some(target) }));

        expect(yield* fs.readFileString(target)).toBe(expectedMarkdown);
      }),
      (dir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Effect.orDie))
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("prints the exact renderer bytes to stdout without a trailing newline", () =>
    Effect.gen(function* () {
      const chunks: Array<string> = [];
      const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        chunks.push(String(chunk));
        return true;
      });

      yield* runQaJudgeSkill(QaJudgeSkillOptions.make({ write: O.none() })).pipe(
        Effect.ensuring(Effect.sync(() => write.mockRestore()))
      );

      expect(A.join(chunks, "")).toBe(expectedMarkdown);
      expect(expectedMarkdown.endsWith("\n")).toBe(false);
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});
