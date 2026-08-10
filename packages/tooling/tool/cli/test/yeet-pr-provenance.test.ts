import {
  findRecentClaudeSession,
  mungeClaudeProjectPath,
  PrProvenance,
  renderPrProvenance,
  resumeCommandFor,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

describe("Yeet PR provenance", () => {
  it("munges slashes and dots like Claude Code project directories", () => {
    expect(mungeClaudeProjectPath("/home/operator/beep-effect/.claude/worktrees/end.game")).toBe(
      "-home-operator-beep-effect--claude-worktrees-end-game"
    );
  });

  it.effect("selects the newest candidate transcript and rejects stale transcripts", () =>
    withTempDirectory((projectsRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const clonePath = "/workspace/beep-effect";
        const worktreePath = "/workspace/beep-effect/.claude/worktrees/feature";
        const cloneDirectory = path.join(projectsRoot, mungeClaudeProjectPath(clonePath));
        const worktreeDirectory = path.join(projectsRoot, mungeClaudeProjectPath(worktreePath));
        const olderPath = path.join(worktreeDirectory, "older-session.jsonl");
        const newestPath = path.join(cloneDirectory, "newest-session.jsonl");
        const nowMillis = 2_000_000_000_000;

        yield* fs.makeDirectory(cloneDirectory, { recursive: true });
        yield* fs.makeDirectory(worktreeDirectory, { recursive: true });
        yield* fs.writeFileString(olderPath, "{}\n");
        yield* fs.writeFileString(newestPath, "{}\n");
        const olderSeconds = (nowMillis - 10_000) / 1_000;
        const newestSeconds = (nowMillis - 1_000) / 1_000;
        yield* fs.utimes(olderPath, olderSeconds, olderSeconds);
        yield* fs.utimes(newestPath, newestSeconds, newestSeconds);

        expect(yield* findRecentClaudeSession(projectsRoot, [worktreePath, clonePath], nowMillis)).toStrictEqual(
          O.some([clonePath, "newest-session"])
        );
        expect(
          yield* findRecentClaudeSession(
            projectsRoot,
            [worktreePath, clonePath],
            nowMillis + Duration.toMillis(Duration.hours(7))
          )
        ).toStrictEqual(O.none());
      })
    )
  );

  it("builds each harness resume command", () => {
    expect(resumeCommandFor("claude-code", "/workspace/clone", O.some("session-123"))).toBe(
      "cd '/workspace/clone' && claude --resume 'session-123'"
    );
    expect(resumeCommandFor("codex", "/workspace/clone", O.none())).toBe(
      "cd '/workspace/clone' && codex resume --last"
    );
    expect(resumeCommandFor("unknown", "/workspace/clone", O.none())).toBe("cd '/workspace/clone' && claude --resume");
  });

  it("renders a trailing footer with linked-worktree provenance and a fenced command", () => {
    const footer = renderPrProvenance(
      PrProvenance.make({
        branch: "feat/yeet-pr-provenance",
        clonePath: "/workspace/beep-effect",
        harness: "claude-code",
        resumeCommand: resumeCommandFor("claude-code", "/workspace/beep-effect", O.some("session-123")),
        sessionId: O.some("session-123"),
        worktreePath: O.some("/workspace/beep-effect/.claude/worktrees/endgame"),
      })
    );

    expect(footer).toContain("---\n\n## Provenance");
    expect(footer).toContain("- Clone: `/workspace/beep-effect`");
    expect(footer).toContain("- Worktree: `/workspace/beep-effect/.claude/worktrees/endgame`");
    expect(footer).toContain("- Branch: `feat/yeet-pr-provenance`");
    expect(footer).toContain("- Harness: `claude-code`");
    expect(footer).toContain("```sh\ncd '/workspace/beep-effect' &&\n  claude --resume 'session-123'\n```");
    expect(
      pipe(
        Str.split("\n")(footer),
        A.every((line) => Str.length(line) < 100)
      )
    ).toBe(true);
  });
});
