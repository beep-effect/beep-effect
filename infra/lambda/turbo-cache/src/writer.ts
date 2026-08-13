import { handler as shimHandler } from "turborepo-remote-cache/aws-lambda";
import { signedRequestFromEvent } from "./event.ts";
import { verifyRequestSignature } from "./hmac.ts";
import { loadWriterSecret } from "./ssm.ts";
import type { HttpApiEvent } from "./event.ts";

type ShimDelegate = (event: HttpApiEvent, ...args: ReadonlyArray<unknown>) => unknown;

type WriterDependencies = {
  readonly delegate: ShimDelegate;
  readonly loadSecret: () => Promise<string>;
};

/**
 * JSON 403 the writer returns without ever invoking the shim.
 *
 * @category models
 * @since 0.0.0
 */
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

/**
 * Wrap the upload shim behind mandatory authorizer-HMAC verification.
 *
 * **Details**
 *
 * Recomputes the HMAC over this event's own request identity with the SSM
 * shared secret and compares constant-time; a missing or invalid signature,
 * or any secret-resolution error, returns 403 and never delegates — which is
 * why a direct `lambda:InvokeFunction` call cannot mint a cache write.
 *
 * @param dependencies - Shim delegate and secret loader injection points.
 * @returns The HMAC-validating writer handler.
 * @category constructors
 * @since 0.0.0
 */
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

/**
 * Deployed writer entrypoint wired to the live shim and SSM loader.
 *
 * @category handlers
 * @since 0.0.0
 */
export const handler = createWriterHandler({
  delegate: shimHandler,
  loadSecret: loadWriterSecret,
});
