import {
  detectCodexEnvironment,
  detectPrProvenanceFromPaths,
  findRecentClaudeSession,
  mungeClaudeProjectPath,
  PrProvenance,
  PrProvenanceBranch,
  PublicPrProvenance,
  renderPrProvenance,
  resumeCommandFor,
  tokenizeHomePath,
} from "@beep/repo-cli/test/Yeet";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Duration, Effect, FileSystem, Layer, Path, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

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
  it("round-trips schema-derived public provenance values", () => {
    const encode = S.encodeResult(PublicPrProvenance);
    const decode = S.decodeResult(PublicPrProvenance);

    fc.assert(
      fc.property(S.toArbitrary(PublicPrProvenance)(fc), (value) => {
        const encoded = encode(value);
        if (Result.isFailure(encoded)) {
          return assert.fail("Expected schema-derived public provenance to encode");
        }
        const decoded = decode(encoded.success);
        if (Result.isFailure(decoded)) {
          return assert.fail("Expected encoded public provenance to decode");
        }
        assert.deepStrictEqual(decoded.success, value);
      }),
      fcRuns(32)
    );
  });

  it("accepts Git-valid hostile branches and rejects invalid ref names", () => {
    const isBranch = S.is(PrProvenanceBranch);

    expect(isBranch("feat/evil`payload-->still-branch")).toBe(true);
    expect(isBranch("feat/a]b")).toBe(true);
    for (const invalid of [
      "",
      "-option",
      "branch with spaces",
      "feat/a[b",
      "feature\\windows",
      "feature//double",
      "feature/../escape",
      "feature/.hidden",
      "feature/locked.lock",
      "feature/trailing.",
      "feature/@{upstream}",
      "@",
    ]) {
      expect(isBranch(invalid), invalid).toBe(false);
    }
  });

  it("delegates Claude project naming to the canonical slash converter", () => {
    expect(mungeClaudeProjectPath("/home/operator/beep.effect\\.claude/worktrees/end.game")).toBe(
      "-home-operator-beep.effect-.claude-worktrees-end.game"
    );
  });

  it("tokenizes only paths at or below the configured home directory", () => {
    expect(tokenizeHomePath("/home/operator", "/home/operator/YeeBois/beep-effect")).toBe("~/YeeBois/beep-effect");
    expect(tokenizeHomePath("/home/operator", "/home/operator-other/beep-effect")).toBe(
      "/home/operator-other/beep-effect"
    );
    expect(tokenizeHomePath("/home/operator", "/workspace/beep-effect")).toBe("/workspace/beep-effect");
  });

  it.effect("detects split Codex markers and reads CODEX_THREAD_ID by its exact environment key", () =>
    Effect.gen(function* () {
      expect(yield* detectCodexEnvironment()).toStrictEqual([true, O.some("thread-123")]);
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: { CODEX_HOME: "/tmp/codex", CODEX_THREAD_ID: "thread-123" } })
      )
    )
  );

  it.effect("classifies Codex before searching a newer Claude transcript", () =>
    withTempDirectory((home) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const clonePath = "/workspace/beep-effect";
        const checkoutPath = "/workspace/beep-effect/.claude/worktrees/endgame";
        const transcriptDirectory = path.join(home, ".claude", "projects", mungeClaudeProjectPath(checkoutPath));

        yield* fs.makeDirectory(transcriptDirectory, { recursive: true });
        yield* fs.writeFileString(path.join(transcriptDirectory, "another-session.jsonl"), "{}\n");

        const provenance = yield* detectPrProvenanceFromPaths(
          clonePath,
          checkoutPath,
          O.some(checkoutPath),
          "feat/yeet-pr-provenance"
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: { CODEX_THREAD_ID: "thread-123", HOME: home } })
          )
        );

        expect(provenance.harness).toBe("codex");
        expect(provenance.clonePath).toBe(clonePath);
        expect(provenance.worktreePath).toStrictEqual(O.some(checkoutPath));
        expect(provenance.sessionId).toStrictEqual(O.some("thread-123"));
        expect(provenance.resumeCommand).toBe(
          "cd '/workspace/beep-effect/.claude/worktrees/endgame' &&\n  codex resume 'thread-123'"
        );
      })
    )
  );

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

  it.effect("rejects far-future transcripts in favor of a valid recent candidate", () =>
    withTempDirectory((projectsRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const clonePath = "/workspace/beep-effect";
        const directory = path.join(projectsRoot, mungeClaudeProjectPath(clonePath));
        const recentPath = path.join(directory, "recent-session.jsonl");
        const futurePath = path.join(directory, "future-session.jsonl");
        const nowMillis = 2_000_000_000_000;

        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.writeFileString(recentPath, "{}\n");
        yield* fs.writeFileString(futurePath, "{}\n");
        const recentSeconds = (nowMillis - 1_000) / 1_000;
        const futureSeconds = (nowMillis + Duration.toMillis(Duration.hours(1))) / 1_000;
        yield* fs.utimes(recentPath, recentSeconds, recentSeconds);
        yield* fs.utimes(futurePath, futureSeconds, futureSeconds);

        expect(yield* findRecentClaudeSession(projectsRoot, [clonePath], nowMillis)).toStrictEqual(
          O.some([clonePath, "recent-session"])
        );
        yield* fs.remove(recentPath);
        expect(yield* findRecentClaudeSession(projectsRoot, [clonePath], nowMillis)).toStrictEqual(O.none());
      })
    )
  );

  it("builds each harness resume command", () => {
    expect(resumeCommandFor("claude-code", "/workspace/clone", O.some("session-123"))).toBe(
      "cd '/workspace/clone' &&\n  claude --resume 'session-123'"
    );
    expect(resumeCommandFor("codex", "/workspace/worktree", O.some("thread-123"))).toBe(
      "cd '/workspace/worktree' &&\n  codex resume 'thread-123'"
    );
    expect(resumeCommandFor("codex", "/workspace/worktree", O.none())).toBe(
      "cd '/workspace/worktree' &&\n  codex resume --last"
    );
    expect(resumeCommandFor("unknown", "/workspace/clone", O.none())).toBe(
      "cd '/workspace/clone' &&\n  claude --resume"
    );
  });

  it("wraps only the command separator when the checkout path contains ampersands", () => {
    expect(resumeCommandFor("codex", "/workspace/a && b", O.some("thread-123"))).toBe(
      "cd '/workspace/a && b' &&\n  codex resume 'thread-123'"
    );
  });

  it("leaves the tilde expandable while quoting the home-relative remainder", () => {
    expect(resumeCommandFor("codex", "~/YeeBois/a && b", O.some("thread-123"))).toBe(
      "cd ~/'YeeBois/a && b' &&\n  codex resume 'thread-123'"
    );
  });

  it.effect("keeps detected resume details local and omits them from public provenance", () =>
    Effect.gen(function* () {
      const clonePath = "/home/operator/YeeBois/projects/beep-effect3";
      const checkoutPath = `${clonePath}/.claude/worktrees/footer-redact`;
      const provenance = yield* detectPrProvenanceFromPaths(
        clonePath,
        checkoutPath,
        O.some(checkoutPath),
        "fix/yeet-footer-redact-home"
      );
      const footer = renderPrProvenance(provenance);

      assert.strictEqual(provenance.clonePath, "~/YeeBois/projects/beep-effect3");
      assert.deepStrictEqual(
        provenance.worktreePath,
        O.some("~/YeeBois/projects/beep-effect3/.claude/worktrees/footer-redact")
      );
      assert.strictEqual(
        provenance.resumeCommand,
        "cd ~/'YeeBois/projects/beep-effect3/.claude/worktrees/footer-redact' &&\n  codex resume 'thread-123'"
      );
      assert.isFalse(Str.includes("/home/operator")(footer));
      assert.isFalse(Str.includes("~/YeeBois/projects/beep-effect3")(footer));
      assert.isFalse(Str.includes("thread-123")(footer));
      assert.isFalse(Str.includes("codex resume")(footer));

      const encoded = pipe(
        footer,
        Str.split("<!-- yeet-provenance\n"),
        A.get(1),
        O.flatMap((tail) => pipe(tail, Str.split("\n-->"), A.head)),
        O.getOrThrow
      );
      assert.deepStrictEqual(
        yield* S.decodeEffect(S.fromJsonString(PublicPrProvenance))(encoded),
        PublicPrProvenance.make({
          schemaVersion: 1,
          branch: "fix/yeet-footer-redact-home",
          harness: "codex",
        })
      );
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: { CODEX_THREAD_ID: "thread-123", HOME: "/home/operator" } })
      ),
      provideScopedLayer(PlatformLayer)
    )
  );

  it.effect("keeps absolute paths when HOME is unset", () =>
    Effect.gen(function* () {
      const clonePath = "/home/operator/YeeBois/projects/beep-effect3";
      const checkoutPath = `${clonePath}/.claude/worktrees/footer-redact`;
      const provenance = yield* detectPrProvenanceFromPaths(
        clonePath,
        checkoutPath,
        O.some(checkoutPath),
        "fix/yeet-footer-redact-home"
      );

      assert.strictEqual(provenance.clonePath, clonePath);
      assert.deepStrictEqual(provenance.worktreePath, O.some(checkoutPath));
      assert.strictEqual(provenance.resumeCommand, `cd '${checkoutPath}' &&\n  codex resume 'thread-123'`);

      const footer = renderPrProvenance(provenance);
      assert.isFalse(Str.includes(clonePath)(footer));
      assert.isFalse(Str.includes(checkoutPath)(footer));
      assert.isFalse(Str.includes("thread-123")(footer));
      assert.isFalse(Str.includes("codex resume")(footer));
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: { CODEX_THREAD_ID: "thread-123" } })
      ),
      provideScopedLayer(PlatformLayer)
    )
  );

  it.effect("renders public human and machine provenance without resumable identity", () =>
    Effect.gen(function* () {
      const provenance = PrProvenance.make({
        branch: "feat/yeet-pr-provenance",
        clonePath: "~/workspace/beep-effect",
        harness: "claude-code",
        resumeCommand: resumeCommandFor("claude-code", "~/workspace/beep-effect", O.some("session-123")),
        sessionId: O.some("session-123"),
        worktreePath: O.some("~/workspace/beep-effect/.claude/worktrees/endgame"),
      });
      const footer = renderPrProvenance(provenance);

      assert.isTrue(Str.includes("---\n\n## Provenance")(footer));
      assert.isTrue(Str.includes("- Branch: <code>feat/yeet-pr-provenance</code>")(footer));
      assert.isTrue(Str.includes("- Harness: `claude-code`")(footer));
      assert.isFalse(Str.includes("~/workspace/beep-effect")(footer));
      assert.isFalse(Str.includes("session-123")(footer));
      assert.isFalse(Str.includes("claude --resume")(footer));

      const encoded = pipe(
        footer,
        Str.split("<!-- yeet-provenance\n"),
        A.get(1),
        O.flatMap((tail) => pipe(tail, Str.split("\n-->"), A.head)),
        O.getOrThrow
      );
      assert.deepStrictEqual(
        yield* S.decodeEffect(S.fromJsonString(PublicPrProvenance))(encoded),
        PublicPrProvenance.make({
          schemaVersion: 1,
          branch: "feat/yeet-pr-provenance",
          harness: "claude-code",
        })
      );
      assert.isTrue(
        pipe(
          Str.split("\n")(footer),
          A.every((line) => Str.length(line) < 100)
        )
      );
    })
  );

  it.effect("escapes Git-valid branch names in both public framing contexts", () =>
    Effect.gen(function* () {
      const branch = "feat/evil`payload-->still-branch";
      const footer = renderPrProvenance(
        PrProvenance.make({
          branch,
          clonePath: "/repo",
          harness: "unknown",
          resumeCommand: "cd '/repo' &&\n  claude --resume",
          sessionId: O.none(),
          worktreePath: O.none(),
        })
      );
      const encoded = pipe(
        footer,
        Str.split("<!-- yeet-provenance\n"),
        A.get(1),
        O.flatMap((tail) => pipe(tail, Str.split("\n-->"), A.head)),
        O.getOrThrow
      );

      assert.isTrue(Str.includes("<code>feat/evil&#96;payload--&gt;still-branch</code>")(footer));
      assert.strictEqual(A.length(Str.split("-->")(footer)), 2);
      assert.isTrue(Str.includes("\\u003e")(encoded));
      assert.deepStrictEqual(
        yield* S.decodeEffect(S.fromJsonString(PublicPrProvenance))(encoded),
        PublicPrProvenance.make({ schemaVersion: 1, branch, harness: "unknown" })
      );
    })
  );
});
