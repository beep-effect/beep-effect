/**
 * Local stand-in for one Lambda function of the incumbent topology.
 *
 * The parent gateway starts one worker per function with that function's
 * deployed environment (`READ_ONLY`, `STORAGE_*`), so the read-only and writer
 * shims never share module state, as in two Lambda functions. The worker
 * accepts a serialized HTTP API v2 event on loopback and returns the handler's
 * structured response. It is lab-only and never bundled into the ZIP.
 */
import { createWriterHandler } from "../src/writer.ts";
import type { HttpApiEvent } from "../src/event.ts";

type Handler = (event: HttpApiEvent, context: unknown) => Promise<unknown>;

const role = process.env.LAB_FUNCTION;
const port = Number(process.env.LAB_WORKER_PORT);
const writerSecret = process.env.LAB_WRITER_SECRET;
if ((role !== "reader" && role !== "writer") || !Number.isInteger(port)) {
  throw new Error("worker requires LAB_FUNCTION=reader|writer and LAB_WORKER_PORT");
}

// The shim reads its environment at import time, so import it only after the
// parent has set this function's variables.
const shim = (await import("turborepo-remote-cache/aws-lambda")) as { readonly handler: Handler };
const handler: Handler =
  role === "reader"
    ? shim.handler
    : createWriterHandler({
        delegate: shim.handler,
        loadSecret: async () => {
          if (writerSecret === undefined || writerSecret === "") throw new Error("missing writer secret");
          return writerSecret;
        },
      });

const lambdaContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: `turbo-cache-lab-${role}`,
  getRemainingTimeInMillis: () => 10_000,
};

Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch: async (request) => {
    const event = (await request.json()) as HttpApiEvent;
    const result = await handler(event, lambdaContext);
    return Response.json(result ?? null);
  },
});
