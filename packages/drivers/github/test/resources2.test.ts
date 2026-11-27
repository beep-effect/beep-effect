import { Attestation } from "@beep/github/Attestation";
import { Annotation, CheckRun, CheckRunOutput } from "@beep/github/CheckRun";
import { GitHubError } from "@beep/github/GitHubError";
import { GitHubIssue } from "@beep/github/GitHubIssue";
import { GitHubRelease, ReleaseInfo } from "@beep/github/GitHubRelease";
import { PullRequest, PullRequestInfo, UpsertedPullRequest } from "@beep/github/PullRequest";
import { CommentMarker, PullRequestComment } from "@beep/github/PullRequestComment";
import { PageOptions } from "@beep/github/Rest";
import { WorkflowDispatch } from "@beep/github/WorkflowDispatch";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { constant, pipe } from "effect/Function";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { linkNext } from "./support/fixtures.ts";
import { harness } from "./support/harness.ts";
import type {} from "./support/fixtures.ts";

const JsonCheckOutput = Schema.fromJsonString(
  Schema.Struct({
    conclusion: Schema.optionalKey(Schema.String),
    output: Schema.Struct({ title: Schema.String, summary: Schema.String }),
  })
);
const JsonObject = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const JsonComment = Schema.fromJsonString(Schema.Struct({ body: Schema.String }));
const JsonGraphQL = Schema.fromJsonString(Schema.Struct({ query: Schema.String, variables: Schema.Unknown }));
// decision: utf8-truncation-property-domain
const ScalarValue = Schema.Union([
  Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xd7ff })),
  Schema.Int.check(Schema.isBetween({ minimum: 0xe000, maximum: 0x10ffff })),
]);
const budgetCrossingRunOptions = { arbitrary: { size: 40_000, runs: 50 }, timeout: 30_000 };

describe("CheckRunOutput byte budgeting", () => {
  it("leaves an output that fits alone", () => {
    const output = CheckRunOutput.make({ title: "t", summary: "short" });
    assert.strictEqual(output.truncated().summary, "short");
  });

  it("cuts a summary that exceeds the byte budget", () => {
    const output = CheckRunOutput.make({ title: "t", summary: Str.repeat(70_000)("a") });
    const cut = output.truncated().summary;
    assert.isAtMost(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
    assert.isTrue(Str.endsWith(CheckRunOutput.NOTICE)(cut));
  });

  it("counts BYTES, not characters", () => {
    const summary = Str.repeat(30_000)("🦋");
    assert.isBelow(summary.length, CheckRunOutput.LIMIT_BYTES, "under the limit by characters");
    assert.isAbove(
      Buffer.byteLength(summary, "utf8"),
      CheckRunOutput.LIMIT_BYTES,
      "over it by bytes, which a character-count check would send for a 422"
    );
    const cut = CheckRunOutput.make({ title: "t", summary }).truncated().summary;
    assert.isAtMost(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
  });

  it("leaves no broken code point behind", () => {
    const cut = CheckRunOutput.make({ title: "t", summary: Str.repeat(30_000)("🦋") }).truncated().summary;
    assert.notInclude(Str.slice(0, -CheckRunOutput.NOTICE.length)(cut), "�");
  });

  it("preserves complete replacement characters at the byte boundary", () => {
    const budget = CheckRunOutput.LIMIT_BYTES - Buffer.byteLength(CheckRunOutput.NOTICE, "utf8");
    const prefix = `${Str.repeat(budget - 6)("a")}��`;
    const cut = CheckRunOutput.make({ title: "t", summary: prefix + Str.repeat(100)("b") }).truncated().summary;
    assert.strictEqual(cut, prefix + CheckRunOutput.NOTICE);
    assert.strictEqual(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
  });

  it("removes only an incomplete trailing UTF-8 sequence", () => {
    const budget = CheckRunOutput.LIMIT_BYTES - Buffer.byteLength(CheckRunOutput.NOTICE, "utf8");
    for (const character of ["é", "€", "🦋", "�"]) {
      for (let included = 1; included < Buffer.byteLength(character, "utf8"); included += 1) {
        const prefix = `${Str.repeat(budget - included - 3)("a")}�`;
        const cut = CheckRunOutput.make({ title: "t", summary: prefix + character + Str.repeat(100)("b") }).truncated()
          .summary;
        assert.strictEqual(cut, prefix + CheckRunOutput.NOTICE);
        assert.isAtMost(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
      }
    }
  });

  it("caps text as well as summary", () => {
    const output = CheckRunOutput.make({ title: "t", summary: "s", text: Str.repeat(70_000)("b") });
    assert.isAtMost(Buffer.byteLength(output.truncated().text ?? "", "utf8"), CheckRunOutput.LIMIT_BYTES);
  });

  it("drops annotations past GitHub's per-request cap", () => {
    const annotations = Array.from({ length: 80 }, (_, index) =>
      Annotation.make({ path: `f${index}`, startLine: 1, endLine: 1, level: "warning", message: "m" })
    );
    const output = CheckRunOutput.make({ title: "t", summary: "s", annotations });
    assert.lengthOf(output.truncated().annotations ?? [], CheckRunOutput.MAX_ANNOTATIONS);
  });

  const binaryText = Arbitrary.schema(Schema.Array(ScalarValue).check(Schema.isMaxLength(40_000))).pipe(
    Arbitrary.map((codePoints) =>
      A.join(
        A.map(codePoints, (codePoint) => String.fromCodePoint(codePoint)),
        ""
      )
    )
  );

  it.prop(
    "stays valid UTF-8 within budget for any input",
    [binaryText],
    ([summary]) => {
      const cut = CheckRunOutput.make({ title: "t", summary }).truncated().summary;
      const withinBudget = Buffer.byteLength(cut, "utf8") <= CheckRunOutput.LIMIT_BYTES;
      const noNewDamage =
        pipe(cut, Str.match(/�/g), O.getOrElse(constant([]))).length <=
        pipe(summary, Str.match(/�/g), O.getOrElse(constant([]))).length + 1;
      return withinBudget && noNewDamage;
    },
    budgetCrossingRunOptions
  );
});

describe("CheckRun", () => {
  {
    const { script, base } = harness([{ status: 200, body: { id: 1, name: "n", status: "completed", html_url: "u" } }]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("sends a truncated output on the wire, not the raw one", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(CheckRun, (check) =>
            check.update(1, CheckRunOutput.make({ title: "t", summary: Str.repeat(70_000)("x") }))
          );
          const body = yield* Schema.decodeEffect(JsonCheckOutput)(script.calls[0]?.body ?? "{}");
          assert.isAtMost(Buffer.byteLength(body.output.summary, "utf8"), CheckRunOutput.LIMIT_BYTES);
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("withCheckRun completes the run on success", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(CheckRun, (check) =>
            check.withCheckRun("build", "sha", (id) => Effect.succeed(id * 2))
          );
          assert.strictEqual(value, 14);
          assert.strictEqual(
            (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion,
            "success"
          );
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("withCheckRun completes it as a failure and re-fails", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Effect.flatMap(CheckRun, (check) => check.withCheckRun("build", "sha", () => Effect.fail("boom" as const)))
          );
          assert.strictEqual(error, "boom");
          assert.strictEqual(
            (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion,
            "failure"
          );
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("withCheckRun concludes as cancelled when `use` is interrupted", () =>
        Effect.gen(function* () {
          const openedInsideUse = yield* Latch.make();
          const fiber = yield* Effect.forkChild(
            Effect.flatMap(CheckRun, (check) =>
              check.withCheckRun("build", "sha", () => Effect.flatMap(openedInsideUse.open, () => Effect.never))
            )
          );
          yield* openedInsideUse.await;
          yield* Fiber.interrupt(fiber);

          assert.lengthOf(script.calls, 2, "the run was created, then concluded rather than left in_progress");
          const body = yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}");
          assert.strictEqual(body.conclusion, "cancelled");
          assert.strictEqual(body.status, "completed");
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("an explicit conclusion replaces the success default", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(CheckRun, (check) =>
            check.withCheckRun("build", "sha", (id, conclude) =>
              Effect.gen(function* () {
                yield* conclude("neutral");
                return id * 2;
              })
            )
          );
          assert.strictEqual(value, 14, "`use`'s own value is untouched by concluding");
          assert.lengthOf(script.calls, 2, "concluded exactly once — recorded, then written by the finalizer");
          assert.strictEqual(
            (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion,
            "neutral"
          );
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("an explicit conclusion carries its own output", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(CheckRun, (check) =>
            check.withCheckRun("build", "sha", (_id, conclude) =>
              conclude(
                "action_required",
                CheckRunOutput.make({ title: "Needs a maintainer", summary: "Two advisory warnings." })
              )
            )
          );
          const body = yield* Schema.decodeEffect(JsonCheckOutput)(script.calls[1]?.body ?? "{}");
          assert.strictEqual(body.conclusion, "action_required");
          assert.strictEqual(body.output.title, "Needs a maintainer");
          assert.strictEqual(body.output.summary, "Two advisory warnings.");
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("an explicit conclusion wins over the FAILURE default", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Effect.flatMap(CheckRun, (check) =>
              check.withCheckRun("build", "sha", (_id, conclude) =>
                Effect.flatMap(conclude("skipped"), () => Effect.fail("boom" as const))
              )
            )
          );
          assert.strictEqual(error, "boom", "the failure still propagates");
          assert.strictEqual(
            (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion,
            "skipped"
          );
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("an explicit conclusion wins over the CANCELLED default", () =>
        Effect.gen(function* () {
          const started = yield* Latch.make();
          const fiber = yield* Effect.forkChild(
            Effect.flatMap(CheckRun, (check) =>
              check.withCheckRun("build", "sha", (_id, conclude) =>
                Effect.gen(function* () {
                  yield* conclude("timed_out");
                  yield* started.open;
                  return yield* Effect.never;
                })
              )
            )
          );
          yield* started.await;
          yield* Fiber.interrupt(fiber);
          assert.strictEqual(
            (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion,
            "timed_out",
            "the teardown interrupt does not overwrite a watchdog's timed_out"
          );
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("the last conclusion recorded is the one written", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(CheckRun, (check) =>
            check.withCheckRun("build", "sha", (_id, conclude) =>
              Effect.flatMap(conclude("neutral"), () => conclude("failure"))
            )
          );
          assert.lengthOf(script.calls, 2, "two conclude calls still produce ONE completion");
          assert.strictEqual(
            (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion,
            "failure"
          );
        })
      );
    });
  }

  for (const completionStatus of [200, 422]) {
    {
      const defect = GitHubError.decode("callback", "construction defect");
      const { script, base } = harness([
        { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
        { status: completionStatus, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
      ]);
      it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
        it.effect(`a synchronous callback defect concludes the run and survives PATCH status ${completionStatus}`, () =>
          Effect.gen(function* () {
            const exit = yield* Effect.exit(
              Effect.flatMap(CheckRun, (check) =>
                check.withCheckRun("build", "sha", (): Effect.Effect<never> => {
                  throw defect;
                })
              )
            );
            assertExitFailure(exit, Exit.match(exit, { onFailure: (cause) => cause, onSuccess: () => Cause.empty }));
            assert.lengthOf(exit.cause.reasons, 1);
            const found = Cause.findDefect(exit.cause);
            assertSuccess(found, defect);
            assert.strictEqual(found.success, defect);
            assert.lengthOf(script.calls, 2);
            assert.strictEqual(script.calls[1]?.method, "PATCH");
            assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/check-runs/7");
            const body = yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}");
            assert.strictEqual(body.status, "completed");
            assert.strictEqual(body.conclusion, "failure");
          })
        );
      });
    }
  }

  {
    const { script, base } = harness([
      { status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
      { status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
    ]);
    it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("a defect in `use` still concludes the run", () =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            Effect.flatMap(CheckRun, (check) =>
              check.withCheckRun("build", "sha", () => Effect.die(new Error("kaboom")))
            )
          );
          assertExitFailure(exit, Exit.match(exit, { onFailure: (cause) => cause, onSuccess: () => Cause.empty }));
          assert.strictEqual(
            (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion,
            "failure"
          );
        })
      );
    });
  }
});

describe("CommentMarker", () => {
  it("renders an HTML comment nobody sees", () => {
    assert.strictEqual(CommentMarker.make({ namespace: "acme", key: "release" }).html, "<!-- acme:release -->");
  });

  it("matches only its own marker", () => {
    const marker = CommentMarker.make({ namespace: "acme", key: "release" });
    assert.isTrue(marker.matches("hello\n\n<!-- acme:release -->"));
    assert.isFalse(marker.matches("hello\n\n<!-- acme:other -->"));
  });

  it("needs no client, no layer and no vendor name baked into the library", () => {
    assert.strictEqual(CommentMarker.make({ namespace: "anyone", key: "k" }).html, "<!-- anyone:k -->");
  });
});

describe("PullRequestComment", () => {
  const comment = (id: number, body: string) => ({ id, body, html_url: `https://x/${id}` });
  const marker = CommentMarker.make({ namespace: "acme", key: "release" });

  {
    const { script, base } = harness([
      {
        status: 200,
        body: [comment(1, "chatter"), comment(2, "more")],
        headers: linkNext("https://api.github.com/repositories/1/issues/5/comments?page=2"),
      },
      { status: 200, body: [comment(3, `sticky\n\n${marker.html}`)] },
    ]);
    it.layer(PullRequestComment.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("find PAGINATES, so a busy pull request does not lose the marker", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequestComment, (comments) => comments.find(5, marker));
          assert.strictEqual(O.getOrThrow(value).id, 3);
          assert.strictEqual(script.count(), 2);
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 200, body: [] },
      { status: 201, body: comment(9, "x") },
    ]);
    it.layer(PullRequestComment.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("upsert posts when there is nothing marked yet", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(PullRequestComment, (comments) => comments.upsert(5, marker, "the body"));
          assert.strictEqual(script.calls[1]?.method, "POST");
          assert.include((yield* Schema.decodeEffect(JsonComment)(script.calls[1]?.body ?? "{}")).body, marker.html);
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 200, body: [comment(9, `old\n\n${marker.html}`)] },
      { status: 200, body: comment(9, "new") },
    ]);
    it.layer(PullRequestComment.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("upsert edits the marked comment when there is one", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(PullRequestComment, (comments) => comments.upsert(5, marker, "the body"));
          assert.strictEqual(script.calls[1]?.method, "PATCH");
          assert.include(script.calls[1]?.path ?? "", "/issues/comments/9");
        })
      );
    });
  }
});

describe("PullRequest", () => {
  const pull = (number: number, extra: Record<string, unknown> = {}) => ({
    number,
    node_id: `PR_${number}`,
    html_url: `https://x/${number}`,
    title: `pr ${number}`,
    state: "open",
    head: { ref: "feature", sha: "feature-sha" },
    base: { ref: "main", sha: "base-sha" },
    draft: false,
    merged: false,
    merged_at: null,
    ...extra,
  });

  {
    const { script, base } = harness([
      { status: 200, body: [pull(12, { merged_at: "2026-01-01T00:00:00Z", state: "closed" })] },
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("listAssociatedWithCommit answers the question it is named for", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) => pulls.listAssociatedWithCommit("abc123"));
          assert.strictEqual(value[0]?.number, 12);
          assertSome(value[0]?.mergedAt ?? O.none(), O.getOrThrow(value[0]?.mergedAt ?? O.none()));
          assert.include(script.calls[0]?.path ?? "", "/commits/abc123/pulls");
        })
      );
    });
  }

  {
    const { base } = harness([
      ...[{ status: 200, body: pull(4, { body: "prior description" }) }],
      ...[{ status: 200, body: [pull(4, { body: "prior description" })] }],
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("carries the prior description, the input that marker-based body management reads", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) => pulls.get(4));
          assert.strictEqual(value.body, "prior description");

          const listed = yield* Effect.flatMap(PullRequest, (pulls) => pulls.list());
          assert.strictEqual(listed[0]?.body, "prior description", "list shares the projection");
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 200, body: pull(5, { body: null }) }]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("a null description projects as absent, not as a value", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) => pulls.get(5));
          assert.isUndefined(
            value.body,
            "GitHub sends body: null, and the projection omits the key rather than inventing one"
          );
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 200, body: pull(1) }]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("mergedAt is none for an open pull request", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) => pulls.get(1));
          assertNone(value.mergedAt);
          assert.isFalse(value.merged);
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 200, body: pull(9) }]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("carries the head and base shas alongside the branch names", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) => pulls.get(9));
          assert.strictEqual(value.head, "feature");
          assert.strictEqual(value.headSha, "feature-sha");
          assert.strictEqual(value.base, "main");
          assert.strictEqual(value.baseSha, "base-sha", "base.sha answers which commit the branch came from");
        })
      );
    });
  }

  {
    const { script, base } = harness([
      {
        status: 200,
        body: [
          { filename: "a.txt", status: "modified", additions: 1, deletions: 2 },
          { filename: "new.txt", status: "renamed", additions: 0, deletions: 0, previous_filename: "old.txt" },
        ],
      },
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("listFiles carries the status, not the path alone", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) => pulls.listFiles(7));
          assert.deepStrictEqual(
            A.map(value, (file) => file.path),
            ["a.txt", "new.txt"]
          );
          assert.strictEqual(
            value[0]?.status,
            "modified",
            "the endpoint answers the diff-entry shape of the single-commit read"
          );
          assert.strictEqual(value[1]?.status, "renamed");
          assert.strictEqual(value[1]?.previousPath, "old.txt");
          assert.include(script.calls[0]?.path ?? "", "/pulls/7/files");
        })
      );
    });
  }

  {
    const { base } = harness([
      { status: 200, body: [{ filename: "a.txt", status: "future_status", additions: 1, deletions: 0 }] },
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("listFiles rejects an unknown file status through GitHubError", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) => Effect.flip(pulls.listFiles(7)));
          assert.instanceOf(value, GitHubError);
          assert.strictEqual(value.kind, "decode");
          assert.strictEqual(value.operation, "PullRequest.listFiles");
          assert.isDefined(value.cause);
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 200, body: [] },
      { status: 201, body: pull(3) },
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("upsert opens one when none is open", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) =>
            pulls.upsert({ title: "t", head: "feature", base: "main" })
          );
          assert.isTrue(value.created);
          assert.strictEqual(script.calls[1]?.method, "POST");
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 200, body: [pull(3)] },
      { status: 200, body: pull(3, { title: "t2" }) },
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("upsert updates the open one when there is one", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) =>
            pulls.upsert({ title: "t2", head: "feature", base: "main" })
          );
          assert.isFalse(value.created);
          assert.strictEqual(script.calls[1]?.method, "PATCH");
        })
      );
    });
  }

  {
    const { base } = harness([
      { status: 200, body: [] },
      { status: 201, body: pull(3) },
      { status: 200, body: [pull(3)] },
      { status: 200, body: pull(3, { title: "t2" }) },
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("upsert returns schema-valid plain objects for create and update", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) =>
            Effect.gen(function* () {
              const created = yield* pulls.upsert({ title: "t", head: "feature", base: "main" });
              const updated = yield* pulls.upsert({ title: "t2", head: "feature", base: "main" });
              return { created, updated };
            })
          );
          assert.isTrue(Schema.is(UpsertedPullRequest)(value.created));
          assert.isTrue(Schema.is(UpsertedPullRequest)(value.updated));
          assert.deepStrictEqual(
            value.created,
            UpsertedPullRequest.make({ pullRequest: value.created.pullRequest, created: true })
          );
          assert.deepStrictEqual(
            value.updated,
            UpsertedPullRequest.make({ pullRequest: value.updated.pullRequest, created: false })
          );
          assert.strictEqual(value.created.pullRequest.number, 3);
          assert.strictEqual(value.updated.pullRequest.title, "t2");
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 200, body: [] },
      { status: 201, body: pull(3) },
    ]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("upsert qualifies the head branch with the owner", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(PullRequest, (pulls) => pulls.upsert({ title: "t", head: "feature", base: "main" }));
          assert.strictEqual(script.queryOf(0).get("head"), "acme:feature");
        })
      );
    });
  }

  const info = PullRequestInfo.make({
    number: 3,
    nodeId: "PR_3",
    url: "https://x/3",
    title: "t",
    state: "open",
    head: "feature",
    headSha: "feature-sha",
    base: "main",
    baseSha: "base-sha",
    draft: false,
    merged: false,
    mergedAt: O.none(),
  });

  {
    const { script, base } = harness([{ status: 200, body: { data: {} } }]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("setAutoMerge is its own call, carrying the GraphQL merge method", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(PullRequest, (pulls) => pulls.setAutoMerge(info, "squash"));
          const body = yield* Schema.decodeEffect(JsonGraphQL)(script.calls[0]?.body ?? "{}");
          assert.include(body.query, "enablePullRequestAutoMerge");
          assert.deepStrictEqual(
            body.variables,
            { pullRequestId: "PR_3", mergeMethod: "SQUASH" },
            "GraphQL spells merge methods in capitals; REST does not"
          );
        })
      );
    });
  }

  {
    const { script, base } = harness([{ status: 200, body: { data: {} } }]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("setAutoMerge off sends the disable mutation", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(PullRequest, (pulls) => pulls.setAutoMerge(info, "off"));
          const body = yield* Schema.decodeEffect(JsonGraphQL)(script.calls[0]?.body ?? "{}");
          assert.include(body.query, "disablePullRequestAutoMerge");
          assert.deepStrictEqual(body.variables, { pullRequestId: "PR_3" });
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 201, body: pull(4) }]);
    it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("a create that succeeds is not failed by auto-merge", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(PullRequest, (pulls) =>
            pulls.create({ title: "t", head: "feature", base: "main" })
          );
          assert.strictEqual(value.number, 4);
        })
      );
    });
  }
});

describe("GitHubIssue REST", () => {
  const issue = {
    number: 169,
    title: "close me",
    state: "open",
    labels: ["release", { name: "bug" }],
    html_url: "https://x/169",
    node_id: "I_169",
  };

  const PINNED_API_VERSION = "2026-03-10";

  {
    const { script, base } = harness([{ status: 200, body: { ...issue, state: "closed" } }]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("close sends state, state_reason and the pinned api-version", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(GitHubIssue, (issues) => issues.close(169, "not_planned"));
          const call = script.calls[0];
          assert.isDefined(call);
          assert.strictEqual(call?.method, "PATCH");
          assert.strictEqual(call.path, "/repos/acme/widget/issues/169");
          assert.strictEqual(
            call.headers["x-github-api-version"],
            PINNED_API_VERSION,
            "the default 2022-11-28 version draws a Deprecation header that octokit prints"
          );
          const body = yield* Schema.decodeEffect(JsonObject)(call.body ?? "{}");
          assert.strictEqual(body.state, "closed");
          assert.strictEqual(body.state_reason, "not_planned");
        })
      );
    });
  }

  {
    const { script, base } = harness([{ status: 200, body: { ...issue, state: "closed" } }]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("close without a reason leaves state_reason out of the body", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(GitHubIssue, (issues) => issues.close(169));
          const body = yield* Schema.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}");
          assert.strictEqual(body.state, "closed");
          assert.notProperty(body, "state_reason");
          assert.notProperty(body, "headers", "the version header does not leak into the body as a parameter");
        })
      );
    });
  }

  {
    const { script, base } = harness([{ status: 200, body: issue }]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("get pins the api-version and normalizes the label union", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubIssue, (issues) => issues.get(169));
          assert.strictEqual(script.calls[0]?.headers["x-github-api-version"], PINNED_API_VERSION);
          assert.deepStrictEqual([...value.labels], ["release", "bug"]);
          assert.strictEqual(value.nodeId, "I_169");
        })
      );
    });
  }

  {
    const { script, base } = harness([{ status: 201, body: { id: 77 } }]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("comment pins the api-version and returns the new comment id", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubIssue, (issues) => issues.comment(169, "done"));
          assert.strictEqual(value, 77);
          const call = script.calls[0];
          assert.isDefined(call);
          assert.strictEqual(call?.method, "POST");
          assert.strictEqual(call.path, "/repos/acme/widget/issues/169/comments");
          assert.strictEqual(call.headers["x-github-api-version"], PINNED_API_VERSION);
          assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(call.body ?? "{}")).body, "done");
        })
      );
    });
  }

  {
    const { script, base } = harness([{ status: 200, body: [issue] }]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("list pins the api-version and forwards its page options", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubIssue, (issues) =>
            issues.list({ state: "open", labels: ["release", "bug"], page: PageOptions.make({ perPage: 5 }) })
          );
          assert.strictEqual(value.length, 1);
          assert.strictEqual(script.calls[0]?.headers["x-github-api-version"], PINNED_API_VERSION);
          assert.strictEqual(script.queryOf(0).get("per_page"), "5");
          assert.strictEqual(script.queryOf(0).get("state"), "open");
          assert.strictEqual(script.queryOf(0).get("labels"), "release,bug");
          assert.isNull(script.queryOf(0).get("headers"), "the header rides as a header, not as a query parameter");
        })
      );
    });
  }
});

describe("GitHubIssue.commentOnce", () => {
  const marker = CommentMarker.make({ namespace: "acme", key: "once" });
  const comment = (id: number, body: string) => ({ id, body, html_url: `https://x/${id}` });

  {
    const { script, base } = harness([
      {
        status: 200,
        body: [comment(1, "chatter"), comment(2, "more chatter")],
        headers: linkNext("https://api.github.com/repositories/1/issues/5/comments?page=2"),
      },
      { status: 200, body: [comment(3, `already said\n\n${marker.html}`)] },
    ]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("skips when the marker is already there — even on a later page", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubIssue, (issues) => issues.commentOnce(5, marker, "the body"));
          assert.isFalse(value.wrote, "found on page two, where a single-page read would post a duplicate");
          assert.strictEqual(value.comment.id, 3);
          assert.strictEqual(script.count(), 2);
          assert.isTrue(
            A.every(script.calls, (call) => call.method === "GET"),
            "create-or-skip, never edit"
          );
        })
      );
    });
  }

  {
    const { script, base } = harness([
      { status: 200, body: [comment(1, "unrelated chatter")] },
      { status: 201, body: comment(9, `the body\n\n${marker.html}`) },
    ]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("creates with the marker appended exactly as upsert formats it", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubIssue, (issues) => issues.commentOnce(5, marker, "the body"));
          assert.isTrue(value.wrote);
          assert.strictEqual(value.comment.id, 9);
          const post = script.calls[1];
          assert.isDefined(post);
          assert.strictEqual(post?.method, "POST");
          assert.strictEqual(post.path, "/repos/acme/widget/issues/5/comments");
          const sent = (yield* Schema.decodeEffect(JsonObject)(post.body ?? "{}")).body;
          assert.strictEqual(
            sent,
            `the body\n\n${marker.html}`,
            "the upsert spelling, so each member finds the other's marker"
          );
          for (const call of script.calls) {
            assert.strictEqual(
              call.headers["x-github-api-version"],
              "2026-03-10",
              "the pinned version rides on read and write"
            );
          }
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 404, body: { message: "Not Found" } }]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("passes the client's GitHubError through untouched", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Effect.flatMap(GitHubIssue, (issues) => issues.commentOnce(5, marker, "the body"))
          );
          assert.strictEqual(error.kind, "notFound");
        })
      );
    });
  }

  it("makeTest dies loudly on the unstubbed member, naming it", () => {
    assert.throws(
      () => GitHubIssue.makeTest({}).commentOnce(1, marker, "x"),
      /commentOnce\(\) was called but not stubbed/
    );
  });
});

describe("GitHubIssue GraphQL documents", () => {
  {
    const node = (number: number) => ({
      id: `I_${number}`,
      number,
      title: `issue ${number}`,
      state: "OPEN",
      url: `https://x/${number}`,
    });
    const { base } = harness([
      {
        status: 200,
        body: {
          data: {
            repository: {
              pullRequest: {
                allLinked: { nodes: [node(1), node(2)] },
                manuallyLinked: { nodes: [node(2)] },
              },
            },
          },
        },
      },
    ]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("linkedIssues distinguishes human links from inferred ones", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubIssue, (issues) => issues.linkedIssues(7));
          assert.isTrue(
            O.exists(
              A.findFirst(value, (issue) => issue.number === 1),
              (issue) => !issue.userLinked
            ),
            "userLinked is the field the owned document exists for"
          );
          assert.isTrue(
            O.exists(
              A.findFirst(value, (issue) => issue.number === 2),
              (issue) => issue.userLinked
            )
          );
        })
      );
    });
  }

  {
    const body = (number: number) => ({
      data: {
        repository: {
          issue: { timelineItems: { nodes: [{ source: { __typename: "PullRequest", number } }] } },
        },
      },
    });
    const { base } = harness([...[{ status: 200, body: body(42) }], ...[{ status: 200, body: body(41) }]]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("isCrossReferencedBy is the idempotence guard", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubIssue, (issues) => issues.isCrossReferencedBy(1, 42));
          assert.isTrue(value);

          const other = yield* Effect.flatMap(GitHubIssue, (issues) => issues.isCrossReferencedBy(1, 42));
          assert.isFalse(other);
        })
      );
    });
  }
});

describe("GitHubRelease", () => {
  const release = {
    id: 5,
    tag_name: "v1.0.0",
    name: null,
    body: null,
    draft: false,
    prerelease: false,
    html_url: "https://x/5",
    upload_url: "https://uploads.github.com/x{?name,label}",
  };

  {
    const { base } = harness([{ status: 200, body: release }]);
    it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("coalesces GitHub's nulls for name and body", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubRelease, (releases) => releases.getByTag("v1.0.0"));
          assert.strictEqual(value.name, "");
          assert.strictEqual(value.body, "");
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 404, body: { message: "Not Found" } }]);
    it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("getByTagOption reads absence as none", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubRelease, (releases) => releases.getByTagOption("v9.9.9"));
          assertNone(value);
        })
      );
    });
  }

  {
    const info = ReleaseInfo.make({
      id: 5,
      tag: "v1.0.0",
      name: "",
      body: "",
      draft: false,
      prerelease: false,
      url: "https://x/5",
      uploadUrl: "https://uploads.github.com/x",
    });
    const { script, base } = harness([
      { status: 201, body: { id: 9, name: "app.zip", browser_download_url: "https://d/9", size: 12 } },
    ]);
    it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("uploadAsset goes to the uploads host with a content type", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(GitHubRelease, (releases) =>
            releases.uploadAsset(info, { name: "app.zip", data: "bytes", contentType: "application/zip" })
          );
          assert.strictEqual(value.id, 9);
          assert.include(script.calls[0]?.url ?? "", "uploads.github.com");
          assert.strictEqual(script.calls[0]?.headers["content-type"], "application/zip");
          assert.strictEqual(
            script.queryOf(0).get("name"),
            "app.zip",
            "the route is outside the generated map, so octokit drops a name passed only as a parameter"
          );
          assert.isFalse(script.queryOf(0).has("label"));
          assert.notInclude(script.calls[0]?.url ?? "", "&");
        })
      );
    });
  }

  {
    const info = ReleaseInfo.make({
      id: 5,
      tag: "v1.0.0",
      name: "",
      body: "",
      draft: false,
      prerelease: false,
      url: "https://x/5",
      uploadUrl: "https://uploads.github.com/x",
    });
    const { script, base } = harness([
      { status: 201, body: { id: 9, name: "app.zip", browser_download_url: "https://d/9", size: 12 } },
    ]);
    it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("uploadAsset carries an optional display label as a second query parameter", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(GitHubRelease, (releases) =>
            releases.uploadAsset(info, {
              name: "app.zip",
              data: "bytes",
              contentType: "application/zip",
              label: "Tarball (npm)",
            })
          );
          assert.strictEqual(script.queryOf(0).get("name"), "app.zip");
          assert.strictEqual(script.queryOf(0).get("label"), "Tarball (npm)");
        })
      );
    });
  }

  {
    const { script, base } = harness([{ status: 200, body: [] }]);
    it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("listAssets forwards the caller's page budget", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(GitHubRelease, (releases) =>
            releases.listAssets(5, { page: PageOptions.make({ perPage: 7 }) })
          );
          assert.strictEqual(script.queryOf(0).get("per_page"), "7");
        })
      );
    });
  }
});

describe("WorkflowDispatch", () => {
  const run = (status: string, conclusion?: string) => ({
    status: 200,
    body: {
      id: 1,
      status,
      html_url: "https://x/1",
      path: ".github/workflows/ci.yml",
      ...(conclusion !== undefined ? { conclusion } : {}),
    },
  });
  const runs = (status: string) => ({
    status: 200,
    body: { workflow_runs: [run(status).body], total_count: 1 },
  });

  it.effect(
    "polls until the run finishes, with no sentinel error",
    () =>
      Effect.scopedWith((scope) =>
        Effect.gen(function* () {
          const { script, base } = harness([
            { status: 204 },
            runs("queued"),
            run("in_progress"),
            run("completed", "success"),
          ]);
          const context = yield* Layer.buildWithScope(WorkflowDispatch.layer.pipe(Layer.provideMerge(base)), scope);
          const fiber = yield* Effect.flatMap(WorkflowDispatch, (workflows) =>
            workflows.dispatchAndWait("ci.yml", "main", {
              poll: { interval: Duration.seconds(1), timeout: Duration.seconds(30) },
            })
          ).pipe(Effect.provideContext(context), Effect.forkChild);
          yield* TestClock.adjust(Duration.seconds(10));
          const status = yield* Fiber.join(fiber);
          assert.strictEqual(status.conclusion, "success");
          assert.isTrue(status.isDone);
          assert.isAtLeast(script.count(), 4);
          assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/actions/workflows/ci.yml/runs");
          assert.strictEqual(script.calls[2]?.path, "/repos/acme/widget/actions/runs/1");
          assert.strictEqual(script.calls[3]?.path, "/repos/acme/widget/actions/runs/1");
        })
      ),
    { timeout: 30_000 }
  );

  it.effect(
    "fails typed when the run never finishes",
    () =>
      Effect.scopedWith((scope) =>
        Effect.gen(function* () {
          const { script, base } = harness([{ status: 204 }, runs("in_progress"), run("in_progress")]);
          const context = yield* Layer.buildWithScope(WorkflowDispatch.layer.pipe(Layer.provideMerge(base)), scope);
          const fiber = yield* Effect.flatMap(WorkflowDispatch, (workflows) =>
            workflows.dispatchAndWait("ci.yml", "main", {
              poll: { interval: Duration.seconds(1), timeout: Duration.seconds(3) },
            })
          ).pipe(Effect.provideContext(context), Effect.flip, Effect.forkChild);
          yield* TestClock.adjust(Duration.seconds(30));
          const error = yield* Fiber.join(fiber);
          assert.strictEqual(error.kind, "rejected");
          assert.include(error.reason, "did not finish");
          assert.strictEqual(error.status, 408);
          assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/actions/workflows/ci.yml/runs");
          assert.strictEqual(script.calls[2]?.path, "/repos/acme/widget/actions/runs/1");
        })
      ),
    { timeout: 30_000 }
  );
});

describe("WorkflowDispatch.list", () => {
  const workflowsBody = (workflows: ReadonlyArray<Record<string, unknown>>) => ({
    status: 200,
    body: { total_count: workflows.length, workflows },
  });

  {
    const { script, base } = harness([
      workflowsBody([
        { id: 1, name: "CI", path: ".github/workflows/ci.yml", state: "active" },
        { id: 2, name: "Old", path: ".github/workflows/old.yml", state: "disabled_manually" },
      ]),
    ]);
    it.layer(WorkflowDispatch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("reports every workflow, including disabled ones, without interpreting state", () =>
        Effect.gen(function* () {
          const workflows = yield* Effect.flatMap(WorkflowDispatch, (w) => w.list);
          assert.deepStrictEqual(
            [...workflows],
            [
              { id: 1, name: "CI", path: ".github/workflows/ci.yml", state: "active" },
              { id: 2, name: "Old", path: ".github/workflows/old.yml", state: "disabled_manually" },
            ]
          );
          assert.include(script.calls[0]?.url ?? "", "/actions/workflows");
        })
      );
    });
  }

  {
    const { base } = harness([workflowsBody([])]);
    it.layer(WorkflowDispatch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("a repository with no workflows is an empty array, not a failure", () =>
        Effect.gen(function* () {
          const workflows = yield* Effect.flatMap(WorkflowDispatch, (w) => w.list);
          assert.lengthOf(workflows, 0);
        })
      );
    });
  }
});

describe("Attestation", () => {
  {
    const { script, base } = harness([{ status: 201, body: { id: 3 } }]);
    it.layer(Attestation.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("pins the api version on every call", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(Attestation, (attestations) => attestations.upload({ dsseEnvelope: {} }));
          assert.strictEqual(script.calls[0]?.headers["x-github-api-version"], "2026-03-10");
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 404, body: { message: "Not Found" } }]);
    it.layer(Attestation.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("reads a 404 as no attestations", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(Attestation, (attestations) => attestations.listForSubject("abc"));
          assert.deepStrictEqual(value, []);
        })
      );
    });
  }

  {
    const { base } = harness([{ status: 422, body: { message: "Validation Failed" } }]);
    it.layer(Attestation.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("reads a 422 as no attestations too", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(Attestation, (attestations) => attestations.listForSubject("abc"));
          assert.deepStrictEqual(value, [], "GitHub answers an unseen digest with a 404 or a 422 depending on path");
        })
      );
    });
  }

  {
    const { script, base } = harness([{ status: 200, body: { attestations: [] } }]);
    it.layer(Attestation.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("prefixes a bare hex digest", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(Attestation, (attestations) => attestations.listForSubject("deadbeef"));
          assert.include(script.calls[0]?.path ?? "", "sha256:deadbeef");
        })
      );
    });
  }

  {
    const { base } = harness([
      {
        status: 200,
        body: {
          attestations: [{ id: 1, bundle_url: "https://b/1", predicate_type: "https://slsa.dev/provenance/v1" }],
        },
      },
    ]);
    it.layer(Attestation.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("projects entries to url and predicate type", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(Attestation, (attestations) => attestations.listForSubject("sha256:abc"));
          assert.strictEqual(value[0]?.url, "https://b/1");
          assert.strictEqual(value[0]?.predicateType, "https://slsa.dev/provenance/v1");
        })
      );
    });
  }
});
