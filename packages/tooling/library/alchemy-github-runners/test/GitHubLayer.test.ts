import {
  appParameterNames,
  GitHubAppAuth,
  GitHubLiveOptions,
  GitHubRunners,
  gitHubAppAuthLive,
  gitHubRunnersLive,
  JitConfigRequest,
  RunnerOwner,
} from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { FakeHttp } from "./support/FakeHttp.ts";
import { World, worldContext } from "./support/FakeWorld.ts";
import type { FakeAnswer, RecordedRequest } from "./support/FakeHttp.ts";

const runner = (id: number, busy: boolean) =>
  `{"id":${id},"name":"beep-ci-i-0${id}","os":"linux","status":"online","busy":${busy},"labels":[{"id":1,"name":"beep-ec2-heavy","type":"custom"}]}`;

const ok = (body: string, status = 200): FakeAnswer => ({
  status,
  body,
  headers: { "content-type": "application/json" },
});

const route = (request: RecordedRequest): O.Option<FakeAnswer> => {
  const path = request.url.pathname;
  const key = `${request.method} ${path}`;
  switch (key) {
    case "GET /orgs/beep-effect/installation":
      return O.some(ok('{"id":42}'));
    case "GET /repos/beep-effect/beep-effect/installation":
      return O.some(ok('{"id":43}'));
    case "POST /app/installations/42/access_tokens":
      return O.some(ok('{"token":"ghs_installation","expires_at":"2026-11-13T20:00:00Z"}', 201));
    case "GET /repos/beep-effect/beep-effect/actions/jobs/7":
      return O.some(ok('{"id":7,"run_id":3,"status":"queued","name":"check","labels":["beep-ec2-heavy"]}'));
    case "GET /orgs/beep-effect/actions/runner-groups":
      return O.some(
        ok(
          '{"total_count":1,"runner_groups":[{"id":3,"name":"beep-ec2-heavy","visibility":"selected","default":false}]}'
        )
      );
    case "POST /orgs/beep-effect/actions/runners/generate-jitconfig":
      return O.some(ok(`{"runner":${runner(11, false)},"encoded_jit_config":"eyJqaXQiOnRydWV9"}`, 201));
    case "POST /orgs/beep-effect/actions/runners/registration-token":
      return O.some(ok('{"token":"reg","expires_at":"2026-11-13T20:00:00Z"}', 201));
    case "GET /orgs/beep-effect/actions/runners/11":
      return O.some(ok(runner(11, true)));
    case "GET /orgs/beep-effect/actions/runners/12":
      return O.some(ok('{"message":"Not Found"}', 404));
    case "GET /orgs/beep-effect/actions/runners":
      return O.some(ok(`{"total_count":2,"runners":[${runner(11, true)},${runner(12, false)}]}`));
    case "DELETE /orgs/beep-effect/actions/runners/11":
      return O.some(ok('{"message":"Bad request - Runner is busy"}', 422));
    case "DELETE /orgs/beep-effect/actions/runners/12":
      return O.some({ status: 204, body: "" });
  }
  return O.none();
};

const generatePem = Effect.gen(function* () {
  const pair = yield* Effect.promise(() =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    )
  );
  const der = yield* Effect.promise(() => crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return `-----BEGIN PRIVATE KEY-----\n${Base64.encode(new Uint8Array(der))}\n-----END PRIVATE KEY-----\n`;
});

const options = GitHubLiveOptions.make({
  app: appParameterNames("/beep-ci"),
  apiBaseUrl: "https://api.github.com",
  userAgent: "beep-test",
});

const run = <A, E>(http: FakeHttp, world: World, program: Effect.Effect<A, E, GitHubAppAuth | GitHubRunners>) =>
  Layer.mergeAll(gitHubAppAuthLive(options), gitHubRunnersLive(options)).pipe(
    Layer.provide(Layer.mergeAll(http.layer, Layer.succeedContext(worldContext(world)))),
    Layer.build,
    Effect.flatMap((context) => program.pipe(Effect.provideContext(context))),
    Effect.scoped
  );

const org = RunnerOwner.make({ type: "Org", owner: "beep-effect" });

describe("live GitHub layers over distilled", () => {
  it.effect("mint an installation token from the SSM-held App key, then drive the runner API", () =>
    Effect.gen(function* () {
      const world = new World();
      const pem = yield* generatePem;
      world.ssm["/beep-ci/app/github_app_id"] = { value: "123456", modified: 0, tags: {} };
      world.ssm["/beep-ci/app/github_app_key_base64"] = { value: Base64.encode(pem), modified: 0, tags: {} };
      const http = new FakeHttp(route);
      const out = yield* run(
        http,
        world,
        Effect.gen(function* () {
          const app = yield* GitHubAppAuth;
          const runners = yield* GitHubRunners;
          const installationId = yield* app.installationFor(org);
          const repoInstallation = yield* app.installationFor(
            RunnerOwner.make({ type: "Repo", owner: "beep-effect/beep-effect" })
          );
          const token = yield* app.installationToken(installationId);
          const queued = yield* runners.isJobQueued(token, { owner: "beep-effect", repo: "beep-effect", jobId: 7 });
          const groupId = yield* runners.runnerGroupId(token, "beep-effect", "beep-ec2-heavy");
          const missingGroup = yield* Effect.flip(runners.runnerGroupId(token, "beep-effect", "nope"));
          const jit = yield* runners.generateJitConfig(
            token,
            JitConfigRequest.make({
              owner: org,
              name: "beep-ci-i-011",
              runnerGroupId: groupId,
              labels: ["beep-ec2-heavy"],
            })
          );
          const registration = yield* runners.registrationToken(token, org);
          const busy = yield* runners.getRunner(token, org, 11);
          const gone = yield* runners.getRunner(token, org, 12);
          const listed = yield* runners.listRunners(token, org);
          const busyDelete = yield* Effect.flip(runners.deleteRunner(token, org, 11));
          yield* runners.deleteRunner(token, org, 12);
          return {
            ids: [installationId, repoInstallation, token.installationId, groupId, jit.runnerId],
            token: Redacted.value(token.token),
            queued,
            missingGroup: missingGroup.message,
            jit: Redacted.value(jit.encodedJitConfig),
            registration: Redacted.value(registration),
            busy: O.map(busy, (value) => value.busy),
            gone: O.isNone(gone),
            listed: A.map(listed, (value) => value.id),
            busyStatus: busyDelete.status,
          };
        })
      );
      expect(out.ids).toStrictEqual([42, 43, 42, 3, 11]);
      expect([out.token, out.queued, out.missingGroup, out.jit, out.registration]).toStrictEqual([
        "ghs_installation",
        true,
        "Runner group nope does not exist",
        "eyJqaXQiOnRydWV9",
        "reg",
      ]);
      expect([out.busy, out.gone, out.listed, out.busyStatus]).toStrictEqual([
        O.some(true),
        true,
        [11, 12],
        O.some(422),
      ]);
      const authorizations = A.map(http.requests, (request) => Str.split(request.headers.authorization ?? "", " ")[0]);
      expect(A.dedupe(authorizations)).toStrictEqual(["Bearer"]);
      const appCall = A.findFirst(
        http.requests,
        (request) => request.url.pathname === "/orgs/beep-effect/installation"
      );
      expect(O.map(appCall, (request) => Str.split(request.headers.authorization ?? "", ".").length)).toStrictEqual(
        O.some(3)
      );
    })
  );

  it.effect("report a missing App parameter as GitHubAppAuthError", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        run(
          new FakeHttp(route),
          new World(),
          Effect.gen(function* () {
            const app = yield* GitHubAppAuth;
            return yield* app.installationToken(42);
          })
        )
      );
      expect(error._tag).toBe("GitHubAppAuthError");
    })
  );
});
