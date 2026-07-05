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
  switch (schema.type) {
    case "integer":
      return "S.Int";
    case "number":
      return "S.Finite";
    case "boolean":
      return "S.Boolean";
    case "array":
      return `S.Array(${schemaExpr(schema.items ?? { type: "string" })})`;
    default:
      return "S.String";
  }
};

const refsOf = (schema: JsonSchema): ReadonlyArray<string> => {
  if (schema.$ref !== undefined) return [refName(schema.$ref)];
  if (schema.type === "array" && schema.items !== undefined) return refsOf(schema.items);
  if (schema.properties !== undefined) return Object.values(schema.properties).flatMap(refsOf);
  return [];
};

/** Deterministic dependency-first ordering (referenced models before referrers). */
const topoSort = (definitions: Record<string, JsonSchema>): ReadonlyArray<string> => {
  const names = Object.keys(definitions).sort();
  const emitted: Array<string> = [];
  const visited = new Set<string>();
  const visit = (name: string): void => {
    if (visited.has(name) || definitions[name] === undefined) return;
    visited.add(name);
    for (const dep of [...new Set(refsOf(definitions[name]))].sort()) visit(dep);
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

const renderModel = (name: string, schema: JsonSchema): string => {
  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {})
    .map(([key, value]) => propLine(key, value, required.has(key)))
    .join("\n");
  const description = schema.description ?? `The ${name} eCFR value model.`;
  return `/**
 * ${description}
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
) {}`;
};

const operationsOf = (
  spec: Spec
): ReadonlyArray<{ readonly op: Operation; readonly method: string; readonly path: string }> =>
  Object.entries(spec.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, op]) => ({ method: method.toUpperCase(), op, path }))
    )
    .sort((a, b) => a.op.operationId.localeCompare(b.op.operationId));

const responseModel = (op: Operation): string => {
  const schema = op.responses["200"]?.schema;
  return schema?.$ref !== undefined ? refName(schema.$ref) : "S.Unknown";
};

const renderOperationConst = (entry: {
  readonly op: Operation;
  readonly method: string;
  readonly path: string;
}): string =>
  `/**
 * The \`${entry.op.operationId}\` eCFR operation descriptor.
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
    .map((name) => renderModel(name, spec.definitions[name]!))
    .join("\n\n");
  const operations = operationsOf(spec);
  const operationConsts = operations.map(renderOperationConst).join("\n\n");
  const specEntries = operations
    .map(
      (entry) =>
        `  ${entry.op.operationId}: { descriptor: ${entry.op.operationId}Operation, response: ${responseModel(entry.op)} },`
    )
    .join("\n");

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
 * @category endpoints
 * @since 0.0.0
 */
export const ECFR_OPERATIONS = {
${specEntries}
} as const;
`;
};

const main = async (): Promise<void> => {
  const spec = (await Bun.file(specPath).json()) as Spec;
  await Bun.write(outPath, render(spec));
  const count = Object.keys(spec.definitions).length;
  console.log(
    `Generated ${count} eCFR models + ${operationsOf(spec).length} operations -> src/_generated/Ecfr.generated.ts`
  );
};

await main();
