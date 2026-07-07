import { A, P, thunkFalse } from "@beep/utils";
import { Cause, flow, pipe, Result } from "effect";

export const safeBoolean: (evaluate: () => boolean) => boolean = flow(
  (evaluate: () => boolean) => Result.try(evaluate),
  Result.getOrElse(thunkFalse)
);

export const isObject = (value: unknown): value is object => safeBoolean(() => P.isObject(value));

export const isCause = (value: unknown): value is Cause.Cause<unknown> => safeBoolean(() => Cause.isCause(value));

export const readCauseReasons = (cause: Cause.Cause<unknown>): ReadonlyArray<Cause.Reason<unknown>> =>
  pipe(
    Result.try(() => cause.reasons),
    Result.getOrElse(A.empty<Cause.Reason<unknown>>)
  );
