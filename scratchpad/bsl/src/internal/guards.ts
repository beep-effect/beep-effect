/** Shared cheap guards for internal author-input seams. */
import { isObject } from "effect/Predicate";

/** String-keyed unknown record used by repository boundaries. */
/** @internal */
export type UnknownRecord = Readonly<Record<string, unknown>>;

/** Test whether an unknown value is a non-array string-keyed record. */
/** @internal */
export const isUnknownRecord = (value: unknown): value is UnknownRecord => isObject(value);
