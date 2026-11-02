import { Git, GitCommandError, NotARepositoryError, UnknownRefError } from "@beep/git/Git";
import { stageGeneratedFiles } from "@beep/repo-cli/test/Cli";
import { expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";

const paths = ["standards/schema-catalog/@beep/fixture.generated.jsonc"];
const locked = GitCommandError.make({
  kind: "failed",
  args: ["add", "--", ...paths],
  cwd: "/repo",
  exitCode: 128,
  stderr: "fatal: Unable to create '/repo/.git/index.lock': File exists.",
});

it.effect("does not request git staging when a catalog changed no files", () =>
  Effect.gen(function* () {
    const add = vi.fn(() => Effect.void);
    yield* stageGeneratedFiles("/repo", []).pipe(Effect.provideService(Git, Git.makeTest({ add })));
    expect(add).not.toHaveBeenCalled();
  })
);

it.effect("retries an index lock conflict and stages the original paths once it clears", () =>
  Effect.gen(function* () {
    const attempts = yield* Ref.make(0);
    const add = vi.fn(() =>
      Effect.gen(function* () {
        const attempt = yield* Ref.updateAndGet(attempts, (count) => count + 1);
        if (attempt < 3) return yield* locked;
      })
    );
    yield* stageGeneratedFiles("/repo", paths).pipe(
      Effect.provideService(Git, Git.makeTest({ add })),
      TestClock.withLive
    );
    expect(yield* Ref.get(attempts)).toBe(3);
    expect(add).toHaveBeenCalledWith("/repo", paths);
  })
);

for (const { name, error } of [
  {
    name: "an ordinary git failure",
    error: GitCommandError.make({
      kind: "failed",
      args: ["add"],
      cwd: "/repo",
      exitCode: 128,
      stderr: "permission denied",
    }),
  },
  {
    name: "a pre-spawn refusal even when its text mentions the lock",
    error: GitCommandError.make({
      kind: "refused",
      args: ["add"],
      cwd: "/repo",
      stderr: "index.lock",
      detail: "refused",
    }),
  },
  { name: "a non-repository answer", error: NotARepositoryError.make({ cwd: "/repo" }) },
  {
    name: "an unknown ref even when the ref mentions the lock",
    error: UnknownRefError.make({ cwd: "/repo", ref: "index.lock" }),
  },
]) {
  it.effect(`preserves ${name} without retrying it`, () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0);
      const add = () => Ref.update(attempts, (count) => count + 1).pipe(Effect.andThen(Effect.fail(error)));
      const failure = yield* stageGeneratedFiles("/repo", paths).pipe(
        Effect.provideService(Git, Git.makeTest({ add })),
        Effect.flip
      );
      expect(failure).toBe(error);
      expect(yield* Ref.get(attempts)).toBe(1);
    })
  );
}
