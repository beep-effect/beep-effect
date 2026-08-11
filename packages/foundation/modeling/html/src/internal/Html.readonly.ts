/**
 * Shared type-only readonly projection for exported record-shaped APIs.
 *
 * @internal
 * @since 0.0.0
 */
export const readonlyStruct = <Value extends object>(value: Value): Readonly<Value> => value;
