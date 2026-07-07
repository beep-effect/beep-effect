import { NonNegativeInt } from "@beep/schema";
import { Result } from "effect";
import * as S from "effect/Schema";

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

export const decodeNonNegativeInt = (input: unknown): NonNegativeInt =>
  Result.getOrThrowWith(S.decodeUnknownResult(NonNegativeInt)(input), schemaIssueToError);
