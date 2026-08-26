/**
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as SchemaUtils from "../../../SchemaUtils/index.ts";

export const $I = $SchemaId.create("File/core/types/file-info");

export const NumOrStr = S.Union([S.Finite, S.String]);

export type NumOrStr = typeof NumOrStr.Type;

export declare namespace NumOrStr {
  export type Encoded = string | number;
}

export const boolDefaultFalse = S.Boolean.pipe(SchemaUtils.withKeyDefaults(false));

export const opt = <T extends S.Top>(schema: T) => schema.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

export const optNum = opt(S.Finite);
export const optStr = opt(S.String);

export const arr = <T extends S.Top>(schema: T) => schema.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults);

export const strArr = arr(S.String);
export const numArr = arr(S.Finite);
