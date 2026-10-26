/**
 * Loopback HTTP API v2 emulator for the turbo-cache conformance lab.
 *
 * It reproduces the deployed API's route table, REQUEST authorizer (simple
 * responses, `Authorization` identity source, no result caching) and
 * AWS_PROXY integrations closely enough to run wire conformance cases:
 *
 * - `LAB_MODE=incumbent` invokes reader and writer worker processes that load
 *   the pinned shim, as the two deployed Lambda functions do;
 * - `LAB_MODE=policy-proxy` keeps the same authorizer and writer HMAC gate but
 *   forwards allowed requests to an upstream server (Bruno), so a candidate
 *   sits behind Beep's policy boundary.
 *
 * It does not reproduce API Gateway or Lambda payload limits, throttling,
 * IAM roles or direct invocation; those stay deployed-lab cases. Lab-only:
 * never bundled into the Lambda ZIP.
 */
import { createAuthorizerHandler } from "../src/authorizer.ts";
import { createWriterHandler } from "../src/writer.ts";
import type { HttpApiEvent } from "../src/event.ts";

type LambdaResponse = {
  readonly statusCode?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly isBase64Encoded?: boolean;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`gateway requires ${name}`);
  return value;
};

const mode = required("LAB_MODE");
if (mode !== "incumbent" && mode !== "policy-proxy") throw new Error("LAB_MODE must be incumbent|policy-proxy");
const port = Number(required("LAB_PORT"));
const secrets = {
  readOnlyToken: required("LAB_READ_TOKEN"),
  trustedWriteToken: required("LAB_WRITE_TOKEN"),
  writerSharedSecret: required("LAB_WRITER_SECRET"),
};

const authorize = createAuthorizerHandler({ loadSecrets: async () => secrets });

const routes: ReadonlyArray<readonly [method: string, pattern: RegExp, routeKey: string, fn: "reader" | "writer"]> = [
  ["GET", /^\/v8\/artifacts\/status$/u, "GET /v8/artifacts/status", "reader"],
  ["POST", /^\/v8\/artifacts\/events$/u, "POST /v8/artifacts/events", "reader"],
  ["GET", /^\/v8\/artifacts\/[^/]+$/u, "GET /v8/artifacts/{hash}", "reader"],
  ["HEAD", /^\/v8\/artifacts\/[^/]+$/u, "HEAD /v8/artifacts/{hash}", "reader"],
  ["PUT", /^\/v8\/artifacts\/[^/]+$/u, "PUT /v8/artifacts/{hash}", "writer"],
];

// API Gateway matches the most specific route first: literal status/events
// paths win over `{hash}` for the same method.
const matchRoute = (method: string, path: string) =>
  routes.find(([routeMethod, pattern]) => routeMethod === method && pattern.test(path));

const json = (status: number, message: string) => Response.json({ message }, { status });

const toEvent = async (request: Request, url: URL, routeKey: string, requestId: string): Promise<HttpApiEvent> => {
  const bytes = new Uint8Array(await request.arrayBuffer());
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });
  const hash = routeKey.endsWith("{hash}") ? url.pathname.slice("/v8/artifacts/".length) : undefined;
  return {
    version: "2.0",
    routeKey,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    ...(hash === undefined ? {} : { pathParameters: { hash: decodeURIComponent(hash) } }),
    requestContext: {
      http: {
        method: request.method,
        path: url.pathname,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: headers["user-agent"] ?? "",
      },
      requestId,
      routeKey,
      stage: "$default",
    },
    ...(bytes.byteLength === 0 ? {} : { body: Buffer.from(bytes).toString("base64"), isBase64Encoded: true }),
  } as HttpApiEvent;
};

const fromLambda = (result: unknown): Response => {
  // AWS_PROXY v2: a non-object or an object without statusCode is a 200 JSON body.
  if (result === null || typeof result !== "object" || !("statusCode" in result)) {
    return Response.json(result ?? null);
  }
  const response = result as LambdaResponse;
  const body =
    response.body === undefined
      ? null
      : response.isBase64Encoded === true
        ? Buffer.from(response.body, "base64")
        : response.body;
  return new Response(body, { status: response.statusCode ?? 200, headers: response.headers ?? {} });
};

const invokeWorker = async (fn: "reader" | "writer", event: HttpApiEvent): Promise<unknown> => {
  const workerPort = required(fn === "reader" ? "LAB_READER_PORT" : "LAB_WRITER_PORT");
  const response = await fetch(`http://127.0.0.1:${workerPort}/invoke`, {
    method: "POST",
    body: JSON.stringify(event),
  });
  if (!response.ok) return { statusCode: 502, body: JSON.stringify({ message: "Internal Server Error" }) };
  return response.json();
};

// policy-proxy: forward the original request to the upstream with its own
// single token, after the authorizer and writer HMAC gate admitted it.
const proxyUpstream = async (event: HttpApiEvent): Promise<LambdaResponse> => {
  const upstream = required("LAB_UPSTREAM");
  const upstreamToken = required("LAB_UPSTREAM_TOKEN");
  const raw = event as HttpApiEvent & {
    readonly rawQueryString?: string;
    readonly body?: string;
    readonly headers?: Record<string, string>;
  };
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw.headers ?? {})) {
    if (name !== "authorization" && name !== "host" && name !== "content-length") headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${upstreamToken}`);
  const query = raw.rawQueryString === undefined || raw.rawQueryString === "" ? "" : `?${raw.rawQueryString}`;
  const response = await fetch(`${upstream}${event.rawPath}${query}`, {
    method: event.requestContext.http.method,
    headers,
    ...(raw.body === undefined ? {} : { body: Buffer.from(raw.body, "base64") }),
  });
  const outHeaders: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    outHeaders[name] = value;
  });
  return {
    statusCode: response.status,
    headers: outHeaders,
    body: Buffer.from(await response.arrayBuffer()).toString("base64"),
    isBase64Encoded: true,
  };
};

const proxyWriter = createWriterHandler({
  delegate: proxyUpstream,
  loadSecret: async () => secrets.writerSharedSecret,
});

let sequence = 0;

Bun.serve({
  hostname: "127.0.0.1",
  port,
  maxRequestBodySize: 64 * 1024 * 1024,
  fetch: async (request) => {
    const url = new URL(request.url);
    const route = matchRoute(request.method, url.pathname);
    if (route === undefined) return json(404, "Not Found");
    const authorization = request.headers.get("authorization");
    if (authorization === null || authorization.trim() === "") return json(401, "Unauthorized");

    sequence += 1;
    const event = await toEvent(request, url, route[2], `lab-${process.pid}-${sequence}`);
    const decision = await authorize(event);
    if (!decision.isAuthorized) return json(403, "Forbidden");
    const authorized = {
      ...event,
      requestContext: { ...event.requestContext, authorizer: { lambda: decision.context } },
    };

    if (mode === "incumbent") return fromLambda(await invokeWorker(route[3], authorized));
    return fromLambda(route[3] === "writer" ? await proxyWriter(authorized) : await proxyUpstream(authorized));
  },
});
