import {
  Annotation,
  CheckRun,
  CheckRunCorrelationOptions,
  CheckRunNativeIdentity,
  CheckRunOutput,
  CheckRunRef,
} from "@beep/github/CheckRun";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { harness } from "./support/harness.ts";
import type { ConcludeCheckRun } from "@beep/github/CheckRun";

const JsonBody = S.fromJsonString(S.Unknown);
const JsonRecord = S.fromJsonString(S.Record(S.String, S.Unknown));

const output = CheckRunOutput.make({ title: "lint", summary: "passed" });
const ref = CheckRunRef.make({ id: 3, name: "lint", url: "stub", status: "completed" });
it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
  it.effect("every unstubbed member names the missing override", () =>
    Effect.sync(() => {
      const service = CheckRun.makeTest();
      assert.throws(() => service.create("lint", "sha"), /CheckRun.makeTest: create/);
      assert.throws(() => service.get(3), /CheckRun.makeTest: get/);
      assert.throws(() => service.update(3, output), /CheckRun.makeTest: update/);
      assert.throws(() => service.complete(3, "success"), /CheckRun.makeTest: complete/);
      assert.throws(() => service.withCheckRun("lint", "sha", () => Effect.void), /CheckRun.makeTest: withCheckRun/);
    })
  );
  it.layer(CheckRun.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("default layer exposes the fail-loud double", () =>
      Effect.gen(function* () {
        const service = yield* CheckRun;
        assert.throws(() => service.get(3), /CheckRun.makeTest: get/);
      })
    );
  });
  it.layer(
    CheckRun.layerTest({
      create: dual(2, (_name: string, _sha: string) => Effect.succeed(ref)),
      get: () => Effect.succeed(ref),
      update: dual(2, (_id: number, _output: CheckRunOutput) => Effect.void),
      complete: dual(
        (args) => P.isNumber(args[0]),
        (_id: number, _conclusion: string, _output?: CheckRunOutput) => Effect.void
      ),
      withCheckRun: dual(
        3,
        <A, E, R>(
          _name: string,
          _sha: string,
          use: (id: number, conclude: ConcludeCheckRun) => Effect.Effect<A, E, R>
        ) =>
          use(
            3,
            dual(
              (args) => P.isString(args[0]),
              (_conclusion: string, _output?: CheckRunOutput) => Effect.void
            )
          )
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("all supplied overrides are preserved", () =>
      Effect.gen(function* () {
        const service = yield* CheckRun;
        const created = yield* service.create("lint", "sha");
        assert.strictEqual(created, ref);
        const got = yield* service.get(3);
        assert.strictEqual(got, ref);
        const update1 = yield* service.update(3, output);
        assert.strictEqual(update1, undefined);
        const complete2 = yield* service.complete(3, "success");
        assert.strictEqual(complete2, undefined);
        const withCheckRun3 = yield* service.withCheckRun("lint", "sha", (id) => Effect.succeed(id));
        assert.strictEqual(withCheckRun3, 3);
      })
    );
  });
});

for (const [field, value] of [
  ["id", 1.5],
  ["id", "3"],
  ["name", 42],
  ["status", false],
  ["html_url", 42],
] as const) {
  const { base } = harness([
    { status: 201, body: { id: 3, name: "lint", status: "in_progress", [field]: value } },
    { status: 200, body: { id: 3, name: "lint", status: "completed", [field]: value } },
  ]);
  it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect(`returns typed create/get decode failures for invalid ${field}=${value}`, () =>
      Effect.gen(function* () {
        const service = yield* CheckRun;
        const result4 = yield* Effect.result(service.create("lint", "sha"));
        assertFailure(
          Result.mapError(result4, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "CheckRun.create" }
        );
        const result5 = yield* Effect.result(service.get(3));
        assertFailure(
          Result.mapError(result5, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "CheckRun.get" }
        );
      })
    );
  });
}
const { base, script } = harness([
  { status: 200, body: { id: 3, name: "lint", status: "completed", html_url: null } },
  { status: 200, body: {} },
  { status: 200, body: {} },
]);
it.layer(CheckRun.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
  it.effect("get defaults missing URLs and output maps annotation fields faithfully", () =>
    Effect.gen(function* () {
      const service = yield* CheckRun;
      const fetched = yield* service.get(3);
      assert.strictEqual(fetched.url, "");
      assert.strictEqual(fetched.id, 3);
      assert.strictEqual(fetched.status, "completed");
      yield* service.update(
        3,
        CheckRunOutput.make({
          ...output,
          text: "details",
          annotations: [
            Annotation.make({
              path: "a.ts",
              startLine: 1,
              endLine: 2,
              level: "warning",
              message: "first",
              title: "heading",
            }),
            Annotation.make({ path: "b.ts", startLine: 4, endLine: 4, level: "notice", message: "second" }),
          ],
        })
      );
      const body = yield* S.decodeEffect(JsonBody)(script.calls[1]?.body ?? "{}");
      assert.deepStrictEqual(body, {
        output: {
          title: "lint",
          summary: "passed",
          text: "details",
          annotations: [
            {
              path: "a.ts",
              start_line: 1,
              end_line: 2,
              annotation_level: "warning",
              message: "first",
              title: "heading",
            },
            { path: "b.ts", start_line: 4, end_line: 4, annotation_level: "notice", message: "second" },
          ],
        },
      });
      yield* service.complete(3, "skipped");
      const completion = yield* S.decodeEffect(JsonRecord)(script.calls[2]?.body ?? "{}");
      assert.strictEqual(completion.output, undefined);
      assert.strictEqual(completion.conclusion, "skipped");
    })
  );
});

const JsonCheckRunRef = S.fromJsonString(CheckRunRef);
const sameRun = S.toEquivalence(CheckRunRef);
const sameIdentity = S.toEquivalence(CheckRunNativeIdentity);
const sameCorrelation = S.toEquivalence(CheckRunCorrelationOptions);
const JsonNativeIdentity = S.fromJsonString(CheckRunNativeIdentity);
const JsonCorrelation = S.fromJsonString(CheckRunCorrelationOptions);
it.effect.prop(
  "round-trips schema-derived check run references, native identities and correlation through JSON",
  [
    Arbitrary.schema(CheckRunRef),
    Arbitrary.schema(CheckRunNativeIdentity),
    Arbitrary.schema(CheckRunCorrelationOptions),
  ],
  ([run, identity, correlation]) =>
    Effect.gen(function* () {
      const runJson = yield* S.encodeEffect(JsonCheckRunRef)(run);
      const identityJson = yield* S.encodeEffect(JsonNativeIdentity)(identity);
      const correlationJson = yield* S.encodeEffect(JsonCorrelation)(correlation);
      const runAgain = yield* S.decodeEffect(JsonCheckRunRef)(runJson);
      const identityAgain = yield* S.decodeEffect(JsonNativeIdentity)(identityJson);
      const correlationAgain = yield* S.decodeEffect(JsonCorrelation)(correlationJson);
      assert.isTrue(sameRun(runAgain, run));
      assert.isTrue(sameIdentity(identityAgain, identity));
      assert.isTrue(sameCorrelation(correlationAgain, correlation));
    })
);

const ownedHead = "0123456789012345678901234567890123456789";
const nativeOwnedRow = {
  id: 41,
  name: "Owner checkpoint",
  status: "completed",
  html_url: "https://example.invalid/check/41",
  app: { id: 456 },
  applicationId: 999,
  head_sha: ownedHead,
  external_id: "owner-release-1",
  conclusion: "success",
  output: { title: "PRIVATE_UNSELECTED_BODY", summary: "PRIVATE_UNSELECTED_BODY" },
};
const owned = harness([
  { status: 201, body: nativeOwnedRow },
  { status: 201, body: nativeOwnedRow },
]);
it.layer(CheckRun.layer.pipe(Layer.provideMerge(owned.base)), { timeout: "30 seconds" })((it) => {
  it.effect("direct and curried creation bind external metadata without claiming idempotency", () =>
    Effect.gen(function* () {
      const service = yield* CheckRun;
      const options = CheckRunCorrelationOptions.make({ externalId: "owner-release-1" });
      yield* service.create("Owner checkpoint", ownedHead, options);
      yield* service.create(ownedHead, options)("Owner checkpoint");
      const first = yield* S.decodeEffect(JsonRecord)(owned.script.calls[0]?.body ?? "{}");
      const second = yield* S.decodeEffect(JsonRecord)(owned.script.calls[1]?.body ?? "{}");
      assert.strictEqual(first.external_id, "owner-release-1");
      assert.strictEqual(first.head_sha, ownedHead);
      assert.deepStrictEqual(first, second);
    })
  );
});
const ownedRead = harness([{ status: 200, body: nativeOwnedRow }]);
it.layer(CheckRun.layer.pipe(Layer.provideMerge(ownedRead.base)), { timeout: "30 seconds" })((it) => {
  it.effect("native identity uses the same response App and drops unselected output", () =>
    Effect.gen(function* () {
      const service = yield* CheckRun;
      const result = yield* service.get(41);
      assert.deepStrictEqual(
        result.nativeIdentity,
        CheckRunNativeIdentity.make({
          applicationId: 456,
          headSha: ownedHead,
          externalId: "owner-release-1",
          conclusion: "success",
        })
      );
      const serialized = yield* S.encodeEffect(S.fromJsonString(CheckRunRef))(result);
      assert.isFalse(Str.includes("PRIVATE_UNSELECTED_BODY")(serialized));
    })
  );
});
const malformedNative = harness([{ status: 200, body: { ...nativeOwnedRow, head_sha: "short" } }]);
it.layer(CheckRun.layer.pipe(Layer.provideMerge(malformedNative.base)), { timeout: "30 seconds" })((it) => {
  it.effect("malformed native identity is a typed decode failure", () =>
    Effect.gen(function* () {
      const service = yield* CheckRun;
      const error = yield* Effect.flip(service.get(41));
      assert.strictEqual(error.kind, "decode");
      assert.strictEqual(error.operation, "CheckRun.get");
    })
  );
});

const correlatedCompletion = harness([
  { status: 200, body: {} },
  { status: 200, body: {} },
]);
it.layer(CheckRun.layer.pipe(Layer.provideMerge(correlatedCompletion.base)), { timeout: "30 seconds" })((it) => {
  it.effect("release and revocation correlate the same native run in direct and curried calls", () =>
    Effect.gen(function* () {
      const service = yield* CheckRun;
      yield* service.complete(41, "success", undefined, CheckRunCorrelationOptions.make({ externalId: "release-1" }));
      yield* service.complete("failure", undefined, CheckRunCorrelationOptions.make({ externalId: "revoke-2" }))(41);
      const released = yield* S.decodeEffect(JsonRecord)(correlatedCompletion.script.calls[0]?.body ?? "{}");
      const revoked = yield* S.decodeEffect(JsonRecord)(correlatedCompletion.script.calls[1]?.body ?? "{}");
      assert.strictEqual(correlatedCompletion.script.calls[0]?.path, "/repos/acme/widget/check-runs/41");
      assert.strictEqual(correlatedCompletion.script.calls[1]?.path, "/repos/acme/widget/check-runs/41");
      assert.strictEqual(released.external_id, "release-1");
      assert.strictEqual(released.conclusion, "success");
      assert.strictEqual(revoked.external_id, "revoke-2");
      assert.strictEqual(revoked.conclusion, "failure");
    })
  );
});
