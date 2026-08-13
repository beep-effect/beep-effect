import type { HttpApiEvent } from "../src/event.js";

export const READ_TOKEN = "read-token-for-tests";
export const WRITE_TOKEN = "write-token-for-tests";
export const WRITER_SECRET = "writer-secret-for-tests";

export const requestEvent = (
  method: string,
  rawPath: string,
  token?: string,
  writerSignature?: string
): HttpApiEvent => ({
  headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
  rawPath,
  requestContext: {
    ...(writerSignature === undefined ? {} : { authorizer: { lambda: { writerSignature } } }),
    http: { method },
    requestId: "request-id-123",
  },
});
