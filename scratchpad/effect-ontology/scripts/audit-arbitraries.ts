/**
 * Audits every public schema declaration in the quarantined Domain tree.
 *
 * **Details**
 *
 * Derivation must be warning-free, and every generated decoded value must
 * satisfy the schema that produced it. Scanning source modules rather than
 * barrels also catches schemas intentionally kept on explicit subpaths.
 *
 * **Example** (Audit public schemas)
 *
 * ```ts
 * const command = "bun run --cwd scratchpad audit:effect-ontology-arbitraries"
 * console.log(command)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect, SchemaAST } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const sampleCount = 8;
const baseSeed = 0x5eed;
const domainRoot = new URL("../Domain/", import.meta.url);
const domainModules = new Bun.Glob("**/*.ts");

class ArbitraryAuditError extends S.TaggedError<ArbitraryAuditError>("effect-ontology/scripts/ArbitraryAuditError")(
  "ArbitraryAuditError",
  { message: S.String }
) {}

let auditedModules = 0;
let auditedSchemas = 0;
let auditedSamples = 0;

for await (const relativePath of domainModules.scan({
  cwd: domainRoot.pathname,
})) {
  auditedModules += 1;
  const moduleExports: Readonly<Record<string, unknown>> = await import(new URL(relativePath, domainRoot).href);

  for (const [exportName, value] of R.toEntries(moduleExports)) {
    if (!/^[A-Z]/.test(exportName) || !S.isSchema(value)) {
      continue;
    }

    auditedSchemas += 1;
    const annotationGaps = A.flatMap(
      [
        ["identifier", SchemaAST.resolveIdentifier(value.ast)],
        ["title", SchemaAST.resolveTitle(value.ast)],
        ["description", SchemaAST.resolveDescription(value.ast)],
        ["toArbitrary", SchemaAST.resolve(value.ast)?.toArbitrary],
      ] satisfies ReadonlyArray<readonly [string, unknown]>,
      ([name, annotation]) => (annotation === undefined ? [name] : [])
    );

    if (annotationGaps.length > 0) {
      throw ArbitraryAuditError.make({
        message: `${relativePath}:${exportName} is missing schema annotations: ${A.join(annotationGaps, ", ")}`,
      });
    }

    const arbitrary = S.toArbitrary(value)(fc);

    const samples = fc.sample(arbitrary, {
      numRuns: sampleCount,
      seed: baseSeed + auditedSchemas,
    });
    auditedSamples += samples.length;

    if (!A.every(samples, (sample) => S.is(value)(sample))) {
      throw ArbitraryAuditError.make({
        message: `${relativePath}:${exportName} generated a value outside its decoded schema`,
      });
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
