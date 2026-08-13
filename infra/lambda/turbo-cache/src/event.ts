/**
 * Minimal API Gateway HTTP API v2 event shape these handlers consume.
 *
 * @category models
 * @since 0.0.0
 */
export type HttpApiEvent = {
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly rawPath: string;
  readonly requestContext: {
    readonly authorizer?: {
      readonly lambda?: Readonly<Record<string, unknown>>;
    };
    readonly http: {
      readonly method: string;
    };
    readonly requestId: string;
  };
};

/**
 * Project the HMAC-signed identity triple out of an HTTP API event.
 *
 * @category utilities
 * @since 0.0.0
 */
export const signedRequestFromEvent = (event: HttpApiEvent) => ({
  method: event.requestContext.http.method,
  rawPath: event.rawPath,
  requestId: event.requestContext.requestId,
});
