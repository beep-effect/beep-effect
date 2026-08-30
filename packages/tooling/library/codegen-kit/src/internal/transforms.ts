import { flow, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type * as JsonSchema from "effect/JsonSchema";
import type { NamedTransform } from "../CodegenKit.models.ts";

export type NodeTransform = (node: JsonSchema.JsonSchema) => JsonSchema.JsonSchema;

const stringValues = (value: unknown): ReadonlyArray<string> => (A.isArray(value) ? A.filter(value, P.isString) : []);

const recordValue = (value: unknown): O.Option<Record<string, unknown>> =>
  P.isObject(value) ? O.some(value) : O.none();

const propertyRecord = (node: JsonSchema.JsonSchema): O.Option<Record<string, unknown>> =>
  O.flatMap(O.fromUndefinedOr(node.properties), recordValue);

const requiredValues = (node: JsonSchema.JsonSchema): ReadonlyArray<string> => stringValues(node.required);

const mergeRequired = (left: JsonSchema.JsonSchema, right: JsonSchema.JsonSchema): ReadonlyArray<string> =>
  A.dedupe(A.appendAll(requiredValues(left), requiredValues(right)));

const mergeProperties = (left: JsonSchema.JsonSchema, right: JsonSchema.JsonSchema): Record<string, unknown> => ({
  ...O.getOrElse(propertyRecord(left), R.empty<string, unknown>),
  ...O.getOrElse(propertyRecord(right), R.empty<string, unknown>),
});

const singleRef = (node: JsonSchema.JsonSchema): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(node.allOf),
    O.flatMap((members) => (A.isArray(members) ? O.some(members) : O.none())),
    O.filter((members) => A.length(members) === 1),
    O.flatMap(A.head),
    O.flatMap(recordValue),
    O.flatMap((member) => O.fromUndefinedOr(member.$ref)),
    O.filter(P.isString)
  );

const refName: (ref: string) => O.Option<string> = flow(Str.split("/"), A.last, O.filter(Str.isNonEmpty));

const refTarget = (definitions: JsonSchema.Definitions, ref: string): O.Option<JsonSchema.JsonSchema> =>
  pipe(
    refName(ref),
    O.flatMap((name) => R.get(definitions, name))
  );

const isMergeableTarget = (node: JsonSchema.JsonSchema): boolean =>
  node.type === "object" && O.isSome(propertyRecord(node));

const flattenNode = (node: JsonSchema.JsonSchema, target: JsonSchema.JsonSchema): JsonSchema.JsonSchema => {
  const { allOf: _allOf, ...rest } = node;
  return {
    ...rest,
    type: "object",
    properties: mergeProperties(target, node),
    required: mergeRequired(target, node),
  };
};

export const nullableTypeArray: NodeTransform = (node) => {
  const types = stringValues(node.type);
  const nonNull = A.filter(types, (type) => type !== "null");
  if (!isStringTypeArray(node.type, types)) return node;
  if (!isSingleNullableType(types, nonNull)) return node;
  const { type: _type, ...rest } = node;
  return { anyOf: [{ ...rest, type: nonNull[0] }, { type: "null" }] };
};

const isStringTypeArray = (value: unknown, types: ReadonlyArray<string>): value is ReadonlyArray<string> =>
  A.isArray(value) && A.length(types) === A.length(value);

const isSingleNullableType = (types: ReadonlyArray<string>, nonNull: ReadonlyArray<string>): boolean =>
  A.contains(types, "null") && A.length(nonNull) === 1;

export const makeFlattenAllOfRefVariants =
  (definitions: JsonSchema.Definitions): NodeTransform =>
  (node) =>
    pipe(
      singleRef(node),
      O.flatMap((ref) => refTarget(definitions, ref)),
      O.filter(isMergeableTarget),
      O.filter(() => O.isSome(propertyRecord(node))),
      O.map((target) => flattenNode(node, target)),
      O.getOrElse(() => node)
    );

const unionKey = (node: JsonSchema.JsonSchema): O.Option<"oneOf" | "anyOf"> =>
  A.isArray(node.oneOf) ? O.some("oneOf") : A.isArray(node.anyOf) ? O.some("anyOf") : O.none();

const mergeUnionMember = (member: unknown, siblings: JsonSchema.JsonSchema, flatten: NodeTransform): unknown =>
  pipe(
    recordValue(member),
    O.map(flatten),
    O.map((schema) => ({
      ...schema,
      type: "object",
      properties: mergeProperties(schema, siblings),
      required: mergeRequired(schema, siblings),
    })),
    O.getOrElse(() => member)
  );

export const makeDistributeUnionSiblings = (definitions: JsonSchema.Definitions): NodeTransform => {
  const flatten = makeFlattenAllOfRefVariants(definitions);
  return (node) =>
    pipe(
      unionKey(node),
      O.filter(() => O.isSome(propertyRecord(node))),
      O.map((key) => {
        const {
          oneOf: _oneOf,
          anyOf: _anyOf,
          properties: _properties,
          required: _required,
          type: _type,
          additionalProperties: _additionalProperties,
          ...rest
        } = node;
        return {
          ...rest,
          [key]: A.map(A.isArray(node[key]) ? node[key] : [], (member) => mergeUnionMember(member, node, flatten)),
        };
      }),
      O.getOrElse(() => node)
    );
};

export const openObjects: NodeTransform = (node) =>
  node.type === "object" && (node.additionalProperties === undefined || node.additionalProperties === false)
    ? { ...node, additionalProperties: true }
    : node;

export const stripExamples: NodeTransform = (node) => {
  const { example: _example, examples: _examples, ...rest } = node;
  return rest;
};

const transformRegistry = (definitions: JsonSchema.Definitions): Readonly<Record<NamedTransform, NodeTransform>> => ({
  nullableTypeArray,
  flattenAllOfRefVariants: makeFlattenAllOfRefVariants(definitions),
  distributeUnionSiblings: makeDistributeUnionSiblings(definitions),
  openObjects,
  stripExamples,
});

const transformFor = (name: NamedTransform, definitions: JsonSchema.Definitions): NodeTransform =>
  transformRegistry(definitions)[name];

export const composeTransforms: {
  (definitions: JsonSchema.Definitions): (names: ReadonlyArray<NamedTransform>) => NodeTransform;
  (names: ReadonlyArray<NamedTransform>, definitions: JsonSchema.Definitions): NodeTransform;
} = dual(2, (names: ReadonlyArray<NamedTransform>, definitions: JsonSchema.Definitions): NodeTransform => {
  const transforms = A.map(names, (name) => transformFor(name, definitions));
  return (node) => A.reduce(transforms, node, (current, transform) => transform(current));
});
