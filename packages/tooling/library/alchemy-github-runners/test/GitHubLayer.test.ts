import {
  AppSigningKey,
  appKeyCanSign,
  appParameterNames,
  classifyFailure,
  GitHubAppAuth,
  GitHubLiveOptions,
  GitHubRunners,
  gitHubAppAuthLive,
  gitHubRunnersLive,
  InstallationToken,
  JitConfigRequest,
  RunnerOwner,
  toGitHubApiError,
} from "@beep/alchemy-github-runners";
import * as GitHubRetry from "@distilled.cloud/github/Retry";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
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
  "POST /repos/beep-effect/beep-effect/actions/runners/generate-jitconfig": ok(
    `{"runner":${runner(21, false)},"encoded_jit_config":"cmVwbw=="}`,
    201
  ),
  "POST /repos/beep-effect/beep-effect/actions/runners/registration-token": ok(
    '{"token":"repo-reg","expires_at":"2026-11-13T20:00:00Z"}',
    201
  ),
  "GET /repos/beep-effect/beep-effect/actions/runners/21": ok(runner(21, false)),
  "GET /repos/beep-effect/beep-effect/actions/runners": ok(`{"total_count":1,"runners":[${runner(21, false)}]}`),
  "DELETE /repos/beep-effect/beep-effect/actions/runners/21": { status: 204, body: "" },
  "GET /repos/beep-effect/beep-effect/actions/jobs/8": {
    status: 403,
    body: '{"message":"API rate limit exceeded for installation ID 42."}',
    headers: { "content-type": "application/json", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "0" },
  },
  "GET /repos/beep-effect/beep-effect/actions/jobs/9": ok('{"message":"Resource not accessible by integration"}', 403),
  "GET /repos/beep-effect/beep-effect/actions/jobs/10": {
    status: 403,
    body: '{"message":"Forbidden"}',
    headers: { "content-type": "application/json", "retry-after": "60" },
  },
  "GET /repos/beep-effect/beep-effect/actions/jobs/11": ok('{"message":"Too Many Requests"}', 429),
  "GET /repos/beep-effect/beep-effect/actions/jobs/12": ok(
    '{"message":"You have exceeded a secondary rate limit. Please wait a few minutes before you try again."}',
    403
  ),
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

  it.effect("drives the runner API of a repository-owned pool", () =>
    Effect.gen(function* () {
      const token = InstallationToken.make({ installationId: 43, token: Redacted.make("ghs_installation") });
      const repo = RunnerOwner.make({ type: "Repo", owner: "beep-effect/beep-effect" });
      const http = new FakeHttp(route);
      const out = yield* run(
        http,
        new World(),
        Effect.gen(function* () {
          const github = yield* GitHubRunners;
          const jit = yield* github.generateJitConfig(
            token,
            JitConfigRequest.make({ owner: repo, name: "beep-ci-i-021", runnerGroupId: 1, labels: ["beep-ec2-heavy"] })
          );
          const registration = yield* github.registrationToken(token, repo);
          const single = yield* github.getRunner(token, repo, 21);
          const listed = yield* github.listRunners(token, repo);
          yield* github.deleteRunner(token, repo, 21);
          return {
            jit: [jit.runnerId, Redacted.value(jit.encodedJitConfig)] as const,
            registration: Redacted.value(registration),
            single: O.map(single, (value) => value.id),
            listed: A.map(listed, (value) => value.id),
          };
        })
      );
      deepStrictEqual(out, {
        jit: [21, "cmVwbw=="] as const,
        registration: "repo-reg",
        single: O.some(21),
        listed: [21],
      });
    })
  );

  it.effect("refuses an App key that is not base64, and one that is not a private key", () =>
    Effect.gen(function* () {
      const failureFor = Effect.fn("appKeyFailure")(function* (key: string) {
        const world = new World();
        world.ssm["/beep-ci/app/github_app_id"] = { value: "123456", modified: 0, tags: {} };
        world.ssm["/beep-ci/app/github_app_key_base64"] = { value: key, modified: 0, tags: {} };
        const error = yield* run(
          new FakeHttp(route),
          world,
          Effect.gen(function* () {
            const app = yield* GitHubAppAuth;
            return yield* app.installationFor(org);
          })
        ).pipe(Effect.flip);
        return error.message;
      });
      const notBase64 = yield* failureFor("%%%");
      const notPem = yield* failureFor(Base64.encode("not a pem"));
      expect([notBase64, Str.isNonEmpty(notPem)]).toStrictEqual(["App key parameter is not base64", true]);
    })
  );

  it("decides an unmapped GitHub error by its own status, and keeps the status of a mapped one", () => {
    const map = toGitHubApiError("generateJitConfig");
    const rows = A.map(
      [
        map({ _tag: "UnknownGithubError", message: "gone", status: 410 } as { _tag: string; message: string }),
        map({ _tag: "UnknownGithubError", message: "unavailable", status: 503 } as { _tag: string; message: string }),
        map({ _tag: "UnknownGithubError", message: "no status" }),
        map({ _tag: "UnknownGithubError", message: "text status", status: "410" } as { _tag: string; message: string }),
        map({ _tag: "UnknownGithubError", message: "fraction", status: 410.5 } as { _tag: string; message: string }),
        map({ _tag: "Forbidden", message: "Resource not accessible", status: 503 } as {
          _tag: string;
          message: string;
        }),
        map({ _tag: "Forbidden", message: { text: "rate limit" } }),
        map({ _tag: "SocketError", message: { reason: "reset" } }),
      ],
      (error) => [error.status, error.rateLimited, error.message, classifyFailure("generateJitConfig")(error)] as const
    );
    deepStrictEqual(
      rows,
      [
        [O.some(410), false, "gone", "deterministic"],
        [O.some(503), false, "unavailable", "transient"],
        [O.none(), false, "no status", "transient"],
        [O.none(), false, "text status", "transient"],
        [O.none(), false, "fraction", "transient"],
        [O.some(403), false, "Resource not accessible", "deterministic"],
        [O.some(403), false, "Forbidden", "deterministic"],
        [O.none(), false, "SocketError", "transient"],
      ],
      "a mapped tag keeps its mapped status; a non-text message is read by its tag, never as a rate limit"
    );
  });

  it.effect("reads every page of runner groups, and a missing group only after the last one", () =>
    Effect.gen(function* () {
      const token = InstallationToken.make({ installationId: 42, token: Redacted.make("ghs_installation") });
      const group = (id: number, name: string) =>
        `{"id":${id},"name":"${name}","visibility":"selected","default":false}`;
      const pages = (second: FakeAnswer) =>
        new FakeHttp((request) =>
          request.url.pathname === "/orgs/beep-effect/actions/runner-groups"
            ? O.some(
                request.url.searchParams.get("page") === "2"
                  ? second
                  : {
                      status: 200,
                      body: `{"total_count":101,"runner_groups":[${A.join(
                        A.makeBy(100, (index) => group(index + 1, `group-${index + 1}`)),
                        ","
                      )}]}`,
                      headers: {
                        "content-type": "application/json",
                        link: '<https://api.github.com/orgs/beep-effect/actions/runner-groups?per_page=100&page=2>; rel="next"',
                      },
                    }
              )
            : O.none()
        );
      const lookup = (http: FakeHttp, groupName: string) =>
        run(
          http,
          new World(),
          Effect.gen(function* () {
            const github = yield* GitHubRunners;
            return yield* github.runnerGroupId(token, "beep-effect", groupName);
          }).pipe(GitHubRetry.none)
        );
      const secondPage = ok(`{"total_count":101,"runner_groups":[${group(101, "beep-ec2-heavy")}]}`);
      const found = yield* lookup(pages(secondPage), "beep-ec2-heavy");
      expect(found).toBe(101);
      const missing = yield* lookup(pages(secondPage), "nope").pipe(Effect.flip);
      deepStrictEqual(
        [missing.status, missing.message, classifyFailure("resolveRunnerGroup")(missing)],
        [O.some(404), "Runner group nope does not exist", "deterministic"]
      );
      const broken = yield* lookup(pages(ok('{"message":"Service Unavailable"}', 503)), "nope").pipe(Effect.flip);
      deepStrictEqual(
        [broken.status, broken.code, classifyFailure("resolveRunnerGroup")(broken)],
        [O.some(503), O.some("ServiceUnavailable"), "transient"]
      );
      expect(Str.includes("does not exist")(broken.message)).toBe(false);
    })
  );

  it.effect("counts a job as taken only once it started or ended, and logs every status but queued", () =>
    Effect.gen(function* () {
      const token = InstallationToken.make({ installationId: 42, token: Redacted.make("ghs_installation") });
      const statuses = ["queued", "in_progress", "completed", "waiting", "requested", "pending"];
      const lines: Array<{ readonly level: string; readonly message: unknown; readonly annotations: unknown }> = [];
      const capture = Logger.map(Logger.formatStructured, (line) => {
        lines.push(line);
      });
      const loggers = yield* Layer.build(Logger.layer([capture]));
      const answers = yield* run(
        new FakeHttp((request) =>
          O.map(A.get(statuses, Number(Str.slice(-1)(request.url.pathname))), (status) =>
            ok(`{"id":1,"run_id":3,"status":"${status}","name":"check","labels":["beep-ec2-heavy"]}`)
          )
        ),
        new World(),
        Effect.gen(function* () {
          const github = yield* GitHubRunners;
          return yield* Effect.forEach(
            statuses,
            (_, jobId) => github.isJobQueued(token, { owner: "beep-effect", repo: "beep-effect", jobId }),
            { concurrency: 1 }
          );
        })
      ).pipe(Effect.provideContext(loggers));
      deepStrictEqual(A.zip(statuses, answers), [
        ["queued", true],
        ["in_progress", false],
        ["completed", false],
        ["waiting", true],
        ["requested", true],
        ["pending", true],
      ]);
      const line = (jobId: number, status: string, queued: boolean) => ({
        level: "INFO",
        message: "github: the job's status is not queued",
        annotations: { jobId, repository: "beep-effect/beep-effect", status, queued },
      });
      deepStrictEqual(
        A.map(lines, ({ level, message, annotations }) => ({ level, message, annotations })),
        [
          line(1, "in_progress", false),
          line(2, "completed", false),
          line(3, "waiting", true),
          line(4, "requested", true),
          line(5, "pending", true),
        ]
      );
    })
  );

  it.effect(
    "reads a 403 or 429 rate limit (remaining 0, retry-after, 429, secondary) as transient, a 403 refusal as deterministic",
    () =>
      Effect.gen(function* () {
        const token = InstallationToken.make({ installationId: 42, token: Redacted.make("ghs_installation") });
        const errors = yield* run(
          new FakeHttp(route),
          new World(),
          Effect.gen(function* () {
            const github = yield* GitHubRunners;
            return yield* Effect.forEach(
              [8, 10, 11, 12, 9],
              (jobId) =>
                github.isJobQueued(token, { owner: "beep-effect", repo: "beep-effect", jobId }).pipe(Effect.flip),
              { concurrency: 1 }
            );
          }).pipe(GitHubRetry.none)
        );
        deepStrictEqual(
          A.map(
            errors,
            (error) => [error.rateLimited, error.code, classifyFailure("generateJitConfig")(error)] as const
          ),
          [
            [true, O.some("TooManyRequests"), "transient"],
            [true, O.some("TooManyRequests"), "transient"],
            [true, O.some("TooManyRequests"), "transient"],
            [true, O.some("TooManyRequests"), "transient"],
            [false, O.some("Forbidden"), "deterministic"],
          ],
          "a primary-limit 403, a 403 with retry-after, a 429 and a hintless secondary limit are rate limits; a refusal is not"
        );
        expect(
          A.map(
            [
              toGitHubApiError("jit")({ _tag: "Forbidden", message: "You have exceeded a secondary rate limit." }),
              toGitHubApiError("jit")({ _tag: "Forbidden", message: "Resource not accessible by integration" }),
            ],
            classifyFailure("generateJitConfig")
          )
        ).toStrictEqual(["transient", "deterministic"]);
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

describe("appKeyCanSign", () => {
  it.effect("signs with a real RSA key and refuses a PEM-shaped key that cannot sign", () =>
    Effect.gen(function* () {
      const pem = yield* generatePrivateKeyPem;
      const real = yield* appKeyCanSign(AppSigningKey.make({ appId: "12345", privateKeyPem: Redacted.make(pem) }));
      expect(real).toBe(true);
      const label = A.join(["PRIVATE", "KEY"], " ");
      const shaped = `-----BEGIN ${label}-----\n${Str.repeat(64)("A")}\n-----END ${label}-----\n`;
      const fake = yield* appKeyCanSign(AppSigningKey.make({ appId: "12345", privateKeyPem: Redacted.make(shaped) }));
      expect(fake).toBe(false);
      const none = yield* appKeyCanSign(
        AppSigningKey.make({ appId: "12345", privateKeyPem: Redacted.make("not a key") })
      );
      expect(none).toBe(false);
    })
  );
});
