# Effect JSON Schema Metadata

Access date: 2026-06-04

## Sources

- `.repos/effect-v4/packages/effect/src/JsonSchema.ts`
- `.repos/effect-v4/packages/effect/src/Schema.ts`
- `.repos/effect-v4/packages/effect/SCHEMA.md`
- `packages/tooling/library/repo-utils/src/schemas/PackageJsonTools.ts`
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12

## Confirmed API

`S.toJsonSchemaDocument(schema, options?)` returns:

```ts
JsonSchema.Document<"draft-2020-12">
```

The source shape is:

```ts
{
  dialect: "draft-2020-12",
  schema: JsonSchema.JsonSchema,
  definitions: JsonSchema.Definitions
}
```

The local Effect docs include older examples that mention `source`, but the
source code returns `dialect`. Future implementation should trust the source.

## Relevant Options

`ToJsonSchemaOptions` supports:

- `additionalProperties?: boolean | JsonSchema.JsonSchema`
- `generateDescriptions?: boolean`
- `includeAnnotationKey?: (key: string) => boolean`

Standard JSON Schema keys are included when present. Non-standard annotation
keys require `includeAnnotationKey`. The Effect source warns against broad
predicates such as `() => true`, because they can leak internal annotations.

Recommended v1 defaults:

```ts
S.toJsonSchemaDocument(sourceSchema, {
  additionalProperties: false,
  generateDescriptions: true,
  includeAnnotationKey: (key) => key.startsWith("x-")
})
```

## Repo Precedent

`packages/tooling/library/repo-utils/src/schemas/PackageJsonTools.ts` exports
derived JSON Schema documents:

```ts
export const packageJsonJsonSchema = S.toJsonSchemaDocument(PackageJson);
export const npmPackageJsonJsonSchema = S.toJsonSchemaDocument(NpmPackageJson);
```

That supports treating JSON Schema output as a durable derived artifact.

## Ontology Sidecar Design

For each assembled source class schema:

1. Derive a Draft 2020-12 document with `S.toJsonSchemaDocument(...)`.
2. Attach the full document as non-RDF metadata.
3. Preserve `schema` and `definitions`.
4. Store the source class IRI and schema identity beside the document.
5. Do not emit the sidecar into JSON-LD, Turtle, or RDF triples by default.

The sidecar is for API, tooling, editor, validation, and RAG ingestion
workflows. RDF/OWL/SKOS projections remain semantic ontology projections.

## Risks

- Some schemas need JSON codec annotations to produce meaningful JSON Schema.
  Runtime-only class instances or declarations can degrade unless a JSON-safe
  representation is declared.
- Broad annotation inclusion can leak Effect-internal metadata.
- JSON Schema dialect conversion to Draft-07 or OpenAPI should be a later
  projection concern, not v1 ontology assembly policy.
- Aggregating multiple class sidecars into one dialect document needs a later
  naming and `$defs` collision policy.
