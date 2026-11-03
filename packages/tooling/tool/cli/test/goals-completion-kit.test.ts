import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { goalCompletionIo, readGoalCompletion } from "@beep/repo-cli/commands/Goals/CompletionEvidence";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";
import { completionFetch } from "./support/CompletionFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const spawner = () =>
  ScriptedSpawner.make((command, args) =>
    command === "gh" && args[0] === "auth"
      ? { stdout: "fixture-token" }
      : { stdout: "git@github.com:example/repo.git\n" }
  );

it.layer(NodeTestLayer, { timeout: "30 seconds" })("completion kit", (it) => {
  it.effect("completion typed reads follow every page and preserve filter, ref and parent parameters", () =>
    Effect.gen(function* () {
      const transport = completionFetch((url) => {
        const page2 = url.searchParams.get("page") === "2";
        const at = "2026-11-03T00:00:00Z";
        const row = {
          id: page2 ? 2 : 1,
          name: "Check",
          status: "completed",
          conclusion: "success",
          head_sha: "head",
          started_at: at,
          completed_at: at,
          event: "ready_for_review",
          created_at: at,
          version_id: page2 ? 2 : 1,
          updated_at: at,
          ref: "refs/heads/main",
          after_sha: "merge",
          source_type: "Repository",
        };
        return {
          body: Str.endsWith("/check-runs")(url.pathname)
            ? { total_count: 2, check_runs: [row] }
            : Str.endsWith("/check-suites")(url.pathname)
              ? { total_count: 2, check_suites: [row] }
              : [row],
          next: !page2,
        };
      });
      const io = yield* goalCompletionIo();
      const observed = yield* Effect.all([
        io.checkRuns(".", "head"),
        io.timeline(".", 7),
        io.checkSuites(".", "head"),
        io.rulesetHistory(".", 42),
        io.ruleSuites(".", "refs/heads/main"),
        io.rulesets("."),
      ]).pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)));
      for (const result of observed) {
        expect(result).toHaveLength(1);
      }
      expect(observed[0]).toMatchObject([{ check_runs: [{ id: 1 }, { id: 2 }] }]);
      expect(observed[2]).toMatchObject([
        { check_suites: [{ created_at: expect.anything() }, { created_at: expect.anything() }] },
      ]);
      expect(transport.calls.length).toBe(12);
      expect(
        A.every(
          A.filter(transport.calls, (url) => Str.endsWith("/check-runs")(url.pathname)),
          (url) => url.searchParams.get("filter") === "all"
        )
      ).toBe(true);
      expect(A.some(transport.calls, (url) => url.searchParams.get("includes_parents") === "true")).toBe(true);
      expect(
        A.some(
          transport.calls,
          (url) => url.searchParams.get("ref") === "refs/heads/main" && url.searchParams.get("time_period") === "month"
        )
      ).toBe(true);
    }).pipe(provideSpawner(spawner()))
  );

  it.effect("completion commit, ruleset version and rule suite reads decode their typed observations", () =>
    Effect.gen(function* () {
      const commit = { sha: "merge", parents: [{ sha: "parent" }], commit: { tree: { sha: "tree" } } };
      const version = {
        state: {
          enforcement: "active",
          target: "branch",
          conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
          rules: [],
        },
      };
      const suite = {
        id: 7,
        ref: "refs/heads/main",
        after_sha: "merge",
        pushed_at: "2026-11-03T00:00:00Z",
        result: "pass",
        rule_evaluations: [],
      };
      const transport = completionFetch((url) => ({
        body: Str.includes("/commits/")(url.pathname)
          ? commit
          : Str.includes("/history/")(url.pathname)
            ? version
            : suite,
      }));
      const io = yield* goalCompletionIo();
      const values = yield* Effect.all([
        io.commit(".", "merge"),
        io.rulesetVersion(".", 42, 3),
        io.ruleSuite(".", 7),
      ]).pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)));
      expect(values).toEqual([commit, version, { ...suite, pushed_at: DateTime.makeUnsafe(suite.pushed_at) }]);
      expect(A.map(transport.calls, (url) => url.pathname)).toEqual([
        "/repos/example/repo/commits/merge",
        "/repos/example/repo/rulesets/42/history/3",
        "/repos/example/repo/rulesets/rule-suites/7",
      ]);
    }).pipe(provideSpawner(spawner()))
  );

  it.effect("completion rejects invalid paginated observations and failed git reads", () =>
    Effect.gen(function* () {
      const io = yield* goalCompletionIo();
      const transport = completionFetch(() => ({ body: { check_runs: [{}], total_count: 1 } }));
      const malformed = yield* io
        .checkRuns(".", "head")
        .pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)), Effect.flip);
      expect(malformed.message).toBe("Invalid goal completion GitHub payload");
      const failed = yield* Effect.flatMap(goalCompletionIo(), (port) =>
        port.manifestAtHead(".", "head", "manifest.json")
      ).pipe(provideSpawner(ScriptedSpawner.make(() => ({ exit: 128, stderr: "fatal" }))), Effect.flip);
      expect(failed.message).toBe("Goal completion git read failed");
    }).pipe(provideSpawner(spawner()))
  );

  it.effect("completion refused reads and malformed payloads stay typed failures", () =>
    Effect.gen(function* () {
      const refused = completionFetch(() => ({ status: 403, body: { message: "Forbidden" } }));
      const invalid = completionFetch(() => ({ body: { malformed: true } }));
      for (const transport of [refused, invalid]) {
        const error = yield* readGoalCompletion(".", (io, root) => io.pullRequest(root, 7)).pipe(
          Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
          provideSpawner(spawner()),
          Effect.flip
        );
        expect(error._tag).toBe("YeetCommandError");
      }
    })
  );

  it.effect("completion contents returns absence for 404, refuses directories and decodes regular files", () =>
    Effect.gen(function* () {
      const io = yield* goalCompletionIo();
      for (const { body, status, result } of [
        { body: { message: "Not Found" }, status: 404, result: "none" },
        { body: [], status: 200, result: "failure" },
        { body: { type: "file", encoding: "base64", content: "bWFuaWZlc3Q=" }, status: 200, result: "manifest" },
      ]) {
        const transport = completionFetch(() => ({ body, status }));
        const value = yield* io.hostedManifest(".", "head", "goals/demo/ops/manifest.json").pipe(
          Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
          provideSpawner(spawner()),
          Effect.map(O.getOrElse(() => "none")),
          Effect.orElseSucceed(() => "failure")
        );
        expect(value).toBe(result);
      }
    }).pipe(provideSpawner(spawner()))
  );
});
