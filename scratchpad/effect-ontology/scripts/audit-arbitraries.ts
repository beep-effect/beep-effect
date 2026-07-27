/**
 * Audits every public schema declaration in the quarantined Domain tree.
 *
 * @remarks
 * Derivation must be warning-free, and every generated decoded value must
 * satisfy the schema that produced it. Scanning source modules rather than
 * barrels also catches schemas intentionally kept on explicit subpaths.
 *
 * @example
 * ```sh
 * bun run --cwd scratchpad audit:effect-ontology-arbitraries
 * ```
 *
 * @category tooling
 * @since 0.0.0
 */
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { FastCheck as fc } from "effect/testing";

const sampleCount = 8;
const baseSeed = 0x5eed;
const domainRoot = new URL("../Domain/", import.meta.url);
const domainModules = new Bun.Glob("**/*.ts");

let auditedModules = 0;
let auditedSchemas = 0;
let auditedSamples = 0;

for await (const relativePath of domainModules.scan({
  cwd: domainRoot.pathname,
})) {
  auditedModules += 1;
  const moduleExports: Readonly<Record<string, unknown>> = await import(new URL(relativePath, domainRoot).href);

  for (const [exportName, value] of Object.entries(moduleExports)) {
    if (!/^[A-Z]/.test(exportName) || !S.isSchema(value)) {
      continue;
    }

    auditedSchemas += 1;
    const annotationGaps = [
      ["identifier", SchemaAST.resolveIdentifier(value.ast)],
      ["title", SchemaAST.resolveTitle(value.ast)],
      ["description", SchemaAST.resolveDescription(value.ast)],
      ["toArbitrary", SchemaAST.resolve(value.ast)?.toArbitrary],
    ].flatMap(([name, annotation]) => (annotation === undefined ? [name] : []));

    if (annotationGaps.length > 0) {
      throw new Error(`${relativePath}:${exportName} is missing schema annotations: ${annotationGaps.join(", ")}`);
    }

    const arbitrary = S.toArbitrary(value, { report: true });

    if (arbitrary.report.warnings.length > 0) {
      throw new Error(
        `${relativePath}:${exportName} produced arbitrary warnings:\n${JSON.stringify(
          arbitrary.report.warnings,
          null,
          2
        )}`
      );
    }

    const samples = fc.sample(arbitrary.value, {
      numRuns: sampleCount,
      seed: baseSeed + auditedSchemas,
    });
    auditedSamples += samples.length;

    if (!samples.every((sample) => S.is(value)(sample))) {
      throw new Error(`${relativePath}:${exportName} generated a value outside its decoded schema`);
    }
  }
}

Effect.runSync(
  Effect.log({
    modules: auditedModules,
    schemas: auditedSchemas,
    annotatedSchemas: auditedSchemas,
    samples: auditedSamples,
    seed: baseSeed,
    warnings: 0,
    failures: 0,
  })
);
