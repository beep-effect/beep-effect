/**
 * The nightly's second property step: property test files in packages with no
 * `test:property` script, run through Turbo's `test` task under the sweep's
 * floor and seed, and checked against the files that were expected to run.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";

const $I = $RepoCliId.create("commands/Ci/CiPropertySweep");

/**
 * Matches the source of a test file that draws from an arbitrary.
 *
 * **Details**
 *
 * The same expression as `propertyTestMarker` in `@beep/fc-runs`, which the
 * shared Vitest configuration selects the sweep's files with; a test holds the
 * two equal.
 *
 * **Example** (Recognise a property file)
 *
 * ```ts
 * import { PROPERTY_TEST_MARKER } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(PROPERTY_TEST_MARKER.test('it.effect.prop("law", [arb], f)')) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROPERTY_TEST_MARKER: RegExp =
  /\bFastCheck\b|\bfast-check\b|\bit\.prop\b|\bit\.effect\.prop\b|\bassertSchemaArbitraryDecodesToSelf\b|\bArbitrary\.(?:checkEffect|sampleEffect|schema)\b|\bunstable\/arbitrary\/Arbitrary\b|\bfc\.(?:property|asyncProperty|assert|sample|check)\b/;

const TEST_FILE = /\.test\.tsx?$/;
const SKIPPED_DIRECTORIES = ["node_modules", ".context", "fixtures"];
const INTEGRATION_DIRECTORY = "test/integration/";
const INTEGRATION_EXCLUDE = "--exclude=test/integration/**";

/**
 * Where a package's sweep writes its receipts, relative to the package.
 *
 * **Example** (Read the directory)
 *
 * ```ts
 * import { PROPERTY_SWEEP_RECEIPTS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(PROPERTY_SWEEP_RECEIPTS) // .beep/property-sweep
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROPERTY_SWEEP_RECEIPTS = ".beep/property-sweep";

/**
 * The property files of one package the second step must run, and the ones it
 * does not run because the package's unit script leaves them to the
 * integration lane.
 *
 * **Example** (A package with one property file)
 *
 * ```ts
 * import { PropertySweepPackage } from "@beep/repo-cli/commands/Ci"
 *
 * const entry = PropertySweepPackage.make({ name: "@beep/csv", dir: "packages/foundation/modeling/csv", files: ["test/Csv.property.test.ts"], integration: [] })
 * console.log(entry.files.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PropertySweepPackage extends S.Opaque<PropertySweepPackage, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    dir: S.NonEmptyString,
    files: S.Array(S.NonEmptyString),
    integration: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("PropertySweepPackage", {
      description: "A package the nightly's second property step sweeps, its expected files and its integration files.",
    })
  )
) {}

/**
 * What one Vitest run of the sweep executed, as vitest.property-reporter.ts
 * writes it.
 *
 * **Example** (A receipt)
 *
 * ```ts
 * import { PropertySweepReceipt } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(PropertySweepReceipt.make({ files: [{ file: "test/a.test.ts", executed: 2 }] }).files.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PropertySweepReceipt extends S.Opaque<PropertySweepReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("property-sweep/v1"),
    files: S.Struct({ file: S.NonEmptyString, executed: S.Int }).pipe(S.Array),
  }).pipe(
    $I.annoteSchema("PropertySweepReceipt", {
      description: "The test files one property sweep run executed and how many tests of each ran.",
    })
  )
) {}

const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(PropertySweepReceipt));

const testFilesUnder = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(directory, { recursive: true }).pipe(
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeed(A.empty<string>())
    )
  );
  return pipe(
    entries,
    A.map(Str.replaceAll(path.sep, "/")),
    A.filter(
      (entry) =>
        TEST_FILE.test(entry) && !A.some(SKIPPED_DIRECTORIES, (skipped) => A.contains(Str.split(entry, "/"), skipped))
    ),
    A.map((entry) => `test/${entry}`),
    A.sort(Order.String)
  );
});

const propertyFilesOf = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* testFilesUnder(path.join(directory, "test"));
  return yield* Effect.filter(
    files,
    Effect.fnUntraced(function* (file) {
      // A screenshot directory carries its test file's name.
      const info = yield* fs.stat(path.join(directory, file));
      if (info.type !== "File") return false;
      const source = yield* fs.readFileString(path.join(directory, file));
      return PROPERTY_TEST_MARKER.test(source);
    }),
    { concurrency: 16 }
  );
});

const isLeftToIntegration = (file: string, unitScript: O.Option<string>): boolean =>
  Str.startsWith(INTEGRATION_DIRECTORY)(file) && O.exists(unitScript, Str.includes(INTEGRATION_EXCLUDE));

/**
 * The packages with property test files and no `test:property` script, read
 * from the tree.
 *
 * **Example** (Read the census)
 *
 * ```ts
 * import { propertySweepPackages } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(propertySweepPackages("/repo"))) // true
 * ```
 *
 * @param repoRoot - the repository root
 * @returns the packages the second step sweeps, by name
 * @category use-cases
 * @since 0.0.0
 */
export const propertySweepPackages = Effect.fn("CiPropertySweep.packages")(
  function* (repoRoot: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    // Workspace directories are resolved through links, so the root they are relative to is too.
    const root = yield* fs.realPath(repoRoot);
    const workspaces = yield* workspaceManifests(root);
    const candidates = pipe(
      workspaces,
      HashMap.entries,
      A.fromIterable,
      A.filter(
        ([, workspace]) =>
          HashMap.has(workspace.manifest.scripts, "test") && !HashMap.has(workspace.manifest.scripts, "test:property")
      )
    );
    const found = yield* Effect.forEach(
      candidates,
      Effect.fnUntraced(function* ([name, workspace]) {
        const all = yield* propertyFilesOf(workspace.dir);
        const unitScript = HashMap.get(workspace.manifest.scripts, "beep:test");
        const integration = A.filter(all, (file) => isLeftToIntegration(file, unitScript));
        const files = A.filter(all, (file) => !isLeftToIntegration(file, unitScript));
        const dir = Str.replaceAll(path.sep, "/")(path.relative(root, workspace.dir));
        return PropertySweepPackage.make({ name, dir, files, integration });
      }),
      { concurrency: 8 }
    );
    return pipe(
      found,
      A.filter((entry) => A.isReadonlyArrayNonEmpty(entry.files) || A.isReadonlyArrayNonEmpty(entry.integration)),
      A.sortWith((entry) => entry.name, Order.String)
    );
  },
  Effect.mapError(CiCommandError.new("Failed to read the property sweep's packages."))
);

const receiptsOf = Effect.fnUntraced(function* (repoRoot: string, entry: PropertySweepPackage) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(repoRoot, entry.dir, PROPERTY_SWEEP_RECEIPTS);
  const names = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
  return yield* Effect.forEach(
    names,
    (name) => Effect.flatMap(fs.readFileString(path.join(directory, name)), decodeReceipt),
    { concurrency: 1 }
  );
});

/**
 * Remove the packages' receipts, so only this run's are read.
 *
 * **Example** (Clear before a run)
 *
 * ```ts
 * import { clearPropertySweepReceipts } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(clearPropertySweepReceipts("/repo", []))) // true
 * ```
 *
 * @param repoRoot - the repository root
 * @param packages - the packages about to be swept
 * @category use-cases
 * @since 0.0.0
 */
export const clearPropertySweepReceipts = Effect.fn("CiPropertySweep.clear")(
  function* (repoRoot: string, packages: ReadonlyArray<PropertySweepPackage>) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* Effect.forEach(
      packages,
      (entry) => fs.remove(path.join(repoRoot, entry.dir, PROPERTY_SWEEP_RECEIPTS), { recursive: true, force: true }),
      { concurrency: 8, discard: true }
    );
  },
  Effect.mapError(CiCommandError.new("Failed to clear the property sweep's receipts."))
);

/**
 * How one package's sweep compares with the files it was expected to run.
 *
 * **Example** (A file that did not run)
 *
 * ```ts
 * import { PropertySweepPackage, PropertySweepVerdict } from "@beep/repo-cli/commands/Ci"
 *
 * const entry = PropertySweepPackage.make({ name: "@beep/csv", dir: "packages/csv", files: ["test/a.test.ts"], integration: [] })
 * console.log(PropertySweepVerdict.make({ package: entry, executed: 0, missing: ["test/a.test.ts"] }).missing.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PropertySweepVerdict extends S.Opaque<PropertySweepVerdict, { readonly brand: unique symbol }>()(
  S.Struct({
    package: PropertySweepPackage,
    executed: S.Int,
    missing: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("PropertySweepVerdict", {
      description:
        "A swept package, how many files it executed, and its expected property files that executed no test.",
    })
  )
) {}

/**
 * Compare the receipts of this run with the expected files: a file with no
 * executed test is missing.
 *
 * **Example** (Judge a run)
 *
 * ```ts
 * import { judgePropertySweep } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(judgePropertySweep("/repo", []))) // true
 * ```
 *
 * @param repoRoot - the repository root
 * @param packages - the packages that were swept
 * @returns a verdict per package
 * @category use-cases
 * @since 0.0.0
 */
export const judgePropertySweep = Effect.fn("CiPropertySweep.judge")(
  function* (repoRoot: string, packages: ReadonlyArray<PropertySweepPackage>) {
    return yield* Effect.forEach(
      packages,
      Effect.fnUntraced(function* (entry) {
        const receipts = yield* receiptsOf(repoRoot, entry);
        const executed = pipe(
          receipts,
          A.flatMap((receipt) => receipt.files),
          A.filter((file) => file.executed > 0),
          A.map((file) => file.file),
          A.dedupe
        );
        return PropertySweepVerdict.make({
          package: entry,
          executed: A.length(executed),
          missing: A.filter(entry.files, (file) => !A.contains(executed, file)),
        });
      }),
      { concurrency: 8 }
    );
  },
  Effect.mapError(CiCommandError.new("Failed to read the property sweep's receipts."))
);

type SweepReplay = { readonly seed: string; readonly runs: string };

const countOf = (
  verdicts: ReadonlyArray<PropertySweepVerdict>,
  files: (entry: PropertySweepVerdict) => ReadonlyArray<string>
) => A.reduce(verdicts, 0, (total, verdict) => total + A.length(files(verdict)));

/**
 * The lines of a sweep's verdict: the totals, each package's expected and
 * executed file counts (a package may execute more than its property files),
 * each integration file left out,
 * and each expected file that did not run with the command that replays its
 * package.
 *
 * **Example** (Nothing to sweep)
 *
 * ```ts
 * import { propertySweepLines } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(propertySweepLines([], { seed: "1", runs: "400" })[0]) // [property-sweep] 0 package(s): 0 of 0 expected file(s) executed, 0 left to the integration lane
 * ```
 *
 * @param verdicts - a verdict per swept package
 * @param replay - the seed and run floor of this run
 * @returns the lines to print
 * @category projections
 * @since 0.0.0
 */
export const propertySweepLines: {
  (verdicts: ReadonlyArray<PropertySweepVerdict>, replay: SweepReplay): ReadonlyArray<string>;
  (replay: SweepReplay): (verdicts: ReadonlyArray<PropertySweepVerdict>) => ReadonlyArray<string>;
} = dual(2, (verdicts: ReadonlyArray<PropertySweepVerdict>, replay: SweepReplay): ReadonlyArray<string> => {
  const expected = countOf(verdicts, (verdict) => verdict.package.files);
  const missing = countOf(verdicts, (verdict) => verdict.missing);
  const integration = countOf(verdicts, (verdict) => verdict.package.integration);
  return [
    `[property-sweep] ${A.length(verdicts)} package(s): ${expected - missing} of ${expected} expected file(s) executed, ${integration} left to the integration lane`,
    ...A.map(
      verdicts,
      (verdict) =>
        `[property-sweep] ${verdict.package.name}: ${A.length(verdict.package.files)} expected, ${verdict.executed} executed`
    ),
    ...A.flatMap(verdicts, (verdict) =>
      A.map(
        verdict.package.integration,
        (file) => `[property-sweep] left to the integration lane: ${verdict.package.dir}/${file}`
      )
    ),
    ...A.flatMap(verdicts, (verdict) =>
      A.map(verdict.missing, (file) => `[property-sweep] expected and not executed: ${verdict.package.dir}/${file}`)
    ),
    ...A.map(
      A.filter(verdicts, (verdict) => A.isReadonlyArrayNonEmpty(verdict.missing)),
      (verdict) => `[property-sweep] replay: ${propertySweepReplay(verdict.package.name, replay)}`
    ),
  ];
});

/**
 * The command that replays one package of a sweep.
 *
 * **Example** (Replay a package)
 *
 * ```ts
 * import { propertySweepReplay } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(propertySweepReplay("@beep/csv", { seed: "7", runs: "1000" }))
 * // BEEP_FC_SEED=7 BEEP_FC_NUM_RUNS=1000 bunx turbo run test --filter=@beep/csv --cache=local:,remote:
 * ```
 *
 * @param name - the package to replay
 * @param replay - the seed and run floor of the sweep
 * @returns a shell command
 * @category projections
 * @since 0.0.0
 */
export const propertySweepReplay: {
  (name: string, replay: SweepReplay): string;
  (replay: SweepReplay): (name: string) => string;
} = dual(
  2,
  (name: string, replay: SweepReplay): string =>
    `BEEP_FC_SEED=${replay.seed} BEEP_FC_NUM_RUNS=${replay.runs} bunx turbo run test --filter=${name} ${PROPERTY_SWEEP_NO_CACHE}`
);

/**
 * The Turbo flag that neither reads nor writes any cache.
 *
 * **Example** (Read the flag)
 *
 * ```ts
 * import { PROPERTY_SWEEP_NO_CACHE } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(PROPERTY_SWEEP_NO_CACHE) // --cache=local:,remote:
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROPERTY_SWEEP_NO_CACHE = "--cache=local:,remote:";

/**
 * Whether a failed sweep is red: some expected file executed no test, or a
 * package was selected with none.
 *
 * **Example** (An empty sweep passes)
 *
 * ```ts
 * import { propertySweepIsComplete } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(propertySweepIsComplete([])) // true
 * ```
 *
 * @param verdicts - a verdict per swept package
 * @returns whether every expected file executed
 * @category predicates
 * @since 0.0.0
 */
export const propertySweepIsComplete = (verdicts: ReadonlyArray<PropertySweepVerdict>): boolean =>
  A.every(verdicts, (verdict) => A.isReadonlyArrayEmpty(verdict.missing));
