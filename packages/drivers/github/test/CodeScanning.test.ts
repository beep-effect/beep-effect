import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CodeScanning, CodeScanningSetup } from "@beep/github/CodeScanning";
import { GitHubClient, RecordedCall } from "@beep/github/GitHubClient";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

describe("CodeScanning", () => {
  {
    const requested: RecordedCall[] = [];
    it.layer(
      CodeScanning.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            GitHubClient.layerFixture({
              request: { "PATCH /repos/{owner}/{repo}/code-scanning/default-setup": Result.succeed({}) },
              requested,
            }),
            Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
          )
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("configure sends only the keys the caller set", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(CodeScanning, (cs) => cs.configure({ state: "configured", languages: ["go"] }));

          assert.deepStrictEqual(requested, [
            RecordedCall.make({
              kind: "request",
              route: "PATCH /repos/{owner}/{repo}/code-scanning/default-setup",
              params: { owner: "acme", repo: "widget", state: "configured", languages: ["go"] },
            }),
          ]);
        })
      );
    });
  }

  {
    const requested: RecordedCall[] = [];
    it.layer(
      CodeScanning.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            GitHubClient.layerFixture({
              request: { "PATCH /repos/{owner}/{repo}/code-scanning/default-setup": Result.succeed({}) },
              requested,
            }),
            Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
          )
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("configure sends every key when every key is set", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(CodeScanning, (cs) =>
            cs.configure({
              state: "configured",
              languages: ["javascript-typescript"],
              query_suite: "extended",
              threat_model: "remote_and_local",
              runner_type: "labeled",
              runner_label: "big",
            })
          );

          assert.deepStrictEqual(requested[0]?.params, {
            owner: "acme",
            repo: "widget",
            state: "configured",
            languages: ["javascript-typescript"],
            query_suite: "extended",
            threat_model: "remote_and_local",
            runner_type: "labeled",
            runner_label: "big",
          });
        })
      );
    });
  }

  {
    const requested: RecordedCall[] = [];
    it.layer(
      CodeScanning.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            GitHubClient.layerFixture({
              request: { "GET /repos/{owner}/{repo}/languages": Result.succeed({ TypeScript: 12000, Go: 300 }) },
              requested,
            }),
            Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
          )
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("languages returns the names, in GitHub's order", () =>
        Effect.gen(function* () {
          const value = yield* Effect.flatMap(CodeScanning, (cs) => cs.languages);

          assert.deepStrictEqual(value, ["TypeScript", "Go"]);
          assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
        })
      );
    });
  }

  {
    const requested: RecordedCall[] = [];
    it.layer(
      CodeScanning.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            GitHubClient.layerFixture({
              request: { "GET /repos/{owner}/{repo}/languages": Result.succeed({}) },
              requested,
            }),
            Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
          )
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("resolves Repo per call, so a scoped override is honoured", () =>
        Effect.gen(function* () {
          const cs = yield* CodeScanning;
          yield* cs.languages;
          yield* cs.languages.pipe(Repo.provide(RepoRef.make({ owner: "other", repo: "thing" })));

          assert.deepStrictEqual(
            A.map(requested, (call) => call.params),
            [
              { owner: "acme", repo: "widget" },
              { owner: "other", repo: "thing" },
            ]
          );
        })
      );
    });
  }
});

describe("CodeScanningSetup", () => {
  it.effect("preserves omitted keys and rejects explicit undefined keys", () =>
    Effect.gen(function* () {
      const omitted = yield* S.decodeEffect(CodeScanningSetup)({});
      assert.deepStrictEqual<CodeScanningSetup.Encoded>(omitted, {});
      const value1 = yield* S.encodeEffect(CodeScanningSetup)(omitted);
      assert.deepStrictEqual(value1, {});
      const explicit = yield* Effect.exit(S.decodeUnknownEffect(CodeScanningSetup)({ runner_label: undefined }));
      explicit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("retains open language and configuration string inputs", () =>
    Effect.gen(function* () {
      const input = {
        state: "configured" as const,
        languages: ["future-language"],
        query_suite: "future-suite",
        threat_model: "future-model",
        runner_type: "future-runner",
        runner_label: "custom runner",
      };
      const value = yield* S.decodeEffect(CodeScanningSetup)(input);
      assert.deepStrictEqual<CodeScanningSetup.Encoded>(value, input);
      const value2 = yield* S.encodeEffect(CodeScanningSetup)(value);
      assert.deepStrictEqual(value2, input);
    })
  );
});

it.effect.prop(
  "CodeScanningSetup preserves every encoded value",
  [Arbitrary.schema(CodeScanningSetup)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CodeScanningSetup)(value);
      const decoded = yield* S.decodeEffect(CodeScanningSetup)(encoded);
      assert.isTrue(S.toEquivalence(CodeScanningSetup)(decoded, value));
      const value3 = yield* S.encodeEffect(CodeScanningSetup)(decoded);
      assert.deepStrictEqual(value3, encoded);
    }),
  { arbitrary: fcRuns(100) }
);
