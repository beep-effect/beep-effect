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

/** The offset of `needle` in `text`, `-1` when absent. */
const findText = (text: string, needle: string): number => O.getOrElse(Str.indexOf(needle)(text), () => -1);

/** The deterministic byte at `index` of the served asset. */
export const assetByte = (index: number): number => index % 251;

const makeAsset = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index++) bytes[index] = assetByte(index);
  return bytes;
};

const notImplementedXml =
  '<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>NotImplemented</Code><Message>A header you provided implies functionality that is not implemented</Message><Header>Transfer-Encoding</Header><RequestId>wire-stub</RequestId></Error>';

const concat = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const out = new Uint8Array(left.byteLength + right.byteLength);
  out.set(left, 0);
  out.set(right, left.byteLength);
  return out;
};

const response = (
  status: string,
  headers: Readonly<Record<string, string>>,
  body: Uint8Array = new Uint8Array(0)
): Uint8Array =>
  concat(
    utf8.encode(
      `HTTP/1.1 ${status}\r\n${A.join(
        A.map(
          R.toEntries({ ...headers, "content-length": `${body.byteLength}` }),
          ([name, value]) => `${name}: ${value}`
        ),
        "\r\n"
      )}${crlf2}`
    ),
    body
  );

const xmlResponse = (status: string, xml: string, extra: Readonly<Record<string, string>> = {}) =>
  response(status, { "content-type": "application/xml", ...extra }, utf8.encode(xml));

const parseHead = (head: string) => {
  const lines = Str.split("\r\n")(head);
  const [method = "", target = ""] = Str.split(" ")(A.headNonEmpty(lines as A.NonEmptyArray<string>));
  const headers = R.fromEntries(
    A.getSomes(
      A.map(A.drop(lines, 1), (line) => {
        const colon = Str.indexOf(":")(line);
        return O.map(
          colon,
          (at) => [Str.toLowerCase(Str.trim(Str.slice(0, at)(line))), Str.trim(Str.slice(at + 1)(line))] as const
        );
      })
    )
  );
  return { method, target, headers };
};

/**
 * Decodes a complete chunked body from `bytes`, or `None` while it is incomplete.
 * Returns the body and how many bytes the chunked encoding consumed.
 */
const dechunk = (bytes: Uint8Array): O.Option<{ readonly body: Uint8Array; readonly consumed: number }> => {
  const parts: Array<Uint8Array> = [];
  let offset = 0;
  for (;;) {
    const window = latin1.decode(bytes.subarray(offset, offset + 64));
    const lineEnd = findText(window, "\r\n");
    if (lineEnd < 0) return O.none();
    const size = Number.parseInt(Str.split(";")(Str.slice(0, lineEnd)(window))[0] ?? "", 16);
    offset += lineEnd + 2;
    if (size === 0) {
      const rest = latin1.decode(bytes.subarray(offset));
      const trailerEnd = Str.startsWith("\r\n")(rest) ? 0 : findText(rest, crlf2);
      if (trailerEnd < 0) return O.none();
      const consumed = offset + (trailerEnd === 0 ? 2 : trailerEnd + 4);
      const body = new Uint8Array(A.reduce(parts, 0, (total, part) => total + part.byteLength));
      A.reduce(parts, 0, (at, part) => {
        body.set(part, at);
        return at + part.byteLength;
      });
      return O.some({ body, consumed });
    }
    if (bytes.byteLength < offset + size + 2) return O.none();
    parts.push(bytes.subarray(offset, offset + size));
    offset += size + 2;
  }
};

/**
 * Starts the stub on an ephemeral loopback port for the current scope.
 */
export const makeWireS3 = Effect.fn("WireS3.make")(function* (options: WireS3Options) {
  const asset = makeAsset(options.assetSize);
  const requests: Array<WireRequest> = [];
  const sockets: Array<NodeNet.Socket> = [];
  let origin = "";

  const answer = (request: WireRequest): Uint8Array => {
    const query = Str.includes("?")(request.target) ? (Str.split("?")(request.target)[1] ?? "") : "";
    if (request.rejected) return xmlResponse("501 Not Implemented", notImplementedXml, { connection: "close" });
    if (request.method === "GET" && Str.startsWith("/download/")(request.target)) {
      return response("302 Found", { location: `${origin}/assets/${Str.slice("/download/".length)(request.target)}` });
    }
    if (request.method === "GET" && Str.startsWith("/assets/")(request.target)) {
      const short = options.truncateBy ?? 0;
      if (short > 0) {
        return concat(
          utf8.encode(
            `HTTP/1.1 200 OK\r\ncontent-type: application/octet-stream\r\ncontent-length: ${asset.byteLength}\r\n\r\n`
          ),
          asset.subarray(0, asset.byteLength - short)
        );
      }
      return options.assetContentLength
        ? response("200 OK", { "content-type": "application/octet-stream" }, asset)
        : concat(
            utf8.encode(
              "HTTP/1.1 200 OK\r\ncontent-type: application/octet-stream\r\ntransfer-encoding: chunked\r\nconnection: close\r\n\r\n"
            ),
            concat(concat(utf8.encode(`${asset.byteLength.toString(16)}\r\n`), asset), utf8.encode("\r\n0\r\n\r\n"))
          );
    }
    if (request.method === "POST" && Str.includes("uploads")(query) && !Str.includes("uploadId=")(query)) {
      return xmlResponse(
        "200 OK",
        '<?xml version="1.0" encoding="UTF-8"?>\n<InitiateMultipartUploadResult><Bucket>binaries</Bucket><Key>actions-runner-linux.tar.gz</Key><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>'
      );
    }
    if (request.method === "PUT") {
      const part = O.getOrElse(
        O.flatMap(
          A.findFirst(Str.split("&")(query), (pair) => Str.startsWith("partNumber=")(pair)),
          (pair) => O.some(Str.slice("partNumber=".length)(pair))
        ),
        () => "object"
      );
      return response("200 OK", { etag: `"etag-${part}"` });
    }
    if (request.method === "POST" && Str.includes("uploadId=")(query)) {
      return xmlResponse(
        "200 OK",
        '<?xml version="1.0" encoding="UTF-8"?>\n<CompleteMultipartUploadResult><Bucket>binaries</Bucket><Key>actions-runner-linux.tar.gz</Key><ETag>"etag-complete"</ETag></CompleteMultipartUploadResult>'
      );
    }
    if (request.method === "DELETE") return response("204 No Content", {});
    return xmlResponse(
      "404 Not Found",
      '<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>NoSuchKey</Code><Message>no route</Message></Error>'
    );
  };

  const serve = (socket: NodeNet.Socket) => {
    sockets.push(socket);
    let pending: Uint8Array = new Uint8Array(0);
    const drain = () => {
      for (;;) {
        const headEnd = findText(latin1.decode(pending.subarray(0, 65_536)), crlf2);
        if (headEnd < 0) return;
        const head = latin1.decode(pending.subarray(0, headEnd));
        const { method, target, headers } = parseHead(head);
        const rest = pending.subarray(headEnd + 4);
        const chunked = R.has(headers, "transfer-encoding");
        const length = O.getOrUndefined(R.get(headers, "content-length"));
        const rejected = chunked || (method === "PUT" && length === undefined);
        let body: Uint8Array;
        let consumed: number;
        if (chunked) {
          const decoded = dechunk(rest);
          if (O.isNone(decoded)) return;
          body = decoded.value.body;
          consumed = decoded.value.consumed;
        } else {
          const size = length === undefined ? 0 : Number.parseInt(length, 10);
          if (rest.byteLength < size) return;
          body = rest.slice(0, size);
          consumed = size;
        }
        pending = rest.slice(consumed);
        const request: WireRequest = { head, method, target, headers, body, rejected };
        requests.push(request);
        socket.write(answer(request));
        if (rejected || (Str.startsWith("/assets/")(target) && (options.truncateBy ?? 0) > 0)) {
          socket.end();
          return;
        }
      }
    };
    socket.on("data", (chunk: Uint8Array) => {
      pending = concat(pending, chunk);
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
  origin = `http://127.0.0.1:${address !== null && typeof address === "object" ? address.port : 0}`;
  return {
    origin,
    asset,
    requests: Effect.sync((): ReadonlyArray<WireRequest> => A.copy(requests)),
  };
});
