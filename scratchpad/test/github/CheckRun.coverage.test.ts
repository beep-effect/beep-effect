import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { Annotation, CheckRun, CheckRunOutput, CheckRunRef } from "../../effected/github/CheckRun.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { harness } from "./harness.ts";

const JsonBody = S.fromJsonString(S.Unknown);
const JsonRecord = S.fromJsonString(S.Record(S.String, S.Unknown));

const output = CheckRunOutput.make({ title: "lint", summary: "passed" });
const ref = CheckRunRef.make({ id: 3, name: "lint", url: "stub", status: "completed" });
it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
  it.effect("every unstubbed member names the missing override", () => Effect.sync(() => {
    const service = CheckRun.makeTest();
    assert.throws(() => service.create("lint", "sha"), /CheckRun.makeTest: create/);
    assert.throws(() => service.get(3), /CheckRun.makeTest: get/);
    assert.throws(() => service.update(3, output), /CheckRun.makeTest: update/);
    assert.throws(() => service.complete(3, "success"), /CheckRun.makeTest: complete/);
    assert.throws(() => service.withCheckRun("lint", "sha", () => Effect.void), /CheckRun.makeTest: withCheckRun/);
  }));
  it.layer(CheckRun.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("default layer exposes the fail-loud double", () => Effect.gen(function* () {
      const service = yield* CheckRun;
      assert.throws(() => service.get(3), /CheckRun.makeTest: get/);
    }));
  });
  it.layer(CheckRun.layerTest({ create: () => Effect.succeed(ref), get: () => Effect.succeed(ref), update: () => Effect.void, complete: () => Effect.void, withCheckRun: (_name, _sha, use) => use(3, () => Effect.void) }), { timeout: "30 seconds" })((it) => {
    it.effect("all supplied overrides are preserved", () => Effect.gen(function* () {
      const service = yield* CheckRun;
      assert.strictEqual(yield* service.create("lint", "sha"), ref);
      assert.strictEqual(yield* service.get(3), ref);
      assert.strictEqual(yield* service.update(3, output), undefined);
      assert.strictEqual(yield* service.complete(3, "success"), undefined);
      assert.strictEqual(yield* service.withCheckRun("lint", "sha", (id) => Effect.succeed(id)), 3);
    }));
  });
});
const { base, script } = harness([
  { status: 200, body: { id: 3, name: "lint", status: "completed", html_url: null } },
  { status: 200, body: {} },
  { status: 200, body: {} },
]);
it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
  it.effect("get defaults missing URLs and output maps annotation fields faithfully", () => Effect.gen(function* () {
    const service = yield* CheckRun;
    const fetched = yield* service.get(3);
    assert.strictEqual(fetched.url, "");
    assert.strictEqual(fetched.id, 3);
    assert.strictEqual(fetched.status, "completed");
    yield* service.update(3, CheckRunOutput.make({ ...output, text: "details", annotations: [
      Annotation.make({ path: "a.ts", startLine: 1, endLine: 2, level: "warning", message: "first", title: "heading" }),
      Annotation.make({ path: "b.ts", startLine: 4, endLine: 4, level: "notice", message: "second" }),
    ] }));
    const body = yield* S.decodeEffect(JsonBody)(script.calls[1]?.body ?? "{}");
    assert.deepStrictEqual(body, { output: { title: "lint", summary: "passed", text: "details", annotations: [
      { path: "a.ts", start_line: 1, end_line: 2, annotation_level: "warning", message: "first", title: "heading" },
      { path: "b.ts", start_line: 4, end_line: 4, annotation_level: "notice", message: "second" },
    ] } });
    yield* service.complete(3, "skipped");
    const completion = yield* S.decodeEffect(JsonRecord)(script.calls[2]?.body ?? "{}");
    assert.strictEqual(completion.output, undefined);
    assert.strictEqual(completion.conclusion, "skipped");
  }));
});
