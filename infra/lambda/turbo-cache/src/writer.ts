import { handler as shimHandler } from "turborepo-remote-cache/aws-lambda";
import { signedRequestFromEvent } from "./event.js";
import { verifyRequestSignature } from "./hmac.js";
import { loadWriterSecret } from "./ssm.js";
import type { HttpApiEvent } from "./event.js";

type ShimDelegate = (event: HttpApiEvent, ...args: ReadonlyArray<unknown>) => unknown;

type WriterDependencies = {
  readonly delegate: ShimDelegate;
  readonly loadSecret: () => Promise<string>;
};

export type ForbiddenResponse = {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly statusCode: 403;
};

const forbidden = (): ForbiddenResponse => ({
  statusCode: 403,
  headers: { "content-type": "application/json" },
  body: '{"error":"forbidden"}',
});

const writerSignature = (event: HttpApiEvent): string | undefined => {
  const value = event.requestContext.authorizer?.lambda?.writerSignature;
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

export const createWriterHandler =
  ({ delegate, loadSecret }: WriterDependencies) =>
  async (event: HttpApiEvent, ...args: ReadonlyArray<unknown>): Promise<unknown> => {
    const signature = writerSignature(event);
    if (signature === undefined) return forbidden();

    try {
      const secret = await loadSecret();
      if (!verifyRequestSignature(secret, signedRequestFromEvent(event), signature)) {
        return forbidden();
      }
    } catch {
      return forbidden();
    }
    return await delegate(event, ...args);
  };

export const handler = createWriterHandler({
  delegate: shimHandler,
  loadSecret: loadWriterSecret,
});
