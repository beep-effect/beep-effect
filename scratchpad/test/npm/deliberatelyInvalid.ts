/** Passes deliberately invalid inputs to runtime validation, per the operator's test ruling. */
export const deliberatelyInvalid = <T>(value: unknown): T => value as T;
