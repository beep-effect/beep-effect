import { assert, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as S from "effect/Schema";
import { ActionEnvironment } from "../../../effected/github-actions/ActionEnvironment.ts";
import {
  backendIdsFrom,
  resultsBackend,
  RESULTS_URL,
  RUNTIME_TOKEN,
  misconfiguredDetail,
} from "../../../effected/github-actions/internal/actionsResults.ts";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
  const json = S.fromJsonString(S.Unknown);
  it.effect("rejects unreadable claims and malformed scope entries precisely", () =>
    Effect.gen(function* () {
      for (const claims of [null, [], {}, { scp: 1 }]) {
        const token = `e30.${Base64Url.encode(yield* S.encodeEffect(json)(claims))}.sig`;
        assertFailure(backendIdsFrom(token), "the runtime token carries no `scp` claim");
      }
      for (const scope of [
        "Actions.Results",
        "Actions.Results:run",
        "Actions.Results::job",
        "Actions.Results:run:",
        "Actions.Results:run:job:extra",
      ]) {
        const token = `e30.${Base64Url.encode(yield* S.encodeEffect(json)({ scp: scope }))}.sig`;
        assertFailure(backendIdsFrom(token), `the runtime token's Actions.Results scope is malformed: "${scope}"`);
      }
      const absent = `e30.${Base64Url.encode(yield* S.encodeEffect(json)({ scp: "unrelated" }))}.sig`;
      assertFailure(backendIdsFrom(absent), "the runtime token carries no `Actions.Results` scope");
      const token = `e30.${Base64Url.encode(yield* S.encodeEffect(json)({ scp: "unrelated Actions.Results:run:job trailing" }))}.sig`;
      assertSuccess(backendIdsFrom(token), { workflowRunBackendId: "run", workflowJobRunBackendId: "job" });
    }),
  );
  it.effect("reads missing variables independently and normalizes an existing trailing slash", () =>
    Effect.gen(function* () {
      for (const [values, missing] of [
        [{}, RESULTS_URL],
        [{ ACTIONS_RESULTS_URL: "https://example/" }, RUNTIME_TOKEN],
      ] as const) {
        assertFailure(yield* Effect.result(resultsBackend(yield* ActionEnvironment.makeTest(values))), missing);
      }
      const value = yield* resultsBackend(
        yield* ActionEnvironment.makeTest({ ACTIONS_RESULTS_URL: "https://example/", ACTIONS_RUNTIME_TOKEN: "bad" }),
      );
      assert.strictEqual(value.baseUrl, "https://example/");
      assert.strictEqual(misconfiguredDetail("cache")(RESULTS_URL), misconfiguredDetail(RESULTS_URL, "cache"));
    }),
  );
});
