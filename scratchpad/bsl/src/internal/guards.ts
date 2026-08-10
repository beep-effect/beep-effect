/** Shared cheap guards for internal author-input seams. */
import * as P from "effect/Predicate";

/** String-keyed unknown record used by repository boundaries. */
export type UnknownRecord = Readonly<Record<string, unknown>>;

/** Test whether an unknown value is a non-array string-keyed record. */
export const isUnknownRecord = (value: unknown): value is UnknownRecord => P.isObject(value);
