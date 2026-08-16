/**
 * Schema package topology lint command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";

const $I = $RepoCliId.create("commands/Lint/SchemaTopology");

const SCHEMA_PACKAGE_ROOT = "packages/foundation/modeling/schema";
const SCHEMA_SOURCE_ROOT = `${SCHEMA_PACKAGE_ROOT}/src`;
const ROOT_TSCONFIG_PATH = "tsconfig.json";
const LEGACY_TOPICAL_SEGMENTS = ["blockchain", "color", "csv", "dom", "http", "location", "person"] as const;
const LEGACY_CASE_EXPORT_PREFIXES = ["ExpectCT", "XSSProtection"] as const;
const RETIRED_SUITE_EXPORT_PREFIXES = ["Blockchain", "Dom", "Http", "Location", "Person"] as const;
const RETIRED_INTERNAL_EXPORT_KEYS = ["./internal/markdown", "./internal/yaml"] as const;
const PROMOTED_CONCEPT_ROOT_SHIMS = [
  "DateTimeUtcFromValid",
  "Duration",
  "FilePath",
  "Fn",
  "Glob",
  "Graph",
  "LiteralKit",
  "LocalDate",
  "MappedLiteralKit",
  "Record",
  "Timestamp",
] as const;

/**
 * Schema topology lint violation.
 *
 * **Example** (Make topology violation)
 *
 * ```ts
 * import { SchemaTopologyViolation } from "@beep/repo-cli/commands/Lint"
 *
 * const violation = SchemaTopologyViolation.make({
 *   detail: "legacy schema export",
 *   file: "packages/foundation/modeling/schema/package.json",
 * })
 * console.log(violation.detail)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaTopologyViolation extends S.Class<SchemaTopologyViolation>($I`SchemaTopologyViolation`)(
  {
    file: S.String,
    detail: S.String,
  },
  $I.annote("SchemaTopologyViolation", {
    description: "Schema topology lint violation.",
  })
) {}

const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const schemaRoleFileTargetPattern = /^\.\/(?:src|dist)\/[A-Z][^/]+\/[^/]+\.[a-z][A-Za-z0-9-]*\.(?:ts|js)$/u;
const crossConceptIndexExportPattern =
  /^\s*export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?from\s+["']\.\.\/[^"']+["']/mu;

const exists = (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<boolean> =>
  fs.exists(filePath).pipe(Effect.orElseSucceed(thunkFalse));

const isRecord = (value: unknown): value is R.ReadonlyRecord<string, unknown> => P.isObject(value) && !A.isArray(value);

const recordAt = (value: R.ReadonlyRecord<string, unknown>, key: string): R.ReadonlyRecord<string, unknown> =>
  pipe(value[key], (candidate) => (isRecord(candidate) ? candidate : R.empty()));

const collectExportTargets = (value: unknown): ReadonlyArray<string> => {
  if (P.isString(value)) {
    return A.of(value);
  }

  if (!isRecord(value)) {
    return A.empty();
  }

  return pipe(
    R.values(value),
    A.flatMap((entry) => collectExportTargets(entry))
  );
};

const isLegacyTopicalExportKey = (specifier: string): boolean =>
  pipe(
    LEGACY_TOPICAL_SEGMENTS,
    A.some((segment) => specifier === `./${segment}` || Str.startsWith(`./${segment}/`)(specifier))
  );

const isLegacyCaseExportKey = (specifier: string): boolean =>
  pipe(
    LEGACY_CASE_EXPORT_PREFIXES,
    A.some(
      (prefix) =>
        specifier === `./${prefix}` || specifier === `./${prefix}/*` || Str.startsWith(`./${prefix}/`)(specifier)
    )
  );

const isRetiredSuiteExportKey = (specifier: string): boolean =>
  pipe(
    RETIRED_SUITE_EXPORT_PREFIXES,
    A.some((prefix) => specifier === `./${prefix}` || specifier === `./${prefix}/*`)
  );

const isRetiredInternalExportKey = (specifier: string): boolean =>
  pipe(
    RETIRED_INTERNAL_EXPORT_KEYS,
    A.some((retiredSpecifier) => Str.equivalence(specifier, retiredSpecifier))
  );

const isLegacyTopicalTarget = (target: string): boolean =>
  pipe(
    LEGACY_TOPICAL_SEGMENTS,
    A.some(
      (segment) =>
        Str.includes(`/src/${segment}/`)(target) ||
        Str.includes(`/dist/${segment}/`)(target) ||
        Str.includes(`./src/${segment}/`)(target) ||
        Str.includes(`./dist/${segment}/`)(target)
    )
  );

const isRetiredSuiteTarget = (target: string): boolean =>
  pipe(
    RETIRED_SUITE_EXPORT_PREFIXES,
    A.some(
      (prefix) =>
        Str.includes(`/src/${prefix}/`)(target) ||
        Str.includes(`/dist/${prefix}/`)(target) ||
        Str.includes(`./src/${prefix}/`)(target) ||
        Str.includes(`./dist/${prefix}/`)(target)
    )
  );

const isRetiredInternalTarget = (target: string): boolean =>
  target === "./src/internal/markdown.ts" ||
  target === "./src/internal/yaml.ts" ||
  target === "./dist/internal/markdown.js" ||
  target === "./dist/internal/yaml.js";

const isPublicRoleFileTarget = (target: string): boolean => schemaRoleFileTargetPattern.test(target);

const exportRecordViolations = (
  file: string,
  section: string,
  exports: Readonly<Record<string, unknown>>
): ReadonlyArray<SchemaTopologyViolation> => {
  let violations = A.empty<SchemaTopologyViolation>();

  for (const [specifier, target] of R.toEntries(exports)) {
    if (isLegacyTopicalExportKey(specifier)) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file,
          detail: `${section} exposes retired lowercase schema subpath ${specifier}`,
        })
      );
    }

    if (isLegacyCaseExportKey(specifier)) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file,
          detail: `${section} exposes retired compatibility casing subpath ${specifier}`,
        })
      );
    }

    if (isRetiredSuiteExportKey(specifier)) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file,
          detail: `${section} exposes retired schema suite aggregator subpath ${specifier}`,
        })
      );
    }

    if (isRetiredInternalExportKey(specifier)) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file,
          detail: `${section} exposes retired public schema parser seam ${specifier}; use @beep/schema/test/* in source tests`,
        })
      );
    }

    for (const exportTarget of collectExportTargets(target)) {
      if (isLegacyTopicalTarget(exportTarget)) {
        violations = A.append(
          violations,
          SchemaTopologyViolation.make({
            file,
            detail: `${section} target ${specifier} points at retired lowercase topology path ${exportTarget}`,
          })
        );
      }

      if (isRetiredSuiteTarget(exportTarget)) {
        violations = A.append(
          violations,
          SchemaTopologyViolation.make({
            file,
            detail: `${section} target ${specifier} points at retired schema suite aggregator path ${exportTarget}`,
          })
        );
      }

      if (isRetiredInternalTarget(exportTarget)) {
        violations = A.append(
          violations,
          SchemaTopologyViolation.make({
            file,
            detail: `${section} target ${specifier} exposes retired parser seam target ${exportTarget}`,
          })
        );
      }

      if (isPublicRoleFileTarget(exportTarget)) {
        violations = A.append(
          violations,
          SchemaTopologyViolation.make({
            file,
            detail: `${section} target ${specifier} exposes private role file ${exportTarget}; export the concept index instead`,
          })
        );
      }
    }
  }

  return violations;
};

const collectSourcePathViolations = Effect.fn("SchemaTopology.collectSourcePathViolations")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<SchemaTopologyViolation>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let violations = A.empty<SchemaTopologyViolation>();

  for (const segment of LEGACY_TOPICAL_SEGMENTS) {
    const topicalPath = path.join(repoRoot, SCHEMA_SOURCE_ROOT, segment);
    const topicalPathExists = yield* exists(fs, topicalPath);

    if (topicalPathExists) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file: normalizePath(path.relative(repoRoot, topicalPath)),
          detail: `retired lowercase schema source directory "${segment}" must not exist`,
        })
      );
    }
  }

  for (const concept of PROMOTED_CONCEPT_ROOT_SHIMS) {
    const shimPath = path.join(repoRoot, SCHEMA_SOURCE_ROOT, `${concept}.ts`);
    const shimExists = yield* exists(fs, shimPath);

    if (shimExists) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file: normalizePath(path.relative(repoRoot, shimPath)),
          detail: `promoted schema concept "${concept}" must live behind ${concept}/index.ts, not a root shim file`,
        })
      );
    }
  }

  const schemaSourcePath = path.join(repoRoot, SCHEMA_SOURCE_ROOT);
  const entries = yield* fs.readDirectory(schemaSourcePath).pipe(Effect.orElseSucceed(A.empty<string>));

  for (const entry of entries) {
    const indexFile = path.join(schemaSourcePath, entry, "index.ts");
    const indexExists = yield* exists(fs, indexFile);

    if (!indexExists) {
      continue;
    }

    const content = yield* fs.readFileString(indexFile).pipe(Effect.orElseSucceed(() => Str.empty));

    if (crossConceptIndexExportPattern.test(content)) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file: normalizePath(path.relative(repoRoot, indexFile)),
          detail: "concept index files must not re-export sibling concept modules",
        })
      );
    }
  }

  return violations;
});

const collectPackageJsonViolations = Effect.fn("SchemaTopology.collectPackageJsonViolations")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<SchemaTopologyViolation>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageJsonFile = path.join(repoRoot, SCHEMA_PACKAGE_ROOT, "package.json");
  const packageJson = yield* fs.readFileString(packageJsonFile).pipe(
    Effect.flatMap(decodeJson),
    Effect.orElseSucceed(() => ({}))
  );

  if (!isRecord(packageJson)) {
    return [
      SchemaTopologyViolation.make({
        file: normalizePath(path.relative(repoRoot, packageJsonFile)),
        detail: "package.json must decode to an object",
      }),
    ];
  }

  const relativePackageJsonFile = normalizePath(path.relative(repoRoot, packageJsonFile));
  const publishConfig = recordAt(packageJson, "publishConfig");

  return [
    ...exportRecordViolations(relativePackageJsonFile, "exports", recordAt(packageJson, "exports")),
    ...exportRecordViolations(relativePackageJsonFile, "publishConfig.exports", recordAt(publishConfig, "exports")),
  ];
});

const collectTsconfigViolations = Effect.fn("SchemaTopology.collectTsconfigViolations")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<SchemaTopologyViolation>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tsconfigFile = path.join(repoRoot, ROOT_TSCONFIG_PATH);
  const content = yield* fs.readFileString(tsconfigFile).pipe(Effect.orElseSucceed(() => Str.empty));
  let violations = A.empty<SchemaTopologyViolation>();

  for (const segment of LEGACY_TOPICAL_SEGMENTS) {
    if (
      Str.includes(`@beep/schema/${segment}`)(content) ||
      Str.includes(`${SCHEMA_SOURCE_ROOT}/${segment}/`)(content)
    ) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file: ROOT_TSCONFIG_PATH,
          detail: `root tsconfig contains retired lowercase schema topology segment "${segment}"`,
        })
      );
    }
  }

  for (const concept of RETIRED_SUITE_EXPORT_PREFIXES) {
    const aliasPattern = new RegExp(`"@beep/schema/${concept}(?:/\\*|")`, "u");

    if (aliasPattern.test(content) || Str.includes(`${SCHEMA_SOURCE_ROOT}/${concept}/`)(content)) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file: ROOT_TSCONFIG_PATH,
          detail: `root tsconfig contains retired schema suite aggregator alias "${concept}"`,
        })
      );
    }
  }

  for (const retiredInternalExportKey of RETIRED_INTERNAL_EXPORT_KEYS) {
    const aliasKey = `@beep/schema/${Str.replace("./", "")(retiredInternalExportKey)}`;

    if (
      Str.includes(`"${aliasKey}"`)(content) ||
      Str.includes(`${SCHEMA_SOURCE_ROOT}/${Str.replace("./", "")(retiredInternalExportKey)}.`)(content)
    ) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file: ROOT_TSCONFIG_PATH,
          detail: `root tsconfig contains retired public parser seam alias "${aliasKey}"`,
        })
      );
    }
  }

  for (const concept of PROMOTED_CONCEPT_ROOT_SHIMS) {
    if (Str.includes(`${SCHEMA_SOURCE_ROOT}/${concept}.ts`)(content)) {
      violations = A.append(
        violations,
        SchemaTopologyViolation.make({
          file: ROOT_TSCONFIG_PATH,
          detail: `root tsconfig points at promoted schema root shim ${concept}.ts`,
        })
      );
    }
  }

  return violations;
});

/**
 * Collect schema topology violations without mutating process state.
 *
 * **Example** (Collect topology violations)
 *
 * ```ts
 * import { collectSchemaTopologyViolations } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const violations = yield* collectSchemaTopologyViolations()
 *   console.log(violations.length)
 * })
 * console.log(program) // example value
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const collectSchemaTopologyViolations = Effect.fn("SchemaTopology.collectSchemaTopologyViolations")(
  function* (): Effect.fn.Return<ReadonlyArray<SchemaTopologyViolation>, never, FileSystem.FileSystem | Path.Path> {
    const path = yield* Path.Path;
    const repoRoot = normalizePath(path.resolve(process.cwd()));
    const violations = [
      ...(yield* collectSourcePathViolations(repoRoot)),
      ...(yield* collectPackageJsonViolations(repoRoot)),
      ...(yield* collectTsconfigViolations(repoRoot)),
    ];

    return pipe(
      violations,
      A.sort(
        Order.mapInput(
          Order.String,
          (violation: SchemaTopologyViolation): string => `${violation.file}:${violation.detail}`
        )
      )
    );
  }
);

/**
 * Run the schema topology lint command.
 *
 * **Example** (Invoke schema topology lint)
 *
 * ```ts
 * console.log("bun run beep lint schema-topology")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runSchemaTopologyLint = Effect.fn("SchemaTopology.runSchemaTopologyLint")(function* () {
  const violations = yield* collectSchemaTopologyViolations();

  if (A.isReadonlyArrayNonEmpty(violations)) {
    yield* Console.error("[schema-topology] canonical @beep/schema topology violations found.");

    for (const violation of violations) {
      yield* Console.error(`${violation.file} ${violation.detail}`);
    }

    return yield* failWithReportedExit("schema-topology: topology violations found.");
  }

  yield* Console.log("[schema-topology] OK: @beep/schema topology is canonical.");
});

/**
 * Lint command for enforcing canonical `@beep/schema` topology.
 *
 * **Example** (Run schema topology command)
 *
 * ```ts
 * console.log("bun run beep lint schema-topology")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lintSchemaTopologyCommand = Command.make("schema-topology", {}, runSchemaTopologyLint).pipe(
  Command.withDescription("Check @beep/schema source, exports, and root aliases for canonical topology")
);
