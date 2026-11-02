import { GitCommandError, NotARepositoryError, UnknownRefError } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { sweepProbeFromGit } from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

// The CommandProbe adapter (W2b, SPEC D-11): one fold from a kit read or mutation onto the
// `{ exitCode, output, truncated }` view Sweep's planner reads, with the typed answer alongside.
const invocation = GitCommand.status();
const failedRun = (fields: {
  readonly kind: "failed" | "truncated" | "refused";
  readonly exitCode?: number;
  readonly stderr?: string;
}) => GitCommandError.make({ args: ["status", "--porcelain", "-z"], cwd: "/repo", stderr: "", ...fields });

describe("sweepProbeFromGit", () => {
  it.effect("reads a success as exit 0 with the rendered answer trimmed, and keeps the answer", () =>
    Effect.gen(function* () {
      const probe = yield* Effect.succeedSome("feat/x").pipe(
        sweepProbeFromGit(
          invocation,
          O.getOrElse(() => "HEAD")
        )
      );
      expect({ exitCode: probe.exitCode, output: probe.output, truncated: probe.truncated }).toEqual({
        exitCode: 0,
        output: "feat/x",
        truncated: false,
      });
      assertSome(probe.value, O.some("feat/x"));
      const padded = yield* sweepProbeFromGit(Effect.succeed("  /repo \n"), invocation, (root: string) => root);
      expect(padded.output).toBe("/repo");
    })
  );

  it.effect("keeps a failure git reported as its exit code and trimmed stderr", () =>
    Effect.gen(function* () {
      const probe = yield* Effect.fail(
        failedRun({ kind: "failed", exitCode: 1, stderr: "error: not fully merged\n" })
      ).pipe(sweepProbeFromGit(invocation, () => ""));
      expect([probe.exitCode, probe.output, probe.truncated]).toEqual([1, "error: not fully merged", false]);
      assertNone(probe.value);
    })
  );

  it.effect("reads a typed unknown ref or non-repository as git's exit 128 with the kit's message", () =>
    Effect.gen(function* () {
      const outside = yield* Effect.fail(NotARepositoryError.make({ cwd: "/plain" })).pipe(
        sweepProbeFromGit(invocation, () => "")
      );
      expect(outside.exitCode).toBe(128);
      expect(outside.output).toContain("/plain");
      const unknown = yield* Effect.fail(UnknownRefError.make({ cwd: "/repo", ref: "refs/heads/nope" })).pipe(
        sweepProbeFromGit(invocation, () => "")
      );
      expect(unknown.exitCode).toBe(128);
      expect(unknown.output).toContain("refs/heads/nope");
    })
  );

  it.effect("reads a run git never reached as the capture's spawn failure: exit 1, no output", () =>
    Effect.gen(function* () {
      for (const kind of ["failed", "refused"] as const) {
        const probe = yield* Effect.fail(failedRun({ kind, stderr: "spawn failed" })).pipe(
          sweepProbeFromGit(invocation, () => "")
        );
        expect([probe.exitCode, probe.output, probe.truncated]).toEqual([1, "", false]);
      }
    })
  );

  it.effect("reads a run past the kit's output bound as a truncated probe", () =>
    Effect.gen(function* () {
      const probe = yield* Effect.fail(failedRun({ kind: "truncated", exitCode: 0 })).pipe(
        sweepProbeFromGit(invocation, () => "")
      );
      expect(probe.truncated).toBe(true);
      expect(probe.exitCode).not.toBe(0);
      assertNone(probe.value);
    })
  );
});
