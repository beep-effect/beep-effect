import * as O from "effect/Option";
import * as R from "effect/Record";

export type BoxErrorDetails = {
  readonly requestId?: string;
  readonly status?: number;
  readonly code?: string;
};

export type BoxErrorResponse = {
  readonly requestId?: string | null;
  readonly status?: number | null;
  readonly code?: string | null;
};

export const boxErrorDetailsFromResponse = (response: BoxErrorResponse): Partial<BoxErrorDetails> => {
  const options: Readonly<Record<string, O.Option<unknown>>> = {
    requestId: O.fromNullishOr(response.requestId),
    status: O.fromNullishOr(response.status),
    code: O.fromNullishOr(response.code),
  };

  return R.getSomes(options) as Partial<BoxErrorDetails>;
};
