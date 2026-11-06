import * as Cloudflare from "@alchemy.run/cloudflare";
import type * as Core from "@alchemy.run/test/Core";
import * as Test from "@alchemy.run/test/Vitest";
import { expect } from "@effect/vitest";
import type { Input } from "alchemy/Input";
import type { StackServices } from "alchemy/Stack";
import * as State from "alchemy/State";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";

import { handoffToken } from "../token.js";
import TurboCache from "./fixtures/cartridge.js";
import CacheFixture from "./fixtures/worker.js";

const { test } = Test.make({
  dev: true,
  providers: Cloudflare.providers(),
  sidecar: false,
  stage: `turbo_cache_runtime_${process.pid}`,
});

type ScratchStack = Test.ScratchStack;

/** The failures Alchemy's own top-level `deploy` declares for a stack deployment. */
type DeployError = Effect.Error<Core.DeployResult<unknown>>;

/**
 * `ScratchStack.deploy` erases its error channel to `any`. This signature
 * restates the deployment failures Alchemy declares for its top-level `deploy`
 * plus the stack definition's own `E`, so no erased channel reaches a test.
 */
type ScratchDeploy = <A, E, R>(
  definition: Effect.Effect<A, E, R>,
) => Effect.Effect<Input.Resolve<A>, DeployError | E, Exclude<R, StackServices>>;

const deployerOf = (stack: ScratchStack): ScratchDeploy => stack.deploy;

const deploy = <A, E, R>(stack: ScratchStack, definition: Effect.Effect<A, E, R>) =>
  deployerOf(stack)(definition);

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const Byte = S.Int.check(S.isBetween({ maximum: 255, minimum: 0 }));

const Case = S.Struct({
  bytes: S.Array(Byte).check(S.isMaxLength(1024)),
  duration: S.Int.check(S.isBetween({ maximum: 1_000_000, minimum: 0 })),
  hash: S.Int.check(S.isBetween({ maximum: 2_147_483_647, minimum: 0 })),
});

const deployFixture = Effect.fn("TurboCacheTest.deployFixture")(function* deployFixture(
  stack: ScratchStack,
) {
  const deployment = yield* deploy(stack, CacheFixture);
  return yield* Effect.fromNullishOr(deployment.url);
}, Effect.orDie);

const request = (
  url: URL,
  method: "GET" | "HEAD" | "PUT" | "POST",
  token: string,
  bytes?: Uint8Array,
  duration = 0,
) => {
  const base = HttpClientRequest.make(method)(url).pipe(
    HttpClientRequest.setHeaders({
      authorization: `Bearer ${token}`,
      "x-artifact-duration": String(duration),
      "x-artifact-tag": "test-signature",
    }),
  );

  return HttpClient.execute(
    bytes === undefined ? base : base.pipe(HttpClientRequest.bodyUint8Array(bytes)),
  );
};

const statusOf = (
  url: URL,
  method: "GET" | "HEAD" | "PUT" | "POST",
  token: string,
  bytes?: Uint8Array,
) => request(url, method, token, bytes).pipe(Effect.map((response) => response.status));

const authEndpoints = (path: string) =>
  [
    ["GET", path],
    ["HEAD", path],
    ["PUT", path],
    ["GET", "/v8/artifacts/status"],
    ["POST", "/v8/artifacts/events"],
    ["POST", "/v8/artifacts"],
  ] as const;

test.provider(
  "streams generated artifacts, isolates teams, and refuses unauthorized storage access",
  (stack) =>
    Effect.gen(function* protocolProperty() {
      const origin = yield* deployFixture(stack);
      const iteration = yield* Ref.make(0);

      const checked = yield* Arbitrary.checkEffect(
        Arbitrary.schema(Case),
        ({ bytes, hash, duration }) =>
          Effect.gen(function* roundtrip() {
            const payload = new Uint8Array(bytes);
            const id = yield* Ref.updateAndGet(iteration, (value) => value + 1);
            const artifactHash = `${id}-${hash.toString(16)}`;
            const path = `/v8/artifacts/${artifactHash}`;
            const alpha = new URL(`${path}?slug=alpha`, origin);
            const beta = new URL(`${path}?slug=beta`, origin);

            const put = yield* request(alpha, "PUT", "test-only-alpha", payload, duration);
            expect(put.status).toBe(200);

            const get = yield* request(alpha, "GET", "test-only-alpha");
            expect(get.status).toBe(200);
            const body = yield* get.arrayBuffer;
            expect(new Uint8Array(body)).toEqual(payload);
            expect(get.headers["x-artifact-duration"]).toBe(String(duration));
            expect(get.headers["x-artifact-tag"]).toBe("test-signature");

            const head = yield* request(alpha, "HEAD", "test-only-alpha");
            expect(head.status).toBe(get.status);
            expect(head.headers["content-length"]).toBe(String(payload.length));
            expect(head.headers["x-artifact-duration"]).toBe(get.headers["x-artifact-duration"]);
            expect(head.headers["x-artifact-tag"]).toBe(get.headers["x-artifact-tag"]);
            const headBody = yield* head.text;
            expect(headBody).toBe("");

            const queryBody = yield* encodeJson({ hashes: [artifactHash] });
            const query = yield* request(
              new URL("/v8/artifacts?slug=alpha", origin),
              "POST",
              "test-only-alpha",
              new TextEncoder().encode(queryBody),
            );
            const queried = yield* query.json;
            expect(queried).toEqual({
              [artifactHash]: { size: payload.length, taskDurationMs: duration },
            });

            const betaGet = yield* statusOf(beta, "GET", "test-only-beta");
            expect(betaGet).toBe(404);
            const betaHead = yield* statusOf(beta, "HEAD", "test-only-beta");
            expect(betaHead).toBe(404);
            const betaPut = yield* statusOf(beta, "PUT", "test-only-beta", new Uint8Array([1]));
            expect(betaPut).toBe(200);

            const preserved = yield* request(alpha, "GET", "test-only-alpha");
            const preservedBody = yield* preserved.arrayBuffer;
            expect(new Uint8Array(preservedBody)).toEqual(payload);

            yield* Effect.forEach(
              authEndpoints(path),
              ([method, endpoint]) =>
                Effect.gen(function* refusesUnauthorized() {
                  const auth = new URL(`/auth-proof${endpoint}?slug=alpha`, origin);
                  const wrongToken = yield* statusOf(auth, method, `wrong-${hash}`);
                  expect(wrongToken).toBe(401);
                  const anonymous = yield* HttpClient.execute(HttpClientRequest.make(method)(auth));
                  expect(anonymous.status).toBe(401);
                  auth.search = "?slug=beta";
                  const otherTeam = yield* statusOf(auth, method, "test-only-alpha");
                  expect(otherTeam).toBe(403);
                  auth.search = "?slug=unknown";
                  const unknownTeam = yield* statusOf(auth, method, "test-only-alpha");
                  expect(unknownTeam).toBe(403);
                }),
              { discard: true },
            );

            return true;
          }).pipe(Effect.scoped, Effect.orDie),
        { maxShrinks: 5, runs: 30 },
      );

      expect(Arbitrary.formatCheckFailure(checked)).toBeUndefined();

      yield* Effect.forEach(
        ["/", "/ping", "/throw-exception", "/internal/count", "/v8/artifacts/status/"],
        (path) =>
          HttpClient.get(new URL(path, origin)).pipe(
            Effect.map((response) => expect(response.status).toBe(404)),
          ),
        { discard: true },
      );

      yield* Effect.forEach(
        ["", "?slug=alpha&slug=alpha", "?slug=alpha&teamId=ignored", "?slug=bad.slug"],
        (suffix) =>
          statusOf(new URL(`/auth-proof/v8/artifacts/abc${suffix}`, origin), "GET", "test-only-alpha").pipe(
            Effect.map((status) => expect(status).toBe(403)),
          ),
        { discard: true },
      );

      yield* Effect.forEach(
        ["bad.hash", "bad%2Fhash", "bad%2Bhash", "bad%20hash"],
        (hash) =>
          statusOf(new URL(`/auth-proof/v8/artifacts/${hash}?slug=alpha`, origin), "GET", "test-only-alpha").pipe(
            Effect.map((status) => expect(status).toBe(404)),
          ),
        { discard: true },
      );

      const invalidBody = yield* encodeJson({ hashes: ["bad/hash"] });
      const invalidQuery = yield* statusOf(
        new URL("/auth-proof/v8/artifacts?slug=alpha", origin),
        "POST",
        "test-only-alpha",
        new TextEncoder().encode(invalidBody),
      );
      expect(invalidQuery).toBe(400);

      const status = yield* request(
        new URL("/v8/artifacts/status?slug=alpha", origin),
        "GET",
        "test-only-alpha",
      );
      const statusBody = yield* status.json;
      expect(statusBody).toEqual({ status: "enabled" });
    }),
  { timeout: 180_000 },
);

test.provider(
  "the pinned Turbo binary gets a remote hit with an empty local cache",
  (stack) =>
    Effect.gen(function* turboSeam() {
      const origin = yield* deployFixture(stack);
      const fs = yield* FileSystem.FileSystem;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const directory = yield* fs.makeTempDirectoryScoped();
      const packageJson = yield* encodeJson({
        name: "cache-protocol-fixture",
        packageManager: "pnpm@11.3.0",
        private: true,
        scripts: { build: "node build.cjs" },
      });
      const turboJson = yield* encodeJson({
        tasks: { build: { inputs: ["build.cjs"], outputs: ["out.txt"] } },
      });
      yield* fs.writeFileString(`${directory}/package.json`, packageJson);
      // pnpm 11 rewrites a non-canonical lockfile before `pnpm run`, and the
      // lockfile is a Turbo global hash input, so the fixture is written in
      // pnpm's canonical form to keep the task hash stable across runs.
      yield* fs.writeFileString(
        `${directory}/pnpm-lock.yaml`,
        "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n\nimporters:\n\n  .: {}\n",
      );
      yield* fs.writeFileString(`${directory}/turbo.json`, turboJson);
      yield* fs.writeFileString(
        `${directory}/build.cjs`,
        "require('node:fs').writeFileSync('out.txt', 'built')\n",
      );

      const turbo = new URL("../../../node_modules/turbo/bin/turbo", import.meta.url).pathname;

      const run = (cache: string, overrides: Readonly<Record<string, string>> = {}) =>
        spawner.string(
          ChildProcess.make(
            process.execPath,
            [turbo, "run", "build", "--cache-dir", `${directory}/${cache}`, "--summarize"],
            {
              cwd: directory,
              env: {
                TURBO_API: origin,
                TURBO_CACHE: "local:rw,remote:rw",
                TURBO_TEAM: "alpha",
                TURBO_TELEMETRY_DISABLED: "1",
                TURBO_TOKEN: "test-only-alpha",
                ...overrides,
              },
              extendEnv: true,
            },
          ),
        );

      const first = yield* run("first-cache");
      expect(first).toContain("0 cached, 1 total");
      yield* fs.remove(`${directory}/out.txt`);
      const second = yield* run("second-cache");
      expect(second).toContain("1 cached, 1 total");
      const restored = yield* fs.readFileString(`${directory}/out.txt`);
      expect(restored).toBe("built");

      const summaries = yield* fs.readDirectory(`${directory}/.turbo/runs`);
      const sources = yield* Effect.forEach(summaries, (file) =>
        fs.readFileString(`${directory}/.turbo/runs/${file}`),
      );
      expect(A.some(sources, Str.includes('"source": "REMOTE"'))).toBe(true);

      const writeOnly = yield* run("second-cache", { TURBO_CACHE: "local:w,remote:w" });
      expect(writeOnly).toContain("0 cached, 1 total");
      const unconfigured = yield* run("unconfigured-cache", {
        TURBO_API: "",
        TURBO_TEAM: "",
        TURBO_TOKEN: "",
      });
      expect(unconfigured).toContain("0 cached, 1 total");
    }),
  { timeout: 180_000 },
);

test.provider(
  "the rat-stack adoption contract preserves all resource fqns and the token handoff",
  (stack) =>
    Effect.gen(function* cartridgeStateHandoff() {
      const deployment = yield* deploy(stack, TurboCache).pipe(Effect.orDie);
      const origin = deployment.url ?? "";

      const context = yield* Layer.build(stack.state);
      const state = yield* Context.get(context, State.State);
      const fqns = yield* state.list({ stack: stack.name, stage: stack.stage });
      expect(A.sort(fqns, Order.String)).toEqual([
        "TurboCache",
        "TurboCacheFoundation/TurboCacheBucket",
        "TurboCacheFoundation/TurboCacheToken-rat-stack",
      ]);

      const values = yield* handoffToken(
        (fqn) => state.get({ fqn, stack: stack.name, stage: stack.stage }).pipe(Effect.orDie),
        {
          args: [
            "-e",
            "let input=''; process.stdin.on('data',x=>input+=x); process.stdin.on('end',async()=>{ if(!/^[a-f0-9]{64}$/.test(input))process.exit(1); const response=await fetch(process.argv[1]+'/v8/artifacts/status?slug=rat-stack',{headers:{authorization:'Bearer '+input}}); process.exit(response.status===200?0:2); });",
            origin,
          ],
          command: process.execPath,
          resourceNamePrefix: "TurboCache",
          team: "rat-stack",
          teams: ["rat-stack"],
        },
      );

      expect(values.TURBO_API).toBe(new URL(origin).origin);
      expect(values.TURBO_TEAM).toBe("rat-stack");
    }),
  { timeout: 180_000 },
);
