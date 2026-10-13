import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { CommentMarker, CommentRecord, PullRequestComment } from "../../effected/github/PullRequestComment.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import { harness, REPO } from "./harness.ts";

const marker = CommentMarker.make({ namespace: "ci", key: "report" });
const record = CommentRecord.make({ id: 42, body: "report", url: "web" });
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

describe("PullRequestComment coverage", () => {
  it.layer(Layer.mergeAll(PullRequestComment.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("every unstubbed member identifies itself", () => Effect.gen(function* () {
      for (const service of [PullRequestComment.makeTest(), yield* PullRequestComment]) {
        assert.throws(() => service.create(7, "body"), "PullRequestComment.makeTest: create() was called but not stubbed");
        assert.throws(() => service.upsert(7, marker, "body"), "PullRequestComment.makeTest: upsert() was called but not stubbed");
        assert.throws(() => service.find(7, marker), "PullRequestComment.makeTest: find() was called but not stubbed");
        assert.throws(() => service.delete(42), "PullRequestComment.makeTest: delete() was called but not stubbed");
      }
    }));
  });
  it.layer(Layer.mergeAll(PullRequestComment.layerTest({
    create: (issue, body) => Effect.succeed(CommentRecord.make({ ...record, id: issue, body })),
    upsert: (issue, suppliedMarker, body) => Effect.succeed(CommentRecord.make({ ...record, id: issue, body: `${body}\n\n${suppliedMarker.html}` })),
    find: () => Effect.succeedSome(record),
    delete: () => Effect.void,
  }), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("layerTest retains every supplied override and its arguments", () => Effect.gen(function* () {
      const service = yield* PullRequestComment;
      assert.deepStrictEqual(yield* service.create(7, "new"), CommentRecord.make({ ...record, id: 7, body: "new" }));
      assert.deepStrictEqual(yield* service.upsert(7, marker, "new"), CommentRecord.make({ ...record, id: 7, body: `new\n\n${marker.html}` }));
      assertSome(yield* service.find(7, marker), record);
      assert.strictEqual(yield* service.delete(42), undefined);
    }));
  });
  const { base, script } = harness([
    { status: 201, body: { id: 42, html_url: "web", body: null } },
    { status: 200, body: [{ id: 1, html_url: "web" }, { id: 42, html_url: "web", body: `old\n\n${marker.html}` }] },
    { status: 200, body: [] },
    { status: 200, body: [] },
    { status: 201, body: { id: 42, html_url: "web", body: `new\n\n${marker.html}` } },
    { status: 200, body: [{ id: 42, html_url: "web", body: `old\n\n${marker.html}` }] },
    { status: 200, body: { id: 42, html_url: "web", body: `updated\n\n${marker.html}` } },
    { status: 204 },
  ]);
  it.layer(PullRequestComment.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("normalizes absent bodies, searches markers, and creates or updates sticky comments", () => Effect.gen(function* () {
      const service = yield* PullRequestComment;
      assert.deepStrictEqual(yield* service.create(7, "text"), CommentRecord.make({ ...record, body: "" }));
      assertSome(yield* service.find(7, marker, { page: PageOptions.make({ perPage: 3, maxPages: 1 }) }), CommentRecord.make({ ...record, body: `old\n\n${marker.html}` }));
      assert.strictEqual(script.queryOf(1).get("per_page"), "3");
      assertNone(yield* service.find(7, marker));
      assert.deepStrictEqual(yield* service.upsert(7, marker, "new"), CommentRecord.make({ ...record, body: `new\n\n${marker.html}` }));
      assert.deepStrictEqual(yield* service.upsert(7, marker, "updated"), CommentRecord.make({ ...record, body: `updated\n\n${marker.html}` }));
      assert.strictEqual(yield* service.delete(42), undefined);
      assert.deepStrictEqual(A.map(script.calls, (call) => [call.method, call.path]), [
        ["POST", "/repos/acme/widget/issues/7/comments"],
        ["GET", "/repos/acme/widget/issues/7/comments"],
        ["GET", "/repos/acme/widget/issues/7/comments"],
        ["GET", "/repos/acme/widget/issues/7/comments"],
        ["POST", "/repos/acme/widget/issues/7/comments"],
        ["GET", "/repos/acme/widget/issues/7/comments"],
        ["PATCH", "/repos/acme/widget/issues/comments/42"],
        ["DELETE", "/repos/acme/widget/issues/comments/42"],
      ]);
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}"), { body: "text" });
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[4]?.body ?? "{}"), { body: `new\n\n${marker.html}` });
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[6]?.body ?? "{}"), { body: `updated\n\n${marker.html}` });
    }));
  });
});
