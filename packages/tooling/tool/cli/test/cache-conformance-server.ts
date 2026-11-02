/**
 * In-test Remote Cache server and target helpers shared by the conformance tests.
 */
import { CacheConformanceBearers, CacheConformanceTarget, serveCacheLoopback } from "@beep/repo-cli/commands/Cache";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Headers from "effect/http/Headers";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import type { CacheConformanceRun } from "@beep/repo-cli/commands/Cache";

export const secrets = {
  reader: "conformance-reader-secret-71f3",
  writer: "conformance-writer-secret-9a0c",
  foreign: "conformance-foreign-secret-44be",
  unknown: "conformance-unknown-secret-d215",
};
export const teamId = "team_conformance";
export const foreignTeamId = "team_foreign";
export const bearers = CacheConformanceBearers.make({
  reader: Redacted.make(secrets.reader),
  writer: Redacted.make(secrets.writer),
  foreign: Redacted.make(secrets.foreign),
  unknown: Redacted.make(secrets.unknown),
});

export type ServerMode = {
  readonly putStatus: number;
  readonly readFault: O.Option<number>;
  readonly readersWrite: boolean;
  /** When false, any single `teamId` selector is accepted and names the namespace. */
  readonly bindTenant: boolean;
  /** When true, uploads keep their tag but reads never return it. */
  readonly dropTags: boolean;
  /** When true, an artifact stored without a tag reads as 404 (tag-passthrough shim behaviour). */
  readonly hideUntagged: boolean;
  /** Untrusted artifact-response header used by receipt safety controls. */
  readonly responseContentType?: string;
  /** Untrusted backend-result claim used by attribution and redaction controls. */
  readonly responseCacheResult?: string;
};
export const goodMode: ServerMode = {
  putStatus: 200,
  readFault: O.none(),
  readersWrite: false,
  bindTenant: true,
  dropTags: false,
  hideUntagged: false,
};

type Stored = { readonly body: Uint8Array; readonly headers: Readonly<Record<string, string>> };
const metadataHeaders = ["x-artifact-duration", "x-artifact-tag", "x-artifact-sha", "x-artifact-dirty-hash"];

type Principal = { readonly role: "reader" | "writer"; readonly namespace: string };
type ServerState = {
  readonly mode: ServerMode;
  readonly store: Ref.Ref<HashMap.HashMap<string, Stored>>;
  readonly tags: Ref.Ref<Array<string>>;
};

const principals = HashMap.make<ReadonlyArray<readonly [string, Principal]>>(
  [`Bearer ${secrets.reader}`, { role: "reader", namespace: teamId }],
  [`Bearer ${secrets.writer}`, { role: "writer", namespace: teamId }],
  [`Bearer ${secrets.foreign}`, { role: "writer", namespace: foreignTeamId }]
);
const json = (text: string, code = 200) =>
  HttpServerResponse.uint8Array(new TextEncoder().encode(text), { status: code, contentType: "application/json" });
// Error replies carry the pinned spec's JSON error object (`#/components/responses/*`).
const status = (code: number) => json(`{"code":"${code}","message":"conformance test server error"}`, code);

// Exactly one non-empty `teamId`; a binding server also requires the principal's own namespace.
const namespaceOf = (mode: ServerMode, principal: Principal, query: string): O.Option<string> => {
  const selectors = A.fromIterable(new URLSearchParams(query).entries());
  const [name, value] = O.getOrElse(A.head(selectors), () => ["", ""]);
  const allowed = selectors.length === 1 && name === "teamId" && value !== "";
  const bound = !mode.bindTenant || value === principal.namespace;
  return allowed && bound ? O.some(value) : O.none();
};

const uploadArtifact = Effect.fnUntraced(function* (
  state: ServerState,
  request: HttpServerRequest.HttpServerRequest,
  principal: Principal,
  key: string
) {
  if (principal.role !== "writer" && !state.mode.readersWrite) return status(403);
  if (!O.contains(Headers.get(request.headers, "content-type"), "application/octet-stream")) return status(415);
  if (O.exists(Headers.get(request.headers, "x-artifact-duration"), (value) => !/^\d+$/.test(value)))
    return status(400);
  const body = yield* request.arrayBuffer.pipe(
    Effect.map((buffer) => O.some(new Uint8Array(buffer))),
    Effect.orElseSucceed(() => O.none<Uint8Array>())
  );
  if (O.isNone(body)) return status(400);
  const headers = R.fromEntries(
    A.getSomes(
      A.map(metadataHeaders, (name) => O.map(Headers.get(request.headers, name), (value) => [name, value] as const))
    )
  );
  yield* O.match(Headers.get(request.headers, "x-artifact-tag"), {
    onNone: () => Effect.void,
    onSome: (tag) => Ref.update(state.tags, A.append(tag)),
  });
  yield* Ref.update(state.store, HashMap.set(key, { body: body.value, headers }));
  return json('{"urls":[]}', state.mode.putStatus);
});

const readArtifact = Effect.fnUntraced(function* (
  state: ServerState,
  request: HttpServerRequest.HttpServerRequest,
  key: string
) {
  if (request.method !== "GET" && request.method !== "HEAD") return status(405);
  if (request.method === "GET" && O.isSome(state.mode.readFault)) return status(state.mode.readFault.value);
  const stored = O.filter(
    HashMap.get(yield* Ref.get(state.store), key),
    (entry) => !state.mode.hideUntagged || R.has(entry.headers, "x-artifact-tag")
  );
  if (O.isNone(stored)) return status(404);
  const headers = state.mode.dropTags ? R.remove(stored.value.headers, "x-artifact-tag") : stored.value.headers;
  return HttpServerResponse.uint8Array(stored.value.body, {
    contentType: state.mode.responseContentType ?? "application/octet-stream",
    headers: { "x-artifact-duration": "0", ...headers },
  });
});

const artifactRoute = (
  state: ServerState,
  request: HttpServerRequest.HttpServerRequest,
  principal: Principal,
  namespace: string,
  pathname: string
) => {
  const hash = Str.slice("/v8/artifacts/".length)(pathname);
  if (!/^[a-f0-9]{16,128}$/.test(hash)) return Effect.succeed(status(hash === "events" ? 404 : 400));
  const key = `${namespace}/${hash}`;
  return request.method === "PUT" ? uploadArtifact(state, request, principal, key) : readArtifact(state, request, key);
};

const handle = Effect.fnUntraced(function* (state: ServerState) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const [pathname = "", query = ""] = Str.split(request.url, "?");
  const principal = HashMap.get(
    principals,
    O.getOrElse(Headers.get(request.headers, "authorization"), () => "")
  );
  if (O.isNone(principal)) return status(401);
  const namespace = namespaceOf(state.mode, principal.value, query);
  if (O.isNone(namespace)) return status(403);
  if (pathname === "/v8/artifacts/status" && request.method === "GET") return json('{"status":"enabled"}');
  if (!Str.startsWith("/v8/artifacts/")(pathname)) return status(404);
  return yield* artifactRoute(state, request, principal.value, namespace.value, pathname);
});

// Small policy-complete Remote Cache server used only by these tests.
export const makeConformanceServer = Effect.fn("test.makeConformanceServer")(function* (mode: ServerMode) {
  const state: ServerState = {
    mode,
    store: yield* Ref.make(HashMap.empty<string, Stored>()),
    tags: yield* Ref.make(A.empty<string>()),
  };
  const url = yield* serveCacheLoopback(
    handle(state).pipe(
      Effect.map((reply) =>
        O.match(O.fromUndefinedOr(mode.responseCacheResult), {
          onNone: () => reply,
          onSome: (value) => HttpServerResponse.setHeader(reply, "x-beep-cache-result", value),
        })
      )
    ),
    128 * 1024 * 1024
  );
  return { url, tags: Ref.get(state.tags) };
});

export const targetFor = (options: {
  readonly url: string;
  readonly readerWriterSplit?: boolean;
  readonly tenantBinding?: boolean;
}) =>
  CacheConformanceTarget.make({
    schemaVersion: "cache-conformance-target/v1",
    profile: "local-container",
    topology: "owned-fixture",
    baseUrl: new URL(options.url),
    backend: { id: "in-test", release: "in-test@0", digest: "none" },
    namespace: { teamId, foreignTeamId },
    credentials: { reader: "READER", writer: "WRITER", foreign: "FOREIGN", unknown: "UNKNOWN" },
    policy: { readerWriterSplit: options.readerWriterSplit ?? true, tenantBinding: options.tenantBinding ?? true },
    requestTimeoutMs: 5000,
  });

export const repoRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(new URL("../../../../../", import.meta.url));
});

export const caseOf: {
  (id: string): (report: CacheConformanceRun) => CacheConformanceRun["cases"][number];
  (report: CacheConformanceRun, id: string): CacheConformanceRun["cases"][number];
} = dual(2, (report: CacheConformanceRun, id: string) =>
  A.findFirst(report.cases, (entry) => entry.id === id).pipe(O.getOrThrow)
);
