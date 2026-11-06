import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { RepoRunContext, requestReviewerReviewForTesting, runRepoCommandCapture } from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const sha = Str.repeat(40)("a");
const marker = `<!-- beep-reviewer:request sha=${sha} -->`;
const body = `Requesting beep-reviewer review of this ready PR head.\n\n${marker}`;
const encodeJson = S.encodeUnknownResult(S.fromJsonString(S.Unknown));
const json = (value: unknown) => Result.getOrThrow(encodeJson(value));
const pull = (overrides = {}) => ({
  state: "open",
  created_at: "2026-11-06T10:00:00Z",
  draft: false,
  head: { sha },
  user: { login: "kriegcloud" },
  base: { repo: { full_name: "beep-effect/beep-effect" } },
  ...overrides,
});
const timeline = json([
  [
    { event: "ready_for_review", created_at: "2026-11-06T11:00:00Z" },
    { event: "convert_to_draft", created_at: "2026-11-06T11:30:00Z" },
    { event: "ready_for_review", created_at: "2026-11-06T12:00:00Z" },
  ],
]);
const context = RepoRunContext.make({
  base: "origin/main",
  branch: "codex/probe",
  cwd: "/repo",
  head: "HEAD",
  repoRoot: "/repo",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  originalArgv: [],
  packetDir: ".beep/yeet",
});
const requestStage = (args: ReadonlyArray<string>) =>
  Match.value(args).pipe(
    Match.when(
      (args) => A.contains(args, "POST"),
      () => "post"
    ),
    Match.when(
      (args) => A.contains(args, "user"),
      () => "auth"
    ),
    Match.when(
      (args) => A.some(args, Str.includes("/timeline?")),
      () => "timeline"
    ),
    Match.when(
      (args) => A.contains(args, "--paginate"),
      () => "census"
    ),
    Match.orElse(() => "pull")
  );
const scriptedOutput = (args: ReadonlyArray<string>, comments: unknown) =>
  Match.value(requestStage(args)).pipe(
    Match.when("post", () => "{}"),
    Match.when("auth", () => "kriegcloud"),
    Match.when("timeline", () => timeline),
    Match.when("census", () => json(comments)),
    Match.orElse(() => json(pull()))
  );

const platform = Git.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

it.layer(platform, { timeout: "15 seconds" })("ready reviewer comment route", (it) => {
  const scenarios = [
    { name: "posts on the proven head", comments: [[]], posts: 1 },
    {
      name: "deduplicates a trusted request on a later page",
      comments: [[], [{ body, created_at: "2026-11-06T12:00:01Z", user: { login: "kriegcloud" } }]],
      posts: 0,
    },
    {
      name: "ignores a marker posted before the latest ready transition",
      comments: [[{ body, created_at: "2026-11-06T11:59:59Z", user: { login: "kriegcloud" } }]],
      posts: 1,
    },
    {
      name: "does not trust ambiguous same-second timestamps",
      comments: [[{ body, created_at: "2026-11-06T12:00:00Z", user: { login: "kriegcloud" } }]],
      posts: 1,
    },
    {
      name: "ignores an untrusted marker",
      comments: [[{ body, created_at: "2026-11-06T12:00:01Z", user: { login: "intruder" } }]],
      posts: 1,
    },
    {
      name: "ignores quoted marker text",
      comments: [[{ body: `quoted ${marker}`, created_at: "2026-11-06T12:00:01Z", user: { login: "kriegcloud" } }]],
      posts: 1,
    },
    {
      name: "ignores an older head request",
      comments: [
        [
          {
            body: Str.replace(sha, Str.repeat(40)("b"))(body),
            created_at: "2026-11-06T12:00:01Z",
            user: { login: "kriegcloud" },
          },
        ],
      ],
      posts: 1,
    },
  ];
  for (const scenario of scenarios) {
    it.effect(scenario.name, () =>
      Effect.gen(function* () {
        const runner = ScriptedSpawner.make((command, args) => {
          expect(command).toBe("gh");
          return { stdout: scriptedOutput(args, scenario.comments) };
        });
        const message = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(provideSpawner(runner));
        const seen = A.map(runner.spawns, (spawn) => spawn.args);
        expect(A.filter(seen, (args) => A.contains(args, "POST"))).toHaveLength(scenario.posts);
        expect(A.some(seen, (args) => A.contains(args, "--paginate") && A.contains(args, "--slurp"))).toBe(true);
        expect(message).toContain(scenario.posts === 1 ? "posted" : "already exists");
        if (scenario.posts === 1)
          assertSome(A.last(seen), [
            "api",
            "repos/{owner}/{repo}/issues/42/comments",
            "--method",
            "POST",
            "--field",
            `body=${body}`,
          ]);
      })
    );
  }

  for (const stage of ["pull", "auth", "timeline", "census", "post"]) {
    it.effect(`propagates ${stage} failure without fallback or success`, () =>
      Effect.gen(function* () {
        const runner = ScriptedSpawner.make((command, args) => {
          expect(command).toBe("gh");
          return requestStage(args) === stage ? { stdout: "denied", exit: 1 } : { stdout: scriptedOutput(args, [[]]) };
        });
        const error = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(
          provideSpawner(runner),
          Effect.flip
        );
        expect(error._tag).toBe("YeetCommandError");
        expect(A.length(runner.spawns)).toBe({ pull: 1, auth: 2, timeline: 3, census: 4, post: 6 }[stage]);
      })
    );
  }

  for (const changed of [
    pull({ draft: true }),
    pull({ state: "closed" }),
    pull({ head: { sha: Str.repeat(40)("b") } }),
  ]) {
    it.effect(`refuses a live race ${json(changed)}`, () =>
      Effect.gen(function* () {
        let reads = 0;
        const runner = ScriptedSpawner.make((command, args) => {
          expect(command).toBe("gh");
          expect(A.contains(args, "POST")).toBe(false);
          if (A.contains(args, "user")) return { stdout: "kriegcloud" };
          if (A.some(args, Str.includes("/timeline?"))) return { stdout: timeline };
          if (A.contains(args, "--paginate")) return { stdout: "[[]]" };
          reads += 1;
          return { stdout: json(reads === 1 ? pull() : changed) };
        });
        const error = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(
          provideSpawner(runner),
          Effect.flip
        );
        expect(error.message).toContain("changed before the comment");
      })
    );
  }

  for (const changed of [
    pull({ draft: true }),
    pull({ state: "closed" }),
    pull({ head: { sha: Str.repeat(40)("b") } }),
  ]) {
    it.effect(`refuses initial unsupported live state ${json(changed)}`, () =>
      Effect.gen(function* () {
        const runner = ScriptedSpawner.make((command) => {
          expect(command).toBe("gh");
          return { stdout: json(changed) };
        });
        const error = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(
          provideSpawner(runner),
          Effect.flip
        );
        expect(error.message).toContain("no longer open and ready at the proven head");
        expect(runner.spawns).toHaveLength(1);
        assertSome(A.head(A.map(runner.spawns, (spawn) => spawn.args)), ["api", "repos/{owner}/{repo}/pulls/42"]);
      })
    );
  }

  it.effect("refuses an unsupported authenticated identity without posting or pushing", () =>
    Effect.gen(function* () {
      const runner = ScriptedSpawner.make((command, args) => {
        expect(command).toBe("gh");
        expect(A.contains(args, "POST")).toBe(false);
        return { stdout: A.contains(args, "user") ? "other-user" : json(pull()) };
      });
      const error = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(
        provideSpawner(runner),
        Effect.flip
      );
      expect(error.message).toContain("requires authenticated kriegcloud");
    })
  );

  it.effect("never pushes for an unsupported already-ready author", () =>
    Effect.gen(function* () {
      const runner = ScriptedSpawner.make((command) => {
        expect(command).toBe("gh");
        return { stdout: json(pull({ user: { login: "other-user" } })) };
      });
      const message = yield* requestReviewerReviewForTesting(context, 42, sha, false).pipe(provideSpawner(runner));
      expect(message).toContain("no repeated review-trigger push");
    })
  );

  for (const invalid of ["short", Str.repeat(40)("g"), Str.repeat(64)("a")]) {
    it.effect(`refuses invalid marker head ${invalid}`, () =>
      Effect.gen(function* () {
        const runner = ScriptedSpawner.make(() => {
          expect.fail("invalid head must not reach GitHub");
        });
        const error = yield* requestReviewerReviewForTesting(context, 42, invalid, true).pipe(
          provideSpawner(runner),
          Effect.flip
        );
        expect(error.message).toContain("full 40-hex proven head");
        expect(runner.spawns).toHaveLength(0);
      })
    );
  }

  for (const timelineReply of [
    "[[]]",
    '[[{"event":"ready_for_review"}]]',
    "not json",
    json([
      [
        { event: "ready_for_review", created_at: "2026-11-06T11:00:00Z" },
        { event: "convert_to_draft", created_at: "2026-11-06T11:30:00Z" },
      ],
    ]),
    json([[{ event: "ready_for_review", created_at: "2026-11-06T11:00:00Z" }, { event: "convert_to_draft" }]]),
  ]) {
    it.effect(`refuses unknown ready transition ${timelineReply}`, () =>
      Effect.gen(function* () {
        const runner = ScriptedSpawner.make((command, args) => {
          expect(command).toBe("gh");
          expect(A.contains(args, "POST")).toBe(false);
          return {
            stdout: A.contains(args, "user")
              ? "kriegcloud"
              : A.some(args, Str.includes("/timeline?"))
                ? timelineReply
                : json(pull()),
          };
        });
        const error = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(
          provideSpawner(runner),
          Effect.flip
        );
        expect(error._tag).toBe("YeetCommandError");
        expect(runner.spawns).toHaveLength(3);
      })
    );
  }

  it.effect("routes a known unsupported author to the conservative legacy head guard after a flip", () =>
    Effect.gen(function* () {
      const runner = ScriptedSpawner.make((command) => {
        expect(command).toBe("gh");
        return { stdout: json(pull({ user: { login: "other-author" } })) };
      });
      const message = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(
        provideSpawner(runner),
        Effect.provideService(Git, Git.makeTest({ revParse: () => Effect.succeed("local-other-head") }))
      );
      expect(message).toContain("checkout is at local-other-head");
      expect(message).toContain("git commit --allow-empty --only");
      expect(runner.spawns).toHaveLength(1);
    })
  );

  it.effect("posts once and deduplicates the next invocation at the same head", () =>
    Effect.gen(function* () {
      let posted = false;
      const runner = ScriptedSpawner.make((command, args) => {
        expect(command).toBe("gh");
        if (A.contains(args, "POST")) {
          posted = true;
          return { stdout: "{}" };
        }
        return {
          stdout: scriptedOutput(args, [
            posted ? [{ body, created_at: "2026-11-06T12:00:01Z", user: { login: "kriegcloud" } }] : [],
          ]),
        };
      });
      const first = yield* requestReviewerReviewForTesting(context, 42, sha, true).pipe(provideSpawner(runner));
      const second = yield* requestReviewerReviewForTesting(context, 42, sha, false).pipe(provideSpawner(runner));
      expect(first).toContain("posted");
      expect(second).toContain("already exists");
      expect(A.filter(runner.spawns, (spawn) => A.contains(spawn.args, "POST"))).toHaveLength(1);
    })
  );

  it.effect("preserves real Git HEAD, staged index and unstaged files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const git = Effect.fn("ReviewerCommentTest.git")(function* (cwd: string, args: ReadonlyArray<string>) {
        const result = yield* runRepoCommandCapture("git", args, cwd);
        expect(result.exitCode).toBe(0);
        return result.output;
      });
      const work = yield* fs.makeTempDirectoryScoped({ prefix: "review-comment-control-" });
      yield* git(work, ["init"]);
      yield* git(work, [
        "-c",
        "user.name=Probe",
        "-c",
        "user.email=probe@example.invalid",
        "commit",
        "--allow-empty",
        "-m",
        "init",
      ]);
      const before = yield* git(work, ["rev-parse", "HEAD"]);
      yield* fs.writeFileString(path.join(work, "staged.txt"), "staged\n");
      yield* git(work, ["add", "staged.txt"]);
      yield* fs.writeFileString(path.join(work, "staged.txt"), "unstaged\n");
      const index = yield* git(work, ["diff", "--cached", "--binary"]);
      const dirty = yield* git(work, ["diff", "--binary"]);
      const runner = ScriptedSpawner.make((command, args) => {
        expect(command).toBe("gh");
        return { stdout: scriptedOutput(args, [[]]) };
      });
      yield* requestReviewerReviewForTesting(
        RepoRunContext.make({ ...context, repoRoot: work, cwd: work }),
        42,
        sha,
        true
      ).pipe(provideSpawner(runner));
      const after = yield* git(work, ["rev-parse", "HEAD"]);
      expect(after).toEqual(before);
      const indexAfter = yield* git(work, ["diff", "--cached", "--binary"]);
      expect(indexAfter).toEqual(index);
      const dirtyAfter = yield* git(work, ["diff", "--binary"]);
      expect(dirtyAfter).toEqual(dirty);
      const contentAfter = yield* fs.readFileString(path.join(work, "staged.txt"));
      expect(contentAfter).toBe("unstaged\n");
    })
  );
});
