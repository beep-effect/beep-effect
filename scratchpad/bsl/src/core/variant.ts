/** Shared Effect model-variant factory used by dialect model projectors. */
import { VariantSchema } from "effect/unstable/schema";

const variantTuple = <const Values extends readonly [string, ...string[]]>(
  ...values: Values
): Values => values;

/** Ordered model variant family compatible with Effect's SQL model helpers. */
export const variants = variantTuple(
  "select",
  "insert",
  "update",
  "json",
  "jsonCreate",
  "jsonUpdate",
);

/** Model variant literal. */
export type Variant = (typeof variants)[number];

/** Small guard surface for model variants. */
export const Variant = {
  is: {
    select: (value: unknown): value is "select" => value === "select",
    insert: (value: unknown): value is "insert" => value === "insert",
    update: (value: unknown): value is "update" => value === "update",
    json: (value: unknown): value is "json" => value === "json",
    jsonCreate: (value: unknown): value is "jsonCreate" => value === "jsonCreate",
    jsonUpdate: (value: unknown): value is "jsonUpdate" => value === "jsonUpdate",
  },
};

/** Dialect-neutral VariantSchema factory. */
export const factory = VariantSchema.make({
  variants,
  defaultVariant: "select",
});

export const VariantField = factory.Field;
export const FieldOnly = factory.FieldOnly;
export const FieldExcept = factory.FieldExcept;
export const fieldEvolve = factory.fieldEvolve;
export const extract = factory.extract;
