import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import {
  backendIdsFrom,
  resultsBackend,
  misconfiguredDetail,
} from "../../../effected/github-actions/internal/actionsResults.ts";
import { ActionEnvironment } from "../../../effected/github-actions/ActionEnvironment.ts";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
const runs = { arbitrary: fcRuns(100) };
const identifier = Arbitrary.schema(S.NonEmptyString).pipe(Arbitrary.map(Base64Url.encode));
const claims = S.fromJsonString(S.Struct({ scp: S.String }));
const tokenFor = (run: string, job: string) =>
  Effect.map(
    S.encodeEffect(claims)({ scp: `Actions.Results:${run}:${job}` }),
    (text) => `e30.${Base64Url.encode(text)}.sig`,
  );
it.effect.prop(
  "backend scope parsing preserves both IDs and is stable through canonical serialization",
  [identifier, identifier],
  ([run, job]) =>
    Effect.gen(function* () {
      const parsed = backendIdsFrom(yield* tokenFor(run, job));
      assertSuccess(parsed, { workflowRunBackendId: run, workflowJobRunBackendId: job });
      const ids = Result.getOrThrow(parsed);
      assertSuccess(backendIdsFrom(yield* tokenFor(ids.workflowRunBackendId, ids.workflowJobRunBackendId)), ids);
    }),
  runs,
);
it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "results URL normalization is idempotent and preserves the backend and token scope",
    [identifier, identifier],
    ([run, job]) =>
      Effect.gen(function* () {
        const token = yield* tokenFor(run, job);
        const read = (url: string) =>
          Effect.flatMap(
            ActionEnvironment.makeTest({ ACTIONS_RESULTS_URL: url, ACTIONS_RUNTIME_TOKEN: token }),
            resultsBackend,
          );
        const first = yield* read(`https://example/${run}`);
        const second = yield* read(first.baseUrl);
        assert.strictEqual(first.baseUrl, `https://example/${run}/`);
        assert.strictEqual(second.baseUrl, first.baseUrl);
        assertSuccess(second.backendIds, { workflowRunBackendId: run, workflowJobRunBackendId: job });
      }),
    runs,
  );
});
it.effect.prop(
  "misconfiguration formatting preserves arbitrary variable and service text",
  [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
  ([variable, service]) =>
    Effect.sync(() => {
      const rendered = misconfiguredDetail(variable, service);
      assert.strictEqual(
        rendered,
        `${variable} is not set — the ${service} is only reachable from a \`uses:\` step, never from \`run:\``,
      );
      assert.strictEqual(misconfiguredDetail(service)(variable), rendered);
    }),
  runs,
);

it.effect.prop(
  "canonical misconfiguration diagnostics are idempotent through parsing and preserve both fields",
  [identifier, identifier],
  ([variable, service]) =>
    Effect.gen(function* () {
      const fields = S.Struct({ variable: S.String, service: S.String });
      // These canonical identifiers contain neither sentence delimiter. The inverse reads the actual renderer output.
      const parseDiagnostic = (text: string) => {
        const match = /^(.*?) is not set — the (.*?) is only reachable from a `uses:` step, never from `run:`$/s.exec(
          text,
        );
        return S.decodeUnknownEffect(fields)({ variable: match?.[1], service: match?.[2] });
      };
      const formatDiagnostic = (value: typeof fields.Type) => misconfiguredDetail(value.variable, value.service);
      const text = formatDiagnostic({ variable, service });
      const parsed = yield* parseDiagnostic(text);
      assert.deepStrictEqual(parsed, { variable, service });
      const reformatted = formatDiagnostic(parsed);
      assert.strictEqual(reformatted, text);
      assert.strictEqual(formatDiagnostic(yield* parseDiagnostic(reformatted)), reformatted);
      assert.deepStrictEqual(yield* parseDiagnostic(reformatted), parsed);
    }),
  runs,
);
