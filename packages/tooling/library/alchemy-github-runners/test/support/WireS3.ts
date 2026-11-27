/**
 * A raw-socket HTTP/1.1 stub for the runner-binaries mirror: it serves the
 * release asset (behind a redirect, as GitHub does) and records every S3
 * request exactly as it arrives on the wire.
 *
 * It rejects what real S3 rejects for an object body: a `Transfer-Encoding`
 * request, or a body-bearing PUT without `Content-Length`, gets S3's 501
 * `NotImplemented` error after its chunked body is drained. It reads raw bytes
 * rather than a parsed request so the recorded head is what the HTTP client
 * sent, not what a server library normalised.
 */

import * as NodeNet from "node:net";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";

/** One request as the stub received it. */
export interface WireRequest {
  /** The decoded body (de-chunked when the request was chunked). */
  readonly body: Uint8Array;
  /** The request line and header block, verbatim. */
  readonly head: string;
  /** Header names lowercased. */
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  /** Whether the stub answered with S3's 501 NotImplemented. */
  readonly rejected: boolean;
  readonly target: string;
}

/** How the stub serves the release asset. */
export interface WireS3Options {
  /** `false` serves the asset with `Transfer-Encoding: chunked` and no `Content-Length`. */
  readonly assetContentLength: boolean;
  readonly assetSize: number;
  /** Declares the full length but closes the connection this many bytes short. */
  readonly truncateBy?: number | undefined;
}

const latin1 = new TextDecoder("latin1");
const utf8 = new TextEncoder();
const crlf2 = "\r\n\r\n";
const xmlProlog = '<?xml version="1.0" encoding="UTF-8"?>\n';

const notImplementedXml = `${xmlProlog}<Error><Code>NotImplemented</Code><Message>A header you provided implies functionality that is not implemented</Message><Header>Transfer-Encoding</Header><RequestId>wire-stub</RequestId></Error>`;
const initiateXml = `${xmlProlog}<InitiateMultipartUploadResult><Bucket>binaries</Bucket><Key>actions-runner-linux.tar.gz</Key><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>`;
const completeXml = `${xmlProlog}<CompleteMultipartUploadResult><Bucket>binaries</Bucket><Key>actions-runner-linux.tar.gz</Key><ETag>"etag-complete"</ETag></CompleteMultipartUploadResult>`;
const noRouteXml = `${xmlProlog}<Error><Code>NoSuchKey</Code><Message>no route</Message></Error>`;

const makeMod251PatternAsset = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index++) bytes[index] = index % 251;
  return bytes;
};

const joinParts = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const out = new Uint8Array(A.reduce(parts, 0, (total, part) => total + part.byteLength));
  A.reduce(parts, 0, (offset, part) => {
    out.set(part, offset);
    return offset + part.byteLength;
  });
  return out;
};

const response = (
  status: string,
  headers: Readonly<Record<string, string>>,
  body: Uint8Array = new Uint8Array(0)
): Uint8Array => {
  const lines = A.map(
    R.toEntries({ ...headers, "content-length": `${body.byteLength}` }),
    ([name, value]) => `${name}: ${value}`
  );
  return joinParts([utf8.encode(`HTTP/1.1 ${status}\r\n${A.join(lines, "\r\n")}${crlf2}`), body]);
};

const xmlResponse = (status: string, xml: string, extra: Readonly<Record<string, string>> = {}) =>
  response(status, { "content-type": "application/xml", ...extra }, utf8.encode(xml));

const headerEntry = (line: string): O.Option<readonly [string, string]> =>
  O.map(
    Str.indexOf(":")(line),
    (at) => [Str.toLowerCase(Str.trim(Str.slice(0, at)(line))), Str.trim(Str.slice(at + 1)(line))] as const
  );

const parseHead = (head: string) => {
  const lines = Str.split("\r\n")(head);
  const [method = "", target = ""] = Str.split(" ")(lines[0] ?? "");
  const headers = R.fromEntries(A.getSomes(A.map(A.drop(lines, 1), headerEntry)));
  return { method, target, headers };
};

interface FramedBody {
  readonly body: Uint8Array;
  readonly consumed: number;
}

const chunkHeader = (bytes: Uint8Array, offset: number) => {
  const window = latin1.decode(bytes.subarray(offset, offset + 64));
  return O.map(Str.indexOf("\r\n")(window), (lineEnd) => ({
    size: Number.parseInt(Str.split(";")(Str.slice(0, lineEnd)(window))[0] ?? "", 16),
    data: offset + lineEnd + 2,
  }));
};

const trailerEnd = (bytes: Uint8Array, offset: number): O.Option<number> => {
  const rest = latin1.decode(bytes.subarray(offset));
  return Str.startsWith("\r\n")(rest) ? O.some(offset + 2) : O.map(Str.indexOf(crlf2)(rest), (end) => offset + end + 4);
};

const dechunk = (bytes: Uint8Array, offset = 0, parts: ReadonlyArray<Uint8Array> = []): O.Option<FramedBody> =>
  O.flatMap(chunkHeader(bytes, offset), ({ size, data }) => {
    if (size === 0) {
      return O.map(trailerEnd(bytes, data), (consumed) => ({ body: joinParts(parts), consumed }));
    }
    const end = data + size;
    return bytes.byteLength < end + 2 ? O.none() : dechunk(bytes, end + 2, A.append(parts, bytes.subarray(data, end)));
  });

const fixedBody = (bytes: Uint8Array, headers: Readonly<Record<string, string>>): O.Option<FramedBody> => {
  const size = O.match(R.get(headers, "content-length"), {
    onNone: () => 0,
    onSome: (value) => Number.parseInt(value, 10),
  });
  return bytes.byteLength < size ? O.none() : O.some({ body: bytes.slice(0, size), consumed: size });
};

const isChunked = (headers: Readonly<Record<string, string>>) => R.has(headers, "transfer-encoding");

const isS3Rejected = (method: string, headers: Readonly<Record<string, string>>) =>
  isChunked(headers) || (method === "PUT" && !R.has(headers, "content-length"));

const nextRequest = (pending: Uint8Array) =>
  O.flatMap(Str.indexOf(crlf2)(latin1.decode(pending.subarray(0, 65_536))), (headEnd) => {
    const head = latin1.decode(pending.subarray(0, headEnd));
    const { method, target, headers } = parseHead(head);
    const rest = pending.subarray(headEnd + 4);
    return O.map(isChunked(headers) ? dechunk(rest) : fixedBody(rest, headers), ({ body, consumed }) => ({
      request: { head, method, target, headers, body, rejected: isS3Rejected(method, headers) } satisfies WireRequest,
      remaining: rest.slice(consumed),
    }));
  });

const queryOf = (target: string) => (Str.includes("?")(target) ? (Str.split("?")(target)[1] ?? "") : "");

const partEtag = (query: string) =>
  O.getOrElse(
    O.map(
      A.findFirst(Str.split("&")(query), (pair) => Str.startsWith("partNumber=")(pair)),
      Str.slice("partNumber=".length)
    ),
    () => "object"
  );

const octetStream = "content-type: application/octet-stream\r\n";

const truncatedAsset = (asset: Uint8Array, short: number) =>
  joinParts([
    utf8.encode(`HTTP/1.1 200 OK\r\n${octetStream}content-length: ${asset.byteLength}${crlf2}`),
    asset.subarray(0, asset.byteLength - short),
  ]);

const chunkedAsset = (asset: Uint8Array) =>
  joinParts([
    utf8.encode(`HTTP/1.1 200 OK\r\n${octetStream}transfer-encoding: chunked\r\nconnection: close${crlf2}`),
    utf8.encode(`${asset.byteLength.toString(16)}\r\n`),
    asset,
    utf8.encode(`\r\n0${crlf2}`),
  ]);

const assetResponse = (asset: Uint8Array, options: WireS3Options) => {
  const short = options.truncateBy ?? 0;
  if (short > 0) return truncatedAsset(asset, short);
  return options.assetContentLength
    ? response("200 OK", { "content-type": "application/octet-stream" }, asset)
    : chunkedAsset(asset);
};

type Route = readonly [matches: (request: WireRequest, query: string) => boolean, answer: () => Uint8Array];

const routes = (origin: string, asset: Uint8Array, options: WireS3Options) => {
  const isPost = (request: WireRequest) => request.method === "POST";
  const table = (request: WireRequest): ReadonlyArray<Route> => [
    [() => request.rejected, () => xmlResponse("501 Not Implemented", notImplementedXml, { connection: "close" })],
    [
      () => request.method === "GET" && Str.startsWith("/download/")(request.target),
      () => response("302 Found", { location: `${origin}/assets/${Str.slice("/download/".length)(request.target)}` }),
    ],
    [() => request.method === "GET" && Str.startsWith("/assets/")(request.target), () => assetResponse(asset, options)],
    [
      (_, query) => isPost(request) && Str.includes("uploads")(query) && !Str.includes("uploadId=")(query),
      () => xmlResponse("200 OK", initiateXml),
    ],
    [() => request.method === "PUT", () => response("200 OK", { etag: `"etag-${partEtag(queryOf(request.target))}"` })],
    [(_, query) => isPost(request) && Str.includes("uploadId=")(query), () => xmlResponse("200 OK", completeXml)],
    [() => request.method === "DELETE", () => response("204 No Content", {})],
  ];
  return (request: WireRequest): Uint8Array => {
    const query = queryOf(request.target);
    return O.match(
      A.findFirst(table(request), ([matches]) => matches(request, query)),
      { onNone: () => xmlResponse("404 Not Found", noRouteXml), onSome: ([, answer]) => answer() }
    );
  };
};

/**
 * Starts the stub on an ephemeral loopback port for the current scope.
 */
export const makeWireS3 = Effect.fn("WireS3.make")(function* (options: WireS3Options) {
  const asset = makeMod251PatternAsset(options.assetSize);
  const requests: Array<WireRequest> = [];
  const sockets: Array<NodeNet.Socket> = [];
  let answer: (request: WireRequest) => Uint8Array = () => xmlResponse("503 Service Unavailable", noRouteXml);
  const closesAfter = (request: WireRequest) =>
    request.rejected || (Str.startsWith("/assets/")(request.target) && (options.truncateBy ?? 0) > 0);

  const serve = (socket: NodeNet.Socket) => {
    sockets.push(socket);
    let pending: Uint8Array = new Uint8Array(0);
    const drain = () => {
      for (let next = nextRequest(pending); O.isSome(next); next = nextRequest(pending)) {
        const { request, remaining } = next.value;
        pending = remaining;
        requests.push(request);
        socket.write(answer(request));
        if (closesAfter(request)) {
          socket.end();
          return;
        }
      }
    };
    socket.on("data", (chunk: Uint8Array) => {
      pending = joinParts([pending, chunk]);
      drain();
    });
    socket.on("error", () => socket.destroy());
  };

  const server = yield* Effect.acquireRelease(
    Effect.sync(() => NodeNet.createServer(serve)),
    (server) =>
      Effect.callback<void>((resume) => {
        A.forEach(sockets, (socket) => socket.destroy());
        server.close(() => resume(Effect.void));
      })
  );
  yield* Effect.callback<void>((resume) => {
    server.listen(0, "127.0.0.1", () => resume(Effect.void));
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${P.isObject(address) ? address.port : 0}`;
  answer = routes(origin, asset, options);
  return {
    origin,
    asset,
    requests: Effect.sync((): ReadonlyArray<WireRequest> => A.copy(requests)),
  };
});
