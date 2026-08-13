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

export const signedRequestFromEvent = (event: HttpApiEvent) => ({
  method: event.requestContext.http.method,
  rawPath: event.rawPath,
  requestId: event.requestContext.requestId,
});
