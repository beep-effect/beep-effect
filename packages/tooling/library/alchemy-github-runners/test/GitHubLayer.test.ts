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
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { FakeHttp } from "./support/FakeHttp.ts";
import { World, worldContext } from "./support/FakeWorld.ts";
import { generatePrivateKeyPem } from "./support/Pem.ts";
import type { FakeAnswer, RecordedRequest } from "./support/FakeHttp.ts";

const runner = (id: number, busy: boolean) =>
  `{"id":${id},"name":"beep-ci-i-0${id}","os":"linux","status":"online","busy":${busy},"labels":[{"id":1,"name":"beep-ec2-heavy","type":"custom"}]}`;

const ok = (body: string, status = 200): FakeAnswer => ({
  status,
  body,
  headers: { "content-type": "application/json" },
});

const responses: Readonly<Record<string, FakeAnswer>> = {
  "GET /orgs/beep-effect/installation": ok('{"id":42}'),
  "GET /repos/beep-effect/beep-effect/installation": ok('{"id":43}'),
  "POST /app/installations/42/access_tokens": ok(
    '{"token":"ghs_installation","expires_at":"2026-11-13T20:00:00Z"}',
    201
  ),
  "GET /repos/beep-effect/beep-effect/actions/jobs/7": ok(
    '{"id":7,"run_id":3,"status":"queued","name":"check","labels":["beep-ec2-heavy"]}'
  ),
  "GET /orgs/beep-effect/actions/runner-groups": ok(
    '{"total_count":1,"runner_groups":[{"id":3,"name":"beep-ec2-heavy","visibility":"selected","default":false}]}'
  ),
  "POST /orgs/beep-effect/actions/runners/generate-jitconfig": ok(
    `{"runner":${runner(11, false)},"encoded_jit_config":"eyJqaXQiOnRydWV9"}`,
    201
  ),
  "POST /orgs/beep-effect/actions/runners/registration-token": ok(
    '{"token":"reg","expires_at":"2026-11-13T20:00:00Z"}',
    201
  ),
  "GET /orgs/beep-effect/actions/runners/11": ok(runner(11, true)),
  "GET /orgs/beep-effect/actions/runners/12": ok('{"message":"Not Found"}', 404),
  "GET /orgs/beep-effect/actions/runners": ok(`{"total_count":2,"runners":[${runner(11, true)},${runner(12, false)}]}`),
  "DELETE /orgs/beep-effect/actions/runners/11": ok('{"message":"Bad request - Runner is busy"}', 422),
  "DELETE /orgs/beep-effect/actions/runners/12": { status: 204, body: "" },
};

const route = (request: RecordedRequest): O.Option<FakeAnswer> =>
  O.fromUndefinedOr(responses[`${request.method} ${request.url.pathname}`]);

const options = GitHubLiveOptions.make({
  app: appParameterNames("/beep-ci"),
  apiBaseUrl: "https://api.github.com",
  userAgent: "beep-test",
});

const run = <A, E>(http: FakeHttp, world: World, program: Effect.Effect<A, E, GitHubAppAuth | GitHubRunners>) =>
  Layer.mergeAll(gitHubAppAuthLive(options), gitHubRunnersLive(options)).pipe(
    Layer.provide(Layer.mergeAll(http.layer, Layer.succeedContext(worldContext(world)))),
    Layer.build,
    Effect.flatMap((context) => program.pipe(Effect.provideContext(context)))
  );

const org = RunnerOwner.make({ type: "Org", owner: "beep-effect" });

describe("live GitHub layers over distilled", () => {
  it.effect("mint an installation token from the SSM-held App key, then drive the runner API", () =>
    Effect.gen(function* () {
      const world = new World();
      const pem = yield* generatePrivateKeyPem;
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
      deepStrictEqual([out.busy, out.gone, out.listed, out.busyStatus], [O.some(true), true, [11, 12], O.some(422)]);
      const authorizations = A.map(http.requests, (request) => Str.split(request.headers.authorization ?? "", " ")[0]);
      expect(A.dedupe(authorizations)).toStrictEqual(["Bearer"]);
      const appCall = A.findFirst(
        http.requests,
        (request) => request.url.pathname === "/orgs/beep-effect/installation"
      );
      deepStrictEqual(
        O.map(appCall, (request) => Str.split(request.headers.authorization ?? "", ".").length),
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
