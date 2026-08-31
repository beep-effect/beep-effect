/**
 * Validated schema annotations for specification conformance metadata.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { MutableHashSet, pipe, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaParser from "effect/SchemaParser";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { InvariantDescriptor } from "./Conformance.invariant.schema.ts";
import { ConformanceProfile } from "./Conformance.profile.schema.ts";
import { SpecificationSource } from "./Conformance.source.schema.ts";

const $I = $SchemaId.create("Conformance/annotations");

const AnnotationFields = S.Struct({
  sources: S.NonEmptyArray(SpecificationSource),
  profiles: S.NonEmptyArray(ConformanceProfile),
  invariants: S.NonEmptyArray(InvariantDescriptor),
}).pipe(
  $I.annoteSchema("AnnotationFields", {
    description: "Source, profile, and invariant registries carried by one conformance annotation.",
  })
);

const addUnique = (seen: MutableHashSet.MutableHashSet<string>, id: string): boolean => {
  if (MutableHashSet.has(seen, id)) {
    return false;
  }

  MutableHashSet.add(seen, id);
  return true;
};

const hasUniqueIds = <Value>(values: ReadonlyArray<Value>, getId: (value: Value) => string): boolean => {
  const seen = MutableHashSet.empty<string>();
  return A.every(values, (value) => addUnique(seen, getId(value)));
};

const isConsistentAnnotation = (annotation: typeof AnnotationFields.Type): boolean => {
  const sourceIds = MutableHashSet.fromIterable(A.map(annotation.sources, ({ id }) => id));
  const invariantIds = MutableHashSet.fromIterable(A.map(annotation.invariants, ({ id }) => id));
  const profilesHaveRelativeReferenceIntegrity = A.every(annotation.profiles, (profile) => {
    const profileSourceIds = MutableHashSet.fromIterable(profile.sourceIds);
    const profileInvariantIds = MutableHashSet.fromIterable(profile.invariantIds);

    return A.every(
      annotation.invariants,
      (invariant) =>
        !MutableHashSet.has(profileInvariantIds, invariant.id) ||
        A.every(invariant.references, ({ sourceId }) => MutableHashSet.has(profileSourceIds, sourceId))
    );
  });

  return (
    hasUniqueIds(annotation.sources, ({ id }) => id) &&
    hasUniqueIds(annotation.profiles, ({ id }) => id) &&
    hasUniqueIds(annotation.invariants, ({ id }) => id) &&
    A.every(annotation.profiles, (profile) =>
      A.every(profile.sourceIds, (sourceId) => MutableHashSet.has(sourceIds, sourceId))
    ) &&
    A.every(annotation.profiles, (profile) =>
      A.every(profile.invariantIds, (invariantId) => MutableHashSet.has(invariantIds, invariantId))
    ) &&
    A.every(annotation.invariants, (invariant) =>
      A.every(invariant.references, ({ sourceId }) => MutableHashSet.has(sourceIds, sourceId))
    ) &&
    profilesHaveRelativeReferenceIntegrity
  );
};

const AnnotationConsistency = S.makeFilter(isConsistentAnnotation, {
  identifier: $I`AnnotationConsistency`,
  title: "Conformance annotation reference integrity",
  description:
    "Unique registry identifiers with profile and invariant references resolved inside the annotation and each profile.",
  message:
    "Expected unique source, profile, and invariant identifiers with every reference resolved globally and within each selecting profile",
});

/**
 * Self-contained specification registry attached to an Effect schema.
 *
 * **Details**
 *
 * Decoding checks unique source, profile, and invariant identifiers. Every
 * source or invariant identifier referenced by a profile, and every source
 * referenced by an invariant, must resolve inside the same annotation. An
 * invariant selected by a profile may only cite sources selected by that same
 * profile.
 *
 * **Example** (Decode a consistent annotation)
 *
 * ```ts import.meta.vitest name="Decode a consistent annotation"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Annotation } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Annotation)({
 *   sources: [{
 *     id: "example-spec",
 *     title: "Example Specification",
 *     role: "primarySpecification",
 *     canonicalUrl: "https://example.com/spec",
 *     revision: { kind: "release", version: "1.0" },
 *     contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   }],
 *   profiles: [{
 *     id: "example",
 *     title: "Example",
 *     version: "1.0",
 *     description: "Example conformance profile.",
 *     sourceIds: ["example-spec"],
 *     invariantIds: ["example.rule"]
 *   }],
 *   invariants: [{
 *     id: "example.rule",
 *     title: "Example rule",
 *     statement: "The example value satisfies the example rule.",
 *     strength: "must",
 *     scope: "value",
 *     decidability: "localRuntime",
 *     enforcement: [{ kind: "runtime", validator: "Example.validate" }],
 *     references: [{ sourceId: "example-spec", section: "Rule" }]
 *   }]
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @invariant Registry identifiers are unique and every declared reference resolves locally.
 * @category specifications
 * @since 0.0.0
 */
export const Annotation = AnnotationFields.check(AnnotationConsistency).pipe(
  SchemaUtils.withResultCodecStatics,
  SchemaUtils.withStatics((schema) => {
    const toType = S.toType(schema);
    return {
      decodeUnknownEffectToType: S.decodeUnknownEffect(toType),
    };
  }),
  $I.annoteSchema("Annotation", {
    description: "Self-contained, referentially consistent specification registry attached to an Effect schema.",
  })
);

/**
 * Runtime conformance annotation represented by {@link Annotation}.
 *
 * @see {@link Annotation} for runtime validation and encoded input.
 * @category specifications
 * @since 0.0.0
 */
export type Annotation = typeof Annotation.Type;

// Internal carrier avoids a recursive global-annotation/schema type cycle.
interface ConformanceAnnotationPayload {
  readonly invariants: readonly [unknown, ...Array<unknown>];
  readonly profiles: readonly [unknown, ...Array<unknown>];
  readonly sources: readonly [unknown, ...Array<unknown>];
}

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly conformance?: ConformanceAnnotationPayload | undefined;
    }
  }
}

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Validate an unknown conformance annotation without throwing.
 *
 * **Example** (Inspect an invalid registry)
 *
 * ```ts import.meta.vitest name="Inspect an invalid registry"
 * import { makeAnnotationResult } from "@beep/schema/Conformance"
 * import { Result } from "effect"
 *
 * const result = makeAnnotationResult({ sources: [], profiles: [], invariants: [] })
 * Result.isFailure(result) // => true
 * ```
 *
 * @param annotation - Unknown annotation registry to validate.
 * @returns A Result containing the decoded registry or its SchemaError.
 * @category constructors
 * @since 0.0.0
 */
export const makeAnnotationResult = (annotation: unknown): Result.Result<Annotation, S.SchemaError> =>
  pipe(SchemaParser.decodeUnknownResult(Annotation)(annotation), Result.mapError(schemaIssueToError));

/**
 * Validate an encoded conformance annotation before attaching or reusing it.
 *
 * **Example** (Build a validated annotation)
 *
 * ```ts import.meta.vitest name="Build a validated annotation"
 * import { makeAnnotation } from "@beep/schema/Conformance"
 *
 * const annotation = makeAnnotation({
 *   sources: [{
 *     id: "example-spec",
 *     title: "Example Specification",
 *     role: "primarySpecification",
 *     canonicalUrl: "https://example.com/spec",
 *     revision: { kind: "release", version: "1.0" },
 *     contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   }],
 *   profiles: [{
 *     id: "example",
 *     title: "Example",
 *     version: "1.0",
 *     description: "Example conformance profile.",
 *     sourceIds: ["example-spec"],
 *     invariantIds: ["example.rule"]
 *   }],
 *   invariants: [{
 *     id: "example.rule",
 *     title: "Example rule",
 *     statement: "The value satisfies the rule.",
 *     strength: "must",
 *     scope: "value",
 *     decidability: "localRuntime",
 *     enforcement: [{ kind: "runtime", validator: "Example.validate" }],
 *     references: [{ sourceId: "example-spec" }]
 *   }]
 * })
 *
 * annotation.profiles[0]?.id // => "example"
 * ```
 *
 * @param annotation - Encoded annotation registry to validate.
 * @returns Decoded annotation with reference integrity checked.
 * @throws A SchemaError when the encoded registry violates its schemas or reference-integrity rules.
 * @invariant The returned registry has unique identifiers and no dangling references.
 * @category constructors
 * @since 0.0.0
 */
export const makeAnnotation = (annotation: typeof Annotation.Encoded): Annotation =>
  pipe(makeAnnotationResult(annotation), Result.getOrThrowWith(schemaIssueToError));

type Rebuilt<Schema extends S.Top> = Schema["Rebuild"];

/**
 * Attach validated conformance metadata to an Effect schema.
 *
 * **Example** (Annotate a schema)
 *
 * ```ts
 * import { annotate } from "@beep/schema/Conformance"
 * import * as S from "effect/Schema"
 *
 * const Example = annotate(S.String, {
 *   sources: [{
 *     id: "example-spec",
 *     title: "Example Specification",
 *     role: "primarySpecification",
 *     canonicalUrl: "https://example.com/spec",
 *     revision: { kind: "release", version: "1.0" },
 *     contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   }],
 *   profiles: [{
 *     id: "example",
 *     title: "Example",
 *     version: "1.0",
 *     description: "Example conformance profile.",
 *     sourceIds: ["example-spec"],
 *     invariantIds: ["example.rule"]
 *   }],
 *   invariants: [{
 *     id: "example.rule",
 *     title: "Example rule",
 *     statement: "The value satisfies the rule.",
 *     strength: "must",
 *     scope: "value",
 *     decidability: "localRuntime",
 *     enforcement: [{ kind: "runtime", validator: "Example.validate" }],
 *     references: [{ sourceId: "example-spec" }]
 *   }]
 * })
 *
 * console.log(Example)
 * ```
 *
 * @param schema - Target schema rebuilt with the custom annotation.
 * @param annotation - Encoded registry validated before attachment.
 * @returns Schema carrying a validated `conformance` annotation.
 * @throws A SchemaError when the encoded registry violates its schemas or reference-integrity rules.
 * @invariant Invalid or referentially inconsistent metadata is never attached.
 * @category combinators
 * @since 0.0.0
 */
export const annotateConformance: {
  <Schema extends S.Top>(annotation: typeof Annotation.Encoded): (schema: Schema) => Rebuilt<Schema>;
  <Schema extends S.Top>(schema: Schema, annotation: typeof Annotation.Encoded): Rebuilt<Schema>;
} = dual(
  2,
  <Schema extends S.Top>(schema: Schema, annotation: typeof Annotation.Encoded): Rebuilt<Schema> =>
    schema.annotate({ conformance: makeAnnotation(annotation) })
);
