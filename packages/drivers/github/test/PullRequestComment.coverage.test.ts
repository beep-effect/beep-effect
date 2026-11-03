import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CommentMarker, CommentRecord, PullRequestComment } from "@beep/github/PullRequestComment";
import { Repo } from "@beep/github/Repo";
import { PageOptions } from "@beep/github/Rest";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { harness, REPO } from "./support/harness.ts";

const marker = CommentMarker.make({ namespace: "ci", key: "report" });
const record = CommentRecord.make({ id: 42, body: "report", url: "web" });
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

describe("PullRequestComment coverage", () => {
  it.layer(Layer.mergeAll(PullRequestComment.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("every unstubbed member identifies itself", () =>
      Effect.gen(function* () {
        for (const service of [PullRequestComment.makeTest(), yield* PullRequestComment]) {
          assert.throws(
            () => service.create(7, "body"),
            "PullRequestComment.makeTest: create() was called but not stubbed"
          );
          assert.throws(
            () => service.upsert(7, marker, "body"),
            "PullRequestComment.makeTest: upsert() was called but not stubbed"
          );
          assert.throws(
            () => service.find(7, marker),
            "PullRequestComment.makeTest: find() was called but not stubbed"
          );
          assert.throws(() => service.delete(42), "PullRequestComment.makeTest: delete() was called but not stubbed");
        }
      })
    );
  });
  it.layer(
    Layer.mergeAll(
      PullRequestComment.layerTest({
        create: dual(2, (issue: number, body: string) =>
          Effect.succeed(CommentRecord.make({ ...record, id: issue, body }))
        ),
        upsert: dual(3, (issue: number, suppliedMarker: CommentMarker, body: string) =>
          Effect.succeed(CommentRecord.make({ ...record, id: issue, body: `${body}\n\n${suppliedMarker.html}` }))
        ),
        find: dual(
          (args) => P.isNumber(args[0]),
          (_issue: number, _marker: CommentMarker, _options?: object) => Effect.succeedSome(record)
        ),
        delete: () => Effect.void,
      }),
      Repo.layer(REPO)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("layerTest retains every supplied override and its arguments", () =>
      Effect.gen(function* () {
        const service = yield* PullRequestComment;
        const created = yield* service.create(7, "new");
        assert.deepStrictEqual(created, CommentRecord.make({ ...record, id: 7, body: "new" }));
        const upsert1 = yield* service.upsert(7, marker, "new");
        assert.deepStrictEqual(upsert1, CommentRecord.make({ ...record, id: 7, body: `new\n\n${marker.html}` }));
        const found = yield* service.find(7, marker);
        assertSome(found, record);
        const delete2 = yield* service.delete(42);
        assert.strictEqual(delete2, undefined);
      })
    );
  });
  const { base, script } = harness([
    { status: 201, body: { id: 42, html_url: "web", body: null } },
    {
      status: 200,
      body: [
        { id: 1, html_url: "web" },
        { id: 42, html_url: "web", body: `old\n\n${marker.html}` },
      ],
    },
    { status: 200, body: [] },
    { status: 200, body: [] },
    { status: 201, body: { id: 42, html_url: "web", body: `new\n\n${marker.html}` } },
    { status: 200, body: [{ id: 42, html_url: "web", body: `old\n\n${marker.html}` }] },
    { status: 200, body: { id: 42, html_url: "web", body: `updated\n\n${marker.html}` } },
    { status: 204 },
  ]);
  it.layer(PullRequestComment.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("normalizes absent bodies, searches markers, and creates or updates sticky comments", () =>
      Effect.gen(function* () {
        const service = yield* PullRequestComment;
        const created3 = yield* service.create(7, "text");
        assert.deepStrictEqual(created3, CommentRecord.make({ ...record, body: "" }));
        const found4 = yield* service.find(7, marker, { page: PageOptions.make({ perPage: 3, maxPages: 1 }) });
        assertSome(found4, CommentRecord.make({ ...record, body: `old\n\n${marker.html}` }));
        assert.strictEqual(script.queryOf(1).get("per_page"), "3");
        const found5 = yield* service.find(7, marker);
        assertNone(found5);
        const upsert6 = yield* service.upsert(7, marker, "new");
        assert.deepStrictEqual(upsert6, CommentRecord.make({ ...record, body: `new\n\n${marker.html}` }));
        const upsert7 = yield* service.upsert(7, marker, "updated");
        assert.deepStrictEqual(upsert7, CommentRecord.make({ ...record, body: `updated\n\n${marker.html}` }));
        const delete8 = yield* service.delete(42);
        assert.strictEqual(delete8, undefined);
        assert.deepStrictEqual(
          A.map(script.calls, (call) => [call.method, call.path]),
          [
            ["POST", "/repos/acme/widget/issues/7/comments"],
            ["GET", "/repos/acme/widget/issues/7/comments"],
            ["GET", "/repos/acme/widget/issues/7/comments"],
            ["GET", "/repos/acme/widget/issues/7/comments"],
            ["POST", "/repos/acme/widget/issues/7/comments"],
            ["GET", "/repos/acme/widget/issues/7/comments"],
            ["PATCH", "/repos/acme/widget/issues/comments/42"],
            ["DELETE", "/repos/acme/widget/issues/comments/42"],
          ]
        );
        const value9 = yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}");
        assert.deepStrictEqual(value9, { body: "text" });
        const value10 = yield* S.decodeEffect(JsonObject)(script.calls[4]?.body ?? "{}");
        assert.deepStrictEqual(value10, {
          body: `new\n\n${marker.html}`,
        });
        const value11 = yield* S.decodeEffect(JsonObject)(script.calls[6]?.body ?? "{}");
        assert.deepStrictEqual(value11, {
          body: `updated\n\n${marker.html}`,
        });
      })
    );
  });
});

it.effect.prop(
  "CommentRecord preserves every encoded value",
  [Arbitrary.schema(CommentRecord)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CommentRecord)(value);
      const decoded = yield* S.decodeEffect(CommentRecord)(encoded);
      assert.isTrue(S.toEquivalence(CommentRecord)(decoded, value));
      const value12 = yield* S.encodeEffect(CommentRecord)(decoded);
      assert.deepStrictEqual(value12, encoded);
    }),
  { arbitrary: fcRuns(100) }
);
