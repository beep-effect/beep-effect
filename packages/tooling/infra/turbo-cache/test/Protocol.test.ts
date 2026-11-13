import { artifactHandler, Credential, operationOf, Route, routeFor } from "@beep/infra-turbo-cache/Protocol";
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

// Workers provide `crypto.subtle.timingSafeEqual`; Bun does not. The stub
// below compares every byte, like the Workers primitive, and is removed after
// the suite. The end-to-end behaviour on workerd is `Runtime.test.ts`.
const constantTimeEqual = (left: ArrayBuffer, right: ArrayBuffer): boolean => {
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return (
    a.length === b.length &&
    A.reduce(A.zip(A.fromIterable(a), A.fromIterable(b)), 0, (acc, [x, y]) => acc | (x ^ y)) === 0
  );
};

beforeAll(() => {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", { configurable: true, value: constantTimeEqual });
});

afterAll(() => {
  Reflect.deleteProperty(crypto.subtle, "timingSafeEqual");
});

const credentials: ReadonlyArray<Credential> = [
  Credential.make({
    team: "beep",
    principal: "ci-main",
    access: "write",
    token: Effect.succeed(Redacted.make("test-only-writer")),
  }),
  Credential.make({
    team: "beep",
    principal: "ci-pr",
    access: "read",
    token: Effect.succeed(Redacted.make("test-only-reader")),
  }),
  Credential.make({
    team: "other",
    principal: "ci-main",
    access: "write",
    token: Effect.succeed(Redacted.make("test-only-other")),
  }),
];

// Every case below must be refused before storage is touched.
const untouched = () => Effect.die("storage must not be reached");
const handle = artifactHandler({ bucket: { get: untouched, head: untouched, put: untouched }, credentials });

const ErrorBody = S.Struct({ error: S.Struct({ code: S.String, message: S.String }) });

const send = (path: string, method: string, token?: string) =>
  handle(
    new Request(`https://cache.example.test${path}`, {
      method,
      ...(token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } }),
      ...(method === "PUT" ? { body: "x" } : {}),
    })
  );

const codeOf = (response: Response) =>
  Effect.promise(() => response.json()).pipe(
    Effect.flatMap(S.decodeUnknownEffect(ErrorBody)),
    Effect.map(({ error }) => error.code)
  );

describe("routeFor and operationOf", () => {
  it.effect("classify every protocol endpoint and refuse everything else", () =>
    Effect.sync(() => {
      const operation = (path: string, method: string) => {
        const route = routeFor(new Request(`https://cache.example.test${path}`, { method }));
        return Route.guards.missing(route) ? "missing" : operationOf(route, method);
      };
      expect(operation("/v8/artifacts/status", "GET")).toBe("status");
      expect(operation("/v8/artifacts/events", "POST")).toBe("events");
      expect(operation("/v8/artifacts", "POST")).toBe("query");
      expect(operation("/v8/artifacts/abc", "GET")).toBe("download");
      expect(operation("/v8/artifacts/abc", "HEAD")).toBe("download");
      expect(operation("/v8/artifacts/abc", "PUT")).toBe("upload");
      A.forEach(
        [
          ["/", "GET"],
          ["/v8/artifacts/abc", "DELETE"],
          ["/v8/artifacts/status", "PUT"],
          ["/v8/artifacts/events", "GET"],
          ["/v8/artifacts/a.b", "GET"],
          ["/v8/artifacts/status/", "GET"],
        ] as const,
        ([path, method]) => expect(operation(path, method)).toBe("missing")
      );
    })
  );
});

describe("artifactHandler refusals", () => {
  it.effect("an unknown route is 404 before authentication", () =>
    Effect.gen(function* () {
      const response = yield* send("/ping?slug=beep", "GET");
      expect(response.status).toBe(404);
    })
  );

  it.effect("a missing or unknown bearer is 401 on every endpoint", () =>
    Effect.gen(function* () {
      const endpoints = [
        ["/v8/artifacts/abc?slug=beep", "GET"],
        ["/v8/artifacts/abc?slug=beep", "PUT"],
        ["/v8/artifacts?slug=beep", "POST"],
        ["/v8/artifacts/status?slug=beep", "GET"],
      ] as const;
      const anonymous = yield* Effect.forEach(endpoints, ([path, method]) => send(path, method));
      const wrong = yield* Effect.forEach(endpoints, ([path, method]) => send(path, method, "test-only-wrong"));
      expect(A.map([...anonymous, ...wrong], (response) => response.status)).toEqual(A.replicate(401, 8));
    })
  );

  it.effect("a token of another team, a bad slug or a teamId is 403 forbidden", () =>
    Effect.gen(function* () {
      const paths = [
        "/v8/artifacts/abc?slug=other",
        "/v8/artifacts/abc",
        "/v8/artifacts/abc?slug=beep&slug=beep",
        "/v8/artifacts/abc?slug=bad.slug",
        "/v8/artifacts/abc?slug=beep&teamId=team_beep",
      ];
      const responses = yield* Effect.forEach(paths, (path) => send(path, "GET", "test-only-writer"));
      expect(A.map(responses, (response) => response.status)).toEqual(A.replicate(403, paths.length));
      const codes = yield* Effect.forEach(responses, codeOf);
      expect(codes).toEqual(A.replicate("forbidden", paths.length));
    })
  );

  it.effect("a read token asking to upload is 403 read_only and never reaches storage", () =>
    Effect.gen(function* () {
      const response = yield* send("/v8/artifacts/abc?slug=beep", "PUT", "test-only-reader");
      expect(response.status).toBe(403);
      const code = yield* codeOf(response);
      expect(code).toBe("read_only");
    })
  );

  it.effect("a read token may ask for status and report events", () =>
    Effect.gen(function* () {
      const status = yield* send("/v8/artifacts/status?slug=beep", "GET", "test-only-reader");
      const events = yield* send("/v8/artifacts/events?slug=beep", "POST", "test-only-reader");
      expect([status.status, events.status]).toEqual([200, 204]);
    })
  );
});
