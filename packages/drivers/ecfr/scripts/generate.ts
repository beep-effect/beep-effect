/**
 * Bespoke eCFR code generator.
 *
 * Reads the checked-in Swagger 2.0 `openapi.json` and emits idiomatic beep
 * effect/Schema value models + operation descriptors into
 * `src/_generated/Ecfr.generated.ts`. A bespoke renderer (not
 * `@effect/openapi-generator`) is used deliberately — see the P1 generator spike
 * (`goals/gov-legal-data-driver-codegen/research/2026-06-30-ecfr-generator-spike.md`):
 * the generator exposes no Swagger-2.0 source dialect, drops `format: date`
 * semantics, and eCFR's published spec is not cleanly machine-fetchable.
 *
 * Codegen emits value models + operation descriptors ONLY. Transport (auth,
 * retry, cache, rate-limit, `Context.Service` wiring) stays hand-authored.
 *
 * Run: `bun run scripts/generate.ts` (the package `generate` script also runs
 * `biome check --write` over the output for deterministic formatting).
 */

import { BunRuntime } from "@effect/platform-bun";
import { Effect, Match, MutableHashSet } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Str from "effect/String";

const packageRoot = new URL("../", import.meta.url);
const specPath = new URL("openapi.json", packageRoot);
const outPath = new URL("src/_generated/Ecfr.generated.ts", packageRoot);

interface JsonSchema {
  readonly $ref?: string;
  readonly description?: string;
  readonly format?: string;
  readonly items?: JsonSchema;
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: ReadonlyArray<string>;
  readonly type?: string;
}

interface Operation {
  readonly operationId: string;
  readonly responses: Record<string, { readonly description?: string; readonly schema?: JsonSchema }>;
  readonly summary?: string;
}

interface Spec {
  readonly basePath: string;
  readonly definitions: Record<string, JsonSchema>;
  readonly host: string;
  readonly paths: Record<string, Record<string, Operation>>;
}

const refName = (ref: string): string => ref.slice(ref.lastIndexOf("/") + 1);

const schemaExpr = (schema: JsonSchema): string => {
  if (schema.$ref !== undefined) return refName(schema.$ref);
  return Match.value(schema.type).pipe(
    Match.when("integer", () => "S.Int"),
    Match.when("number", () => "S.Finite"),
    Match.when("boolean", () => "S.Boolean"),
    Match.when("array", () => `${schemaExpr(schema.items ?? { type: "string" })}.pipe(S.Array)`),
    Match.orElse(() => "S.String")
  );
};

const refsOf = (schema: JsonSchema): ReadonlyArray<string> => {
  if (schema.$ref !== undefined) return [refName(schema.$ref)];
  if (schema.type === "array" && schema.items !== undefined) return refsOf(schema.items);
  if (schema.properties !== undefined) return R.values(schema.properties).flatMap(refsOf);
  return [];
};

/** Deterministic dependency-first ordering (referenced models before referrers). */
const topoSort = (definitions: Record<string, JsonSchema>): ReadonlyArray<string> => {
  const names = R.keys(definitions).sort();
  const emitted: Array<string> = [];
  const visited = MutableHashSet.empty<string>();
  const visit = (name: string): void => {
    if (MutableHashSet.has(visited, name) || definitions[name] === undefined) return;
    MutableHashSet.add(visited, name);
    for (const dep of A.dedupe(refsOf(definitions[name])).sort()) visit(dep);
    emitted.push(name);
  };
  for (const name of names) visit(name);
  return emitted;
};

const propLine = (name: string, schema: JsonSchema, required: boolean): string => {
  const expr = schemaExpr(schema);
  const base = required ? expr : `S.optionalKey(${expr})`;
  const field =
    schema.description !== undefined
      ? `${base}.annotateKey({ description: ${JSON.stringify(schema.description)} })`
      : base;
  const dateNote = schema.format === "date" ? ` // ${schema.format} (YYYY-MM-DD)` : "";
  return `    ${JSON.stringify(name)}: ${field},${dateNote}`;
};

/** A synthetic-but-valid example value literal for a field, given its schema and property name. */
const exampleValueExpr = (
  schema: JsonSchema,
  propertyName: string,
  definitions: Record<string, JsonSchema>
): string => {
  if (schema.$ref !== undefined) {
    const refSchema = definitions[refName(schema.$ref)];
    return refSchema === undefined
      ? "{}"
      : `${refName(schema.$ref)}.make(${exampleFieldsLiteral(refSchema, definitions)})`;
  }
  return Match.value(schema.type).pipe(
    Match.when("integer", () => "1"),
    Match.when("number", () => "1"),
    Match.when("boolean", () => "true"),
    Match.when("array", () => `[${exampleValueExpr(schema.items ?? { type: "string" }, propertyName, definitions)}]`),
    Match.orElse(() => JSON.stringify(`example-${propertyName}`))
  );
};

/**
 * Example `.make({...})` field literal covering only the required fields, so
 * every generated example is minimal but always valid. Single-line so it can
 * be embedded in a `@example` fence without breaking the JSDoc `* ` prefix on
 * continuation lines.
 */
const exampleFieldsLiteral = (schema: JsonSchema, definitions: Record<string, JsonSchema>): string => {
  const required = MutableHashSet.fromIterable(schema.required ?? []);
  const props = R.toEntries(schema.properties ?? {})
    .filter(([key]) => MutableHashSet.has(required, key))
    .map(([key, value]) => `${JSON.stringify(key)}: ${exampleValueExpr(value, key, definitions)}`)
    .join(", ");
  return `{ ${props} }`;
};

/** Model names referenced by a `$ref` example (the ref itself, plus its own transitive refs). */
const exampleRefsOfRef = (ref: string, definitions: Record<string, JsonSchema>): ReadonlyArray<string> => {
  const name = refName(ref);
  const refSchema = definitions[name];
  return refSchema === undefined ? [name] : [name, ...exampleRefsOf(refSchema, definitions)];
};

/** Model names referenced by an example built from a schema's required fields only. */
const exampleRefsOfProperties = (
  schema: JsonSchema,
  definitions: Record<string, JsonSchema>
): ReadonlyArray<string> => {
  const requiredSet = MutableHashSet.fromIterable(schema.required ?? []);
  return R.toEntries(schema.properties ?? {})
    .filter(([key]) => MutableHashSet.has(requiredSet, key))
    .flatMap(([, value]) => exampleRefsOf(value, definitions));
};

/** Model names referenced by an array-typed example, resolved through its item schema. */
const exampleRefsOfArrayItems = (schema: JsonSchema, definitions: Record<string, JsonSchema>): ReadonlyArray<string> =>
  exampleRefsOf(schema.items ?? { type: "string" }, definitions);

/** Model names referenced (recursively, required fields only) by an example built from this schema. */
const exampleRefsOf = (schema: JsonSchema, definitions: Record<string, JsonSchema>): ReadonlyArray<string> => {
  if (schema.$ref !== undefined) return exampleRefsOfRef(schema.$ref, definitions);
  if (schema.type === "array") return exampleRefsOfArrayItems(schema, definitions);
  if (schema.properties === undefined) return [];
  return exampleRefsOfProperties(schema, definitions);
};

const requiredFieldSet = (schema: JsonSchema): MutableHashSet.MutableHashSet<string> =>
  MutableHashSet.fromIterable(schema.required ?? []);

const renderModelFields = (schema: JsonSchema, required: MutableHashSet.MutableHashSet<string>): string =>
  R.toEntries(schema.properties ?? {})
    .map(([key, value]) => propLine(key, value, MutableHashSet.has(required, key)))
    .join("\n");

const modelDescription = (name: string, schema: JsonSchema): string =>
  schema.description ?? `The ${name} eCFR value model.`;

/** The first required field name, used to pick a field to log in the generated `@example`. */
const firstRequiredFieldName = (
  schema: JsonSchema,
  required: MutableHashSet.MutableHashSet<string>
): string | undefined => R.toEntries(schema.properties ?? {}).find(([key]) => MutableHashSet.has(required, key))?.[0];

const exampleAccessorFor = (fieldName: string | undefined): string => (fieldName === undefined ? "" : `.${fieldName}`);

const renderObjectModel = (name: string, schema: JsonSchema, definitions: Record<string, JsonSchema>): string => {
  const required = requiredFieldSet(schema);
  const props = renderModelFields(schema, required);
  const description = modelDescription(name, schema);
  const exampleAccessor = exampleAccessorFor(firstRequiredFieldName(schema, required));
  const exampleImports = A.dedupe([name, ...exampleRefsOf(schema, definitions)]).sort();
  return `/**
 * ${description}
 *
 * @example
 * \`\`\`ts
 * import { ${exampleImports.join(", ")} } from "@beep/ecfr"
 *
 * const value = ${name}.make(${exampleFieldsLiteral(schema, definitions)})
 * console.log(value${exampleAccessor})
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ${name} extends S.Class<${name}>($I\`${name}\`)(
  {
${props}
  },
  $I.annote(${JSON.stringify(name)}, {
    description: ${JSON.stringify(description)},
  })
) { static readonly is = S.is(${name}); }`;
};

const renderArrayModel = (name: string, schema: JsonSchema, definitions: Record<string, JsonSchema>): string => {
  const description = modelDescription(name, schema);
  const item = schema.items ?? { type: "string" };
  const exampleImports = A.dedupe([name, ...exampleRefsOfArrayItems(schema, definitions)]).sort();
  return `/**
 * ${description}
 *
 * @example
 * \`\`\`ts
 * import { ${exampleImports.join(", ")} } from "@beep/ecfr"
 * import * as S from "effect/Schema"
 *
 * const value = S.decodeUnknownEffect(${name})([${exampleValueExpr(item, "item", definitions)}])
 * console.log(value)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const ${name} = ${schemaExpr(item)}.pipe(
  S.Array,
  $I.annoteSchema(${JSON.stringify(name)}, { description: ${JSON.stringify(description)} })
);

/**
 * Type for {@link ${name}}.
 *
 * @example
 * \`\`\`ts
 * import type { ${name} } from "@beep/ecfr"
 *
 * const value: ${name} = []
 * console.log(value.length)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type ${name} = typeof ${name}.Type;`;
};

const renderModel = (name: string, schema: JsonSchema, definitions: Record<string, JsonSchema>): string =>
  Match.value(schema.type).pipe(
    Match.when("array", () => renderArrayModel(name, schema, definitions)),
    Match.orElse(() => renderObjectModel(name, schema, definitions))
  );

const operationsOf = (
  spec: Spec
): ReadonlyArray<{ readonly op: Operation; readonly method: string; readonly path: string }> =>
  R.toEntries(spec.paths)
    .flatMap(([path, methods]) =>
      R.toEntries(methods).map(([method, op]) => ({ method: Str.toUpperCase(method), op, path }))
    )
    .sort((a, b) => a.op.operationId.localeCompare(b.op.operationId));

const responseModel = (op: Operation): string => {
  const schema = op.responses["200"]?.schema;
  return schema === undefined ? "S.Unknown" : schemaExpr(schema);
};

const renderOperationConst = (entry: {
  readonly op: Operation;
  readonly method: string;
  readonly path: string;
}): string =>
  `/**
 * The \`${entry.op.operationId}\` eCFR operation descriptor.
 *
 * @example
 * \`\`\`ts
 * import { ${entry.op.operationId}Operation } from "@beep/ecfr"
 *
 * console.log(${entry.op.operationId}Operation.path)
 * \`\`\`
 *
 * @category endpoints
 * @since 0.0.0
 */
export const ${entry.op.operationId}Operation = EcfrOperationDescriptor.make({
  method: ${JSON.stringify(entry.method)},
  operationId: ${JSON.stringify(entry.op.operationId)},
  path: ${JSON.stringify(entry.path)},
});`;

const render = (spec: Spec): string => {
  const models = topoSort(spec.definitions)
    .map((name) => renderModel(name, spec.definitions[name]!, spec.definitions))
    .join("\n\n");
  const operations = operationsOf(spec);
  const operationConsts = operations.map(renderOperationConst).join("\n\n");
  const specEntries = operations
    .map(
      (entry) =>
        `  ${entry.op.operationId}: { descriptor: ${entry.op.operationId}Operation, response: ${responseModel(entry.op)} },`
    )
    .join("\n");
  const firstOperationId = operations[0]?.op.operationId;

  return `/**
 * Generated eCFR value models and operation descriptors.
 *
 * Do not edit this file by hand. Run \`bun run generate\` to regenerate from
 * \`openapi.json\`. Transport stays hand-authored (see \`Ecfr.service.ts\`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EcfrId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $EcfrId.create("_generated/Ecfr.generated");

${models}

/**
 * Descriptor for a single eCFR REST operation.
 *
 * @example
 * \`\`\`ts
 * import { EcfrOperationDescriptor } from "@beep/ecfr"
 *
 * const descriptor = EcfrOperationDescriptor.make({ method: "GET", operationId: "example", path: "/example.json" })
 * console.log(descriptor.path)
 * \`\`\`
 *
 * @category endpoints
 * @since 0.0.0
 */
export class EcfrOperationDescriptor extends S.Class<EcfrOperationDescriptor>($I\`EcfrOperationDescriptor\`)(
  {
    method: S.String,
    operationId: S.String,
    path: S.String,
  },
  $I.annote("EcfrOperationDescriptor", {
    description: "Descriptor for a single eCFR REST operation.",
  })
) {}

${operationConsts}

/**
 * All generated eCFR operation descriptors keyed by operation id.
 *
 * @example
 * \`\`\`ts
 * import { ECFR_OPERATIONS } from "@beep/ecfr"
 *
 * console.log(ECFR_OPERATIONS${firstOperationId !== undefined ? `.${firstOperationId}.descriptor.path` : ""})
 * \`\`\`
 *
 * @category endpoints
 * @since 0.0.0
 */
export const ECFR_OPERATIONS = {
${specEntries}
} as const;
`;
};

const main = Effect.gen(function* () {
  const spec = (yield* Effect.tryPromise(() => Bun.file(specPath).json())) as Spec;
  yield* Effect.tryPromise(() => Bun.write(outPath, render(spec)));
  const count = R.keys(spec.definitions).length;
  yield* Effect.log(
    `Generated ${count} eCFR models + ${operationsOf(spec).length} operations -> src/_generated/Ecfr.generated.ts`
  );
}).pipe(Effect.withSpan("Ecfr.generate"));

BunRuntime.runMain(main);
