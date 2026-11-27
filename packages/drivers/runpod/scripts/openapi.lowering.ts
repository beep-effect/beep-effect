import { $RunpodId } from "@beep/identity";
import { A, Str, Struct } from "@beep/utils";
import * as Equal from "effect/Equal";
import { pipe } from "effect/Function";
import * as JsonPointer from "effect/JsonPointer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as OpenApiPatch from "@effect/openapi-generator/OpenApiPatch";

const $I = $RunpodId.create("scripts/openapi.lowering");

const COMPONENT_SCHEMA_REF_PREFIX = "#/components/schemas/";

const LoweringNodeRef = S.suspend((): S.Codec<LoweringNode, LoweringNode.Encoded> => LoweringNode);

class LoweringNode extends S.Class<LoweringNode, { readonly brand: unique symbol }>($I`LoweringNode`)(
  {
    $ref: S.optionalKey(S.String),
    allOf: S.Array(LoweringNodeRef).pipe(S.optionalKey),
    properties: S.Record(S.String, S.Json).pipe(S.optionalKey),
    required: S.Array(S.String).pipe(S.optionalKey),
    unevaluatedProperties: S.optionalKey(S.Json),
  },
  $I.annote("LoweringNode", {
    description: "JSON Schema subset read when lowering `unevaluatedProperties` closures.",
  })
) {}

declare namespace LoweringNode {
  /** Encoded (wire) side of the recursive lowering subset; the branded class is the decoded side. */
  export interface Encoded {
    readonly $ref?: string;
    readonly allOf?: ReadonlyArray<Encoded>;
    readonly properties?: { readonly [key: string]: S.Json };
    readonly required?: ReadonlyArray<string>;
    readonly unevaluatedProperties?: S.Json;
  }
}

class LoweringDocument extends S.Opaque<LoweringDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    components: S.Struct({
      schemas: S.Record(S.String, LoweringNode),
    }),
  }).pipe(
    $I.annoteSchema("LoweringDocument", {
      description: "OpenAPI document subset read when lowering `unevaluatedProperties` closures.",
    })
  )
) {}

const decodeLoweringDocument = S.decodeUnknownOption(LoweringDocument);

type Evaluated = {
  readonly properties: Readonly<Record<string, S.Json>>;
  readonly required: ReadonlyArray<string>;
};

const emptyEvaluated: Evaluated = { properties: R.empty(), required: A.empty() };

const intersectRedeclaredProperty = (existing: O.Option<S.Json>, incoming: S.Json): S.Json =>
  pipe(
    existing,
    O.filter((current) => !Equal.equals(current, incoming)),
    O.map((current): S.Json => ({ allOf: [current, incoming] })),
    O.getOrElse(() => incoming)
  );

const mergeEvaluated = (left: Evaluated, right: Evaluated): Evaluated => ({
  properties: pipe(
    Struct.entries(right.properties),
    A.reduce(left.properties, (merged, [name, schema]) =>
      R.set(merged, name, intersectRedeclaredProperty(R.get(merged, name), schema))
    )
  ),
  required: A.dedupe(A.appendAll(left.required, right.required)),
});

const componentName = (ref: string): O.Option<string> =>
  pipe(
    ref,
    O.liftPredicate(Str.startsWith(COMPONENT_SCHEMA_REF_PREFIX)),
    O.map(Str.slice(Str.length(COMPONENT_SCHEMA_REF_PREFIX)))
  );

const closedNodeProperties = (
  schemas: Readonly<Record<string, LoweringNode>>,
  node: LoweringNode
): O.Option<Evaluated> => {
  const members = pipe(
    O.fromUndefinedOr(node.allOf),
    O.getOrElse(A.empty<LoweringNode>),
    A.map((member) =>
      pipe(
        O.fromUndefinedOr(member.$ref),
        O.match({
          onNone: () => closedNodeProperties(schemas, member),
          onSome: (ref) =>
            pipe(
              componentName(ref),
              O.flatMap((name) => R.get(schemas, name)),
              O.flatMap((target) => closedNodeProperties(schemas, target))
            ),
        })
      )
    ),
    O.all
  );
  const own: Evaluated = {
    properties: node.properties ?? R.empty(),
    required: node.required ?? A.empty(),
  };

  return O.map(members, withOwnProperties(own));
};

const withOwnProperties =
  (own: Evaluated) =>
  (members: ReadonlyArray<Evaluated>): Evaluated =>
    mergeEvaluated(A.reduce(members, emptyEvaluated, mergeEvaluated), own);

const nodeOperations = (pointer: string, node: LoweringNode, evaluated: Evaluated): OpenApiPatch.JsonPatchDocument =>
  A.flatten([
    allOfOperations(pointer, node, evaluated),
    [
      { op: "remove", path: `${pointer}/unevaluatedProperties` },
      { op: "add", path: `${pointer}/additionalProperties`, value: false },
    ],
  ]);

const allOfOperations = (pointer: string, node: LoweringNode, evaluated: Evaluated): OpenApiPatch.JsonPatchDocument =>
  pipe(
    O.fromUndefinedOr(node.allOf),
    O.map(
      (): OpenApiPatch.JsonPatchDocument => [
        { op: "add", path: `${pointer}/type`, value: "object" },
        { op: "add", path: `${pointer}/properties`, value: evaluated.properties },
        ...A.match(evaluated.required, {
          onEmpty: A.empty<OpenApiPatch.JsonPatchDocument[number]>,
          onNonEmpty: (required): OpenApiPatch.JsonPatchDocument => [
            { op: "add", path: `${pointer}/required`, value: required },
          ],
        }),
        { op: "remove", path: `${pointer}/allOf` },
      ]
    ),
    O.getOrElse(A.empty<OpenApiPatch.JsonPatchDocument[number]>)
  );

const isClosed = (node: LoweringNode): boolean => node.unevaluatedProperties === false;

/**
 * Derive the JSON patch that lowers every `unevaluatedProperties: false`
 * component of the Runpod OpenAPI document into a closed object schema.
 *
 * **Details**
 *
 * Effect's JSON Schema importer has no `unevaluatedProperties` constraint.
 * Runpod v2 closes its request bodies with it on top of an `allOf` of shared
 * bases, so the closure is lowered at the document level: the members'
 * properties and `required` lists are flattened onto the node, `allOf` is
 * dropped, and the closure becomes `additionalProperties: false`. A property
 * two members declare differently becomes a property-level `allOf` (both must
 * hold). The patch is derived from the source, never hand-maintained, so a
 * property added to a shared base reaches every closed request body.
 *
 * **Gotchas**
 *
 * A node whose members point outside `components.schemas` is left as is; the
 * operations renderer fails generation when any closure survives the patches.
 *
 * **Example** (Lower one closed component)
 *
 * ```ts
 * import { closedObjectPatch } from "./openapi.lowering.ts"
 *
 * const patch = closedObjectPatch({
 *   components: {
 *     schemas: {
 *       Base: { type: "object", properties: { name: { type: "string" } } },
 *       Create: { allOf: [{ $ref: "#/components/schemas/Base" }], unevaluatedProperties: false }
 *     }
 *   }
 * })
 *
 * console.log(patch.length) // => 5
 * ```
 *
 * @category code-generation
 * @since 0.0.0
 */
export const closedObjectPatch = (document: unknown): OpenApiPatch.JsonPatchDocument =>
  pipe(
    decodeLoweringDocument(document),
    O.map(({ components: { schemas } }) =>
      pipe(
        Struct.entries(schemas),
        A.filter(([, node]) => isClosed(node)),
        A.flatMap(([name, node]) =>
          pipe(
            closedNodeProperties(schemas, node),
            O.map((evaluated) =>
              nodeOperations(`/components/schemas/${JsonPointer.escapeToken(name)}`, node, evaluated)
            ),
            O.getOrElse(A.empty<OpenApiPatch.JsonPatchDocument[number]>)
          )
        )
      )
    ),
    O.getOrElse(A.empty<OpenApiPatch.JsonPatchDocument[number]>)
  );
