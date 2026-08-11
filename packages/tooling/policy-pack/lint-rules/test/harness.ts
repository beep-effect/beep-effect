/**
 * Vitest-spawns-Biome rule harness.
 *
 * Each invocation writes a throwaway Biome config that loads exactly ONE rule's
 * `.grit` plugin, runs `biome lint --reporter=json` over a fixture, and returns the
 * parsed plugin diagnostics. Because only the rule under test is registered, any
 * `category: "plugin"` diagnostic in the output unambiguously belongs to that rule —
 * so assertions work regardless of whether the rule is advisory (`warn`, Biome exits
 * 0) or mandatory (`error`, Biome exits 1).
 *
 * This is a local test helper (not package `src`); it models all side effects as
 * Effects (FileSystem temp dirs, Path joins, `Bun.spawnSync` subprocess), decodes the
 * subprocess JSON through `effect/Schema`, and imports the package's public rule
 * registry through the `@beep/lint-rules` alias.
 */
import { rulePath } from "@beep/lint-rules";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { encodeConfig, jsonReportParser } from "./codec.ts";
import type { RuleName } from "@beep/lint-rules";

/** Absolute path to the package root (`.../lint-rules`). */
const packageRoot = decodeURIComponent(new URL("../", import.meta.url).pathname);

/**
 * Provide a layer to an effect inside a scoped lifetime. Builds the layer to a
 * `Context` and provides that (not the `Layer` itself), which is the test-friendly
 * shape the effect language-service accepts outside application entry points.
 */
export const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

/** One parsed Biome plugin diagnostic. */
type PluginDiagnostic = {
  readonly message: string;
  readonly severity: string;
  readonly line: number;
  readonly column: number;
};

const ReportLine = S.Int.check(S.isGreaterThanOrEqualTo(1));
const ReportColumn = S.Int.check(S.isGreaterThanOrEqualTo(0));

/**
 * Lenient schema over the subset of Biome's JSON report the harness reads.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { BiomeReport } from "./harness.ts"
 * import * as S from "effect/Schema"
 *
 * const report = S.decodeUnknownSync(BiomeReport)({ diagnostics: [] })
 *
 * strictEqual(report.diagnostics?.length, 0)
 * ```
 * @category models
 * @since 0.0.0
 */
export const BiomeReport = S.Struct({
  diagnostics: S.Array(
    S.Struct({
      category: S.String.pipe(S.optional),
      message: S.String.pipe(S.optional),
      severity: S.String.pipe(S.optional),
      location: S.Struct({
        start: S.Struct({
          line: ReportLine.pipe(S.optional),
          column: ReportColumn.pipe(S.optional),
        }).pipe(S.optional),
      }).pipe(S.optional),
    })
  ).pipe(S.optional),
});

const emptyReport: typeof BiomeReport.Type = { diagnostics: undefined };

/** Decode Biome's stdout, tolerating non-JSON noise by returning an empty report. */
const parseReport = jsonReportParser(BiomeReport, emptyReport);

/**
 * Lint the given `source` with only `ruleName`'s `.grit` plugin loaded and return the
 * rule's plugin diagnostics plus Biome's raw exit status. The source is written to a
 * temp directory so the intentional violations never touch the repo tree.
 */
export const runRule = Effect.fn("harness.runRule")(function* (ruleName: RuleName, source: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = { linter: { enabled: true }, plugins: [rulePath(ruleName)] };

  return yield* Effect.acquireUseRelease(
    fs.makeTempDirectory({ prefix: "beep-lint-rule-" }),
    (tempDir) =>
      Effect.gen(function* () {
        const configPath = path.join(tempDir, "biome.json");
        const sourcePath = path.join(tempDir, "fixture.ts");
        yield* fs.writeFileString(configPath, `${encodeConfig(config)}\n`);
        yield* fs.writeFileString(sourcePath, `${source}\n`);

        const { exitCode, stdout } = yield* Effect.sync(() => {
          const result = Bun.spawnSync(
            [
              "bunx",
              "biome",
              "lint",
              "--reporter=json",
              "--max-diagnostics=none",
              `--config-path=${configPath}`,
              sourcePath,
            ],
            { cwd: packageRoot, stdout: "pipe", stderr: "pipe" }
          );
          return { exitCode: result.exitCode, stdout: result.stdout.toString() } as const;
        });

        const report = yield* parseReport(stdout);
        const diagnostics: ReadonlyArray<PluginDiagnostic> = (report.diagnostics ?? [])
          .filter((d) => d.category === "plugin")
          .map((d) => ({
            message: d.message ?? "",
            severity: d.severity ?? "",
            line: d.location?.start?.line ?? -1,
            column: d.location?.start?.column ?? -1,
          }));

        return { status: exitCode, diagnostics } as const;
      }),
    (tempDir) => fs.remove(tempDir, { recursive: true, force: true }).pipe(Effect.ignore)
  );
});
