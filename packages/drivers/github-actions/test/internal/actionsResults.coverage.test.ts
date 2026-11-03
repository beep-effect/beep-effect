import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ActionEnvironment } from "@beep/github-actions/ActionEnvironment";
import {
  BackendIds,
  backendIdsFrom,
  misconfiguredDetail,
  RESULTS_URL,
  ResultsBackend,
  RUNTIME_TOKEN,
  resultsBackend,
} from "@beep/github-actions/internal/actionsResults";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
  const json = S.fromJsonString(S.Unknown);
  it.effect("rejects unreadable claims and malformed scope entries precisely", () =>
    Effect.gen(function* () {
      for (const claims of [null, [], {}, { scp: 1 }]) {
        const value1 = yield* S.encodeEffect(json)(claims);
        const token = `e30.${Base64Url.encode(value1)}.sig`;
        assertFailure(backendIdsFrom(token), "the runtime token carries no `scp` claim");
      }
      for (const scope of [
        "Actions.Results",
        "Actions.Results:run",
        "Actions.Results::job",
        "Actions.Results:run:",
        "Actions.Results:run:job:extra",
      ]) {
        const value2 = yield* S.encodeEffect(json)({ scp: scope });
        const token = `e30.${Base64Url.encode(value2)}.sig`;
        assertFailure(backendIdsFrom(token), `the runtime token's Actions.Results scope is malformed: "${scope}"`);
      }
      const value3 = yield* S.encodeEffect(json)({ scp: "unrelated" });
      const absent = `e30.${Base64Url.encode(value3)}.sig`;
      assertFailure(backendIdsFrom(absent), "the runtime token carries no `Actions.Results` scope");
      const value4 = yield* S.encodeEffect(json)({ scp: "unrelated Actions.Results:run:job trailing" });
      const token = `e30.${Base64Url.encode(value4)}.sig`;
      assertSuccess(
        backendIdsFrom(token),
        BackendIds.make({ workflowRunBackendId: "run", workflowJobRunBackendId: "job" })
      );
    })
  );
  it.effect("reads missing variables independently and normalizes an existing trailing slash", () =>
    Effect.gen(function* () {
      for (const [values, missing] of [
        [{}, RESULTS_URL],
        [{ ACTIONS_RESULTS_URL: "https://example/" }, RUNTIME_TOKEN],
      ] as const) {
        const madeTest9 = yield* ActionEnvironment.makeTest(values);
        const result5 = yield* Effect.result(resultsBackend(madeTest9));
        assertFailure(result5, missing);
      }
      const madeTest = yield* ActionEnvironment.makeTest({
        ACTIONS_RESULTS_URL: "https://example/",
        ACTIONS_RUNTIME_TOKEN: "bad",
      });
      const value = yield* resultsBackend(madeTest);
      assert.strictEqual(value.baseUrl, "https://example/");
      assert.strictEqual(misconfiguredDetail("cache")(RESULTS_URL), misconfiguredDetail(RESULTS_URL, "cache"));
    })
  );
});

it.effect("backend schemas preserve plain objects, redacted tokens, and both scope outcomes", () =>
  Effect.gen(function* () {
    const ids = BackendIds.make({ workflowRunBackendId: "", workflowJobRunBackendId: "job" });
    const value6 = yield* S.decodeEffect(BackendIds)(ids);
    assert.deepStrictEqual(value6, ids);
    const value7 = yield* S.encodeEffect(BackendIds)(ids);
    assert.deepStrictEqual(value7, ids);
    assert.isFalse(S.is(BackendIds)({ workflowRunBackendId: "run" }));
    assert.isFalse(S.is(BackendIds)({ workflowRunBackendId: 1, workflowJobRunBackendId: "job" }));
    for (const backendIds of [Result.succeed(ids), Result.fail("no scope")]) {
      const backend = { baseUrl: "", token: Redacted.make("token"), backendIds } satisfies ResultsBackend.Encoded;
      const decoded = yield* S.decodeEffect(ResultsBackend)(backend);
      assert.deepStrictEqual(decoded, ResultsBackend.make(backend));
      assert.strictEqual(Redacted.value(decoded.token), "token");
      const argument = S.is(ResultsBackend);
      const value5 = yield* S.encodeEffect(ResultsBackend)(ResultsBackend.make(decoded));
      assert.isTrue(argument(value5));
    }
    assert.isFalse(
      S.is(ResultsBackend)({ baseUrl: "https://example/", token: "token", backendIds: Result.succeed(ids) })
    );
    assert.isFalse(S.is(ResultsBackend)({ baseUrl: "https://example/", token: Redacted.make("token") }));
  })
);

describe("BackendIds codec property", () => {
  it.effect.prop(
    "BackendIds round-trips through its codec",
    [Arbitrary.schema(BackendIds)],
    ([value]) =>
      Effect.gen(function* () {
        const argument1 = S.decodeEffect(BackendIds);
        const value9 = yield* S.encodeEffect(BackendIds)(value);
        const value8 = yield* argument1(value9);
        assert.deepStrictEqual(value8, value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
