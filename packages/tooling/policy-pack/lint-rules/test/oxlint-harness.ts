/**
 * Vitest-spawns-oxlint rule harness.
 *
 * The oxlint rules in `src/rules/*.ts` are stateful/path-aware oxlint JS plugins, not
 * GritQL rules, so the Biome harness in `harness.ts` cannot exercise them. `@oxlint/plugins`
 * exposes only `defineRule`/`definePlugin` (no in-process rule-tester like ESLint's
 * `RuleTester`), so this harness spawns the oxlint CLI as a subprocess — the same shape as
 * the Biome harness.
 *
 * Each invocation writes a throwaway oxlint config that loads the `@beep/lint-rules` plugin
 * with every native category off and exactly ONE `beep/<rule>` enabled, writes the fixture
 * source to a temp file (whose name the caller controls, so `*.test.ts`-gated and
 * path-exempt rules can be exercised), runs `oxlint --format=json`, and decodes the JSON
 * report through `effect/Schema`. Only the rule under test is enabled, so every returned
 * finding unambiguously belongs to it regardless of advisory (`warn`) vs mandatory (`error`)
 * severity.
 *
 * This is a local test helper (not package `src`); it models all side effects as Effects
 * (FileSystem temp dirs, Path joins, `Bun.spawnSync` subprocess) and decodes the subprocess
 * JSON through `effect/Schema` rather than `JSON.parse`.
 */
import { FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { encodeConfig, jsonReportParser } from "./codec.ts";

/** Absolute path to the package root (`.../lint-rules`). */
const packageRoot = decodeURIComponent(new URL("../", import.meta.url).pathname);

/** Absolute path to the oxlint plugin entry (`src/rules/index.ts`). */
const pluginEntry = decodeURIComponent(new URL("../src/rules/index.ts", import.meta.url).pathname);

/** The oxlint rule ids this harness can exercise (the `beep/<slug>` plugin rules). */
export const OXLINT_RULES = [
  "no-opaque-instance-fields",
  "no-inline-schema-compile",
  "no-js-extension-imports",
  "no-manual-effect-runtime-in-tests",
  "no-global-process-runtime",
  "namespace-node-imports",
] as const;

/**
 * An oxlint rule slug exercised by this harness.
 *
 * @category models
 * @since 0.1.0
 */
export type OxlintRule = (typeof OXLINT_RULES)[number];

/** One normalized oxlint diagnostic: the rule slug it belongs to and its 1-based line. */
type Finding = {
  readonly ruleId: string;
  readonly line: number;
};

const ReportLine = S.Int.check(S.isGreaterThanOrEqualTo(1));

/** Build the single-rule oxlint config object (native categories off, plugin loaded). */
const ruleConfig = (rule: OxlintRule) => ({
  plugins: [],
  categories: {
    correctness: "off",
    suspicious: "off",
    perf: "off",
    style: "off",
    pedantic: "off",
    restriction: "off",
    nursery: "off",
  },
  jsPlugins: [pluginEntry],
  rules: { [`beep/${rule}`]: "warn" },
});

/**
 * Lenient schema over the subset of oxlint's `--format=json` report the harness reads.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { OxlintReport } from "./oxlint-harness.ts"
 * import * as S from "effect/Schema"
 *
 * const report = S.decodeUnknownSync(OxlintReport)({ diagnostics: [] })
 *
 * strictEqual(report.diagnostics?.length, 0)
 * ```
 * @category models
 * @since 0.0.0
 */
export const OxlintReport = S.Struct({
  diagnostics: S.Array(
    S.Struct({
      code: S.String.pipe(S.optionalKey),
      labels: S.Array(
        S.Struct({
          span: S.Struct({ line: ReportLine.pipe(S.optionalKey) }).pipe(S.optionalKey),
        })
      ).pipe(S.optionalKey),
    })
  ).pipe(S.optionalKey),
});

const emptyReport: typeof OxlintReport.Type = {};

/** Decode oxlint's stdout, tolerating non-JSON noise by returning an empty report. */
const parseReport = jsonReportParser(OxlintReport, emptyReport);

class OxlintFixture extends S.Class<OxlintFixture>("OxlintFixture")({
  configPath: S.String,
  sourcePath: S.String,
  tempDir: S.String,
}) {}

const writeSupportingFile = Effect.fnUntraced(function* (
  tempDir: string,
  [supportingPath, supportingSource]: readonly [path: string, source: string]
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absoluteSupportingPath = path.join(tempDir, supportingPath);
  yield* fs.makeDirectory(path.dirname(absoluteSupportingPath), { recursive: true });
  yield* fs.writeFileString(absoluteSupportingPath, `${supportingSource}\n`);
});

const makeOxlintFixture = Effect.fn("oxlintHarness.makeOxlintFixture")(function* (
  tempDir: string,
  rule: OxlintRule,
  source: string,
  filename: string,
  supportingFiles: ReadonlyArray<readonly [path: string, source: string]>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configPath = path.join(tempDir, "oxlintrc.json");
  const sourcePath = path.join(tempDir, filename);

  yield* fs.makeDirectory(path.dirname(sourcePath), { recursive: true });
  yield* fs.writeFileString(configPath, `${encodeConfig(ruleConfig(rule))}\n`);
  yield* fs.writeFileString(sourcePath, `${source}\n`);
  yield* Effect.forEach(supportingFiles, (supportingFile) => writeSupportingFile(tempDir, supportingFile), {
    discard: true,
  });

  return OxlintFixture.make({ configPath, sourcePath, tempDir });
});

const withOxlintFixture = Effect.fn("oxlintHarness.withOxlintFixture")(function* <Success, Error, Requirements>(
  prefix: string,
  rule: OxlintRule,
  source: string,
  filename: string,
  supportingFiles: ReadonlyArray<readonly [path: string, source: string]>,
  use: (fixture: OxlintFixture) => Effect.Effect<Success, Error, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(
    fs.makeTempDirectory({ prefix }),
    (tempDir) => makeOxlintFixture(tempDir, rule, source, filename, supportingFiles).pipe(Effect.flatMap(use)),
    (tempDir) => fs.remove(tempDir, { recursive: true, force: true }).pipe(Effect.ignore)
  );
});

/** Strip the `beep(<slug>)` wrapper oxlint puts around the rule id in `code`. */
const ruleIdOf = (code: string | undefined): O.Option<string> =>
  O.map(O.fromUndefinedOr(code), (raw) => raw.replace(/^beep\(/u, "").replace(/\)$/u, ""));

/**
 * Lint `source` (written to a temp file named `filename`) with only `rule` enabled, and
 * return its normalized findings. `filename` controls the on-disk name so `*.test.ts`-gated
 * and path-exempt rules can be exercised; pass a nested relative path (e.g.
 * `"packages/.../SupportsColor.ts"`) to land the fixture at a path a rule treats specially.
 *
 * @param rule - The oxlint rule slug to enable.
 * @param source - The fixture source written to the temp file.
 * @param filename - The temp file's relative name/path (default `"fixture.ts"`).
 * @param supportingFiles - Additional relative files used to exercise path-aware rules.
 * @returns The rule's findings as `{ ruleId, line }` pairs.
 * @category utilities
 * @since 0.1.0
 */
export const runOxlintRule = Effect.fn("oxlintHarness.runOxlintRule")(function* (
  rule: OxlintRule,
  source: string,
  filename = "fixture.ts",
  supportingFiles: ReadonlyArray<readonly [path: string, source: string]> = []
) {
  return yield* withOxlintFixture(
    "beep-oxlint-rule-",
    rule,
    source,
    filename,
    supportingFiles,
    ({ configPath, sourcePath }) =>
      Effect.gen(function* () {
        const stdout = yield* Effect.sync(() => {
          // Run from the package root so `bunx oxlint` and the plugin's `@oxlint/plugins` /
          // `effect` imports resolve against the repo's node_modules; the config and fixture
          // are passed by absolute path, so the working directory does not affect what is read.
          const result = Bun.spawnSync(["bunx", "oxlint", "--format=json", `--config=${configPath}`, sourcePath], {
            cwd: packageRoot,
            stdout: "pipe",
            stderr: "pipe",
          });
          return result.stdout.toString();
        });

        const report = yield* parseReport(stdout);
        return A.getSomes(
          A.map(
            report.diagnostics ?? [],
            (diagnostic): O.Option<Finding> =>
              O.map(ruleIdOf(diagnostic.code), (ruleId) => ({
                ruleId,
                line: diagnostic.labels?.[0]?.span?.line ?? -1,
              }))
          )
        );
      })
  );
});

/**
 * Apply one oxlint rule's normal fixes to a fixture and return the resulting source.
 *
 * @param rule - The oxlint rule slug to enable.
 * @param source - The fixture source written to the temporary file.
 * @param filename - The temporary file's relative name/path.
 * @param supportingFiles - Additional relative files used to exercise path-aware fixes.
 * @returns The fixed source, including the harness-added trailing newline.
 * @category utilities
 * @since 0.1.0
 */
export const runOxlintRuleFix = Effect.fn("oxlintHarness.runOxlintRuleFix")(function* (
  rule: OxlintRule,
  source: string,
  filename = "fixture.ts",
  supportingFiles: ReadonlyArray<readonly [path: string, source: string]> = []
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* withOxlintFixture(
    "beep-oxlint-fix-",
    rule,
    source,
    filename,
    supportingFiles,
    ({ configPath, sourcePath }) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          Bun.spawnSync(["bunx", "oxlint", "--fix", `--config=${configPath}`, sourcePath], {
            cwd: packageRoot,
            stdout: "ignore",
            stderr: "pipe",
          });
        });

        return yield* fs.readFileString(sourcePath);
      })
  );
});
