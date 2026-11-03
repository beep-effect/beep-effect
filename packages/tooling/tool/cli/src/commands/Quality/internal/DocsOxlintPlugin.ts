/**
 * Per-run prebuilt bundle of the documentation oxlint plugin.
 *
 * `.oxlintrc.docs.json` loads the plugin from its TypeScript source, so every
 * oxlint process strips and links the plugin's module graph (`@beep/schema`,
 * `@beep/identity` and the Effect modules it imports) before linting. Bundling
 * that graph into one JavaScript file first cuts the per-process plugin load
 * from about 0.43 s to 0.14 s and a whole-repository documentation lint from
 * about 5.8 s to 4.8 s on the 2026-11-02 workstation (perf audit M16), and the
 * bundle builds in about 0.03 s.
 *
 * The bundle is rebuilt from the current sources on every run, never reused,
 * so it cannot go stale: its inputs are the plugin sources the policy
 * fingerprint already seals, and this module sits in the sealed closure of the
 * commands that call it. The source config stays authoritative for every other
 * consumer (lefthook, editors, direct oxlint runs); a failed build falls back
 * to it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Jsonc } from "@beep/jsonc/Jsonc";
import { A, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { qualityStepOutputBound, runCaptured } from "../../../internal/process/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { QualityTaskConfigurationError } from "../Quality.errors.ts";

/**
 * The documentation oxlint config, which loads the plugin from its TypeScript source.
 *
 * @category configuration
 * @since 0.0.0
 */
export const DOCS_OXLINT_CONFIG = ".oxlintrc.docs.json";

/**
 * The derived, gitignored config that loads the prebuilt plugin bundle; it sits beside the source
 * config because oxlint resolves `ignorePatterns` and override globs against the config's directory.
 *
 * @category configuration
 * @since 0.0.0
 */
export const PREBUILT_DOCS_OXLINT_CONFIG = ".oxlintrc.docs.prebuilt.json";

const DOCS_PLUGIN_SOURCE = "./packages/tooling/policy-pack/lint-rules/src/rules/docs.index.ts";
// The bundle sits at the same depth as `src/rules/`: `tsdoc-syntax` resolves the repository
// `tsdoc.json` relative to its own module URL, which is the bundle's URL once bundled.
const DOCS_PLUGIN_BUNDLE_DIR = "packages/tooling/policy-pack/lint-rules/.prebuilt/rules";
const DOCS_PLUGIN_BUNDLE = `${DOCS_PLUGIN_BUNDLE_DIR}/docs.index.js`;
// Left as installed packages: `@microsoft/tsdoc-config` reads its schema JSON next to its own
// module, and the other two are plain CommonJS the bundle gains nothing from inlining.
const DOCS_PLUGIN_EXTERNALS = ["@microsoft/*", "comment-parser", "are-docs-informative"];

const DocsOxlintConfigDocument = S.Record(S.String, S.Unknown);
const decodeDocsOxlintConfig = Jsonc.bind(DocsOxlintConfigDocument).decode;
const encodeDocsOxlintConfig = JsonStringCodec(DocsOxlintConfigDocument).encode;
const isSourcePluginList = S.is(S.Tuple([S.Literal(DOCS_PLUGIN_SOURCE)]));

/**
 * The `bun build` argv that bundles the documentation plugin into `outfile`.
 *
 * **Example** (Inspect the bundle command)
 *
 * ```ts
 * import { docsPluginBundleArgs } from "@beep/repo-cli/test/Quality"
 *
 * console.log(docsPluginBundleArgs("/tmp/docs.index.js")[0]) // "build"
 * ```
 *
 * @param outfile - Absolute path the bundle is written to.
 * @returns The `bun` arguments.
 * @category utilities
 * @since 0.0.0
 */
export const docsPluginBundleArgs = (outfile: string): ReadonlyArray<string> => [
  "build",
  DOCS_PLUGIN_SOURCE,
  "--target=node",
  "--format=esm",
  `--outfile=${outfile}`,
  ...A.flatMap(DOCS_PLUGIN_EXTERNALS, (external) => ["--external", external]),
];

const buildPrebuiltDocsOxlintConfig = Effect.fn("DocsOxlintPlugin.build")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* fs
    .readFileString(path.join(repoRoot, DOCS_OXLINT_CONFIG))
    .pipe(
      Effect.flatMap(decodeDocsOxlintConfig),
      QualityTaskConfigurationError.mapError(`Cannot read ${DOCS_OXLINT_CONFIG}.`)
    );
  if (!isSourcePluginList(config.jsPlugins)) {
    return yield* QualityTaskConfigurationError.new(
      `${DOCS_OXLINT_CONFIG} does not load the documentation plugin from ${DOCS_PLUGIN_SOURCE}.`
    );
  }
  const bundleDir = path.join(repoRoot, DOCS_PLUGIN_BUNDLE_DIR);
  yield* fs
    .makeDirectory(bundleDir, { recursive: true })
    .pipe(QualityTaskConfigurationError.mapError(`Cannot create ${DOCS_PLUGIN_BUNDLE_DIR}.`));
  // Concurrent runs each stage into their own directory and rename into place; identical sources
  // build identical bundles, and a rename never exposes a half-written file to a reader.
  const staging = yield* fs
    .makeTempDirectoryScoped({ directory: bundleDir, prefix: ".build-" })
    .pipe(QualityTaskConfigurationError.mapError("Cannot stage the documentation plugin bundle."));
  const stagedBundle = path.join(staging, "docs.index.js");
  const build = yield* runCaptured({
    command: "bun",
    args: docsPluginBundleArgs(stagedBundle),
    cwd: repoRoot,
    source: "all",
    bound: qualityStepOutputBound,
    trim: true,
  }).pipe(QualityTaskConfigurationError.mapError("Failed to spawn bun build for the documentation plugin."));
  if (build.exitCode !== 0) {
    return yield* QualityTaskConfigurationError.new(
      `bun build exited with code ${build.exitCode}: ${Str.slice(0, 400)(build.output)}`
    );
  }
  const stagedConfig = path.join(staging, PREBUILT_DOCS_OXLINT_CONFIG);
  const derived = yield* encodeDocsOxlintConfig({ ...config, jsPlugins: [`./${DOCS_PLUGIN_BUNDLE}`] }).pipe(
    QualityTaskConfigurationError.mapError("Cannot encode the prebuilt documentation config.")
  );
  yield* fs
    .writeFileString(stagedConfig, derived)
    .pipe(QualityTaskConfigurationError.mapError("Cannot stage the prebuilt documentation config."));
  yield* fs
    .rename(stagedBundle, path.join(repoRoot, DOCS_PLUGIN_BUNDLE))
    .pipe(QualityTaskConfigurationError.mapError("Cannot install the documentation plugin bundle."));
  yield* fs
    .rename(stagedConfig, path.join(repoRoot, PREBUILT_DOCS_OXLINT_CONFIG))
    .pipe(QualityTaskConfigurationError.mapError("Cannot install the prebuilt documentation config."));
  return PREBUILT_DOCS_OXLINT_CONFIG;
}, Effect.scoped);

/**
 * Build the documentation plugin bundle and its derived config; fall back to the source config.
 *
 * **Example** (Prepare the documentation config)
 *
 * ```ts
 * import { prepareDocsOxlintConfig } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(prepareDocsOxlintConfig("/repo")))
 * ```
 *
 * @param repoRoot - Repository root holding the documentation config.
 * @returns The repo-relative config path to pass to oxlint `--config`.
 * @category utilities
 * @since 0.0.0
 */
export const prepareDocsOxlintConfig = Effect.fn("DocsOxlintPlugin.prepare")(function* (repoRoot: string) {
  return yield* buildPrebuiltDocsOxlintConfig(repoRoot).pipe(
    Effect.catch((error) =>
      Console.log(
        `[beep-cli] lint:jsdoc: plugin prebuild unavailable (${error.message}); linting with ${DOCS_OXLINT_CONFIG}.`
      ).pipe(Effect.as(DOCS_OXLINT_CONFIG))
    )
  );
});
