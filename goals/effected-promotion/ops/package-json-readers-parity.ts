/**
 * Old-versus-new parity for the repo-cli and docgen package.json readers (3-A4).
 *
 * 3-A4 retires the per-command package.json projections in repo-cli and docgen
 * and reads through `@beep/package-json` instead: repo-cli's projection readers
 * through `LenientManifest` (via the shared `manifestParser`), docgen's two
 * readers through `PackageJsonFile.readManifest`, and the VersionSync updaters
 * through `PackageJsonFormat.modifyToString`. This script keeps each retired
 * reader as an oracle, copied from its last body on main, and runs it next to
 * the adopted site's own exported reader (the function the site itself calls,
 * imported from the package) over every git-tracked `package.json` (test
 * fixtures excluded). File-based readers (docgen, the updaters) run over a
 * temporary copy of each manifest. It compares what each site reads: its
 * verdict (read or rejected) and the values it projects. The two updaters are
 * compared byte for byte on a value-changing edit of every manifest.
 *
 * A difference fails the run unless it is listed in `INTENDED` with its reason;
 * the intended differences are the behaviour changes the PR pins with tests
 * (strict JSON instead of JSONC, an object-form `workspaces` without
 * `packages`, a non-semver docgen `version`), and only the one listed occurs on
 * a tracked manifest. Nothing here runs in CI; the output rides in the PR body
 * and in `research/package-json-readers-parity-3a4.json`.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/package-json-readers-parity.ts [--out <report.json>]
 */
import * as NodeURL from "node:url";
import { LenientManifest } from "@beep/package-json/LenientManifest";
import {
  EffectSchemaInventoryPin,
  parseEffectSchemaInventoryPin,
  readTestTypecheckManifest,
} from "@beep/repo-cli/commands/Lint";
import {
  CatalogUsageRootManifest,
  readCatalogUsageManifest,
  readChangesetGraphWorkspaceManifest,
  readChangesetStatusWorkspacePackage,
  readPackageVerifyWorkspace,
  readQualityTaskManifest,
  readRootCatalogs,
  readWorkspacePackageText,
} from "@beep/repo-cli/test/Quality";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli/test/SharedInternals";
import {
  readPackageManagerField,
  readRootPackageJsonText,
  updateCatalogEntry,
  updatePackageManagerField,
} from "@beep/repo-cli/test/VersionSync";
import { readPackageJson as readDocgenPackageJson } from "@beep/repo-docgen/Configuration";
import { readManifestVersion as readDocgenManifestVersion } from "@beep/repo-docgen/Version";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// --- report schema ------------------------------------------------------------

const TOOL = "goals/effected-promotion/ops/package-json-readers-parity.ts";
const SCOPE = "git ls-files '*package.json' excluding **/test/fixtures/**";

const Divergence = S.Struct({ path: S.String, oracle: S.String, adopted: S.String });

const SiteRow = S.Struct({
  site: S.String,
  manifests: S.Finite,
  agree: S.Finite,
  rejectedByBoth: S.Finite,
  divergences: S.Array(Divergence),
});

const ParityReport = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  scope: S.String,
  commit: S.optionalKey(S.String),
  manifests: S.Finite,
  sites: S.Array(SiteRow),
  unclassifiedDivergences: S.Finite,
});

const encodeReport = S.encodeEffect(S.fromJsonString(ParityReport, { space: 2 }));
const encodeValue = S.encodeEffect(S.fromJsonString(S.Unknown));

class ParityFailure extends Data.TaggedError("ParityFailure")<{ readonly message: string }> {}

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

// --- verdicts -----------------------------------------------------------------

// A reader's verdict on one manifest: what it projected, or that it rejected
// the document. Rendered as text so two verdicts compare by value.
const REJECTED = "rejected";
const NOT_APPLICABLE = "not applicable";
const hasCatalog = (text: string): Effect.Effect<boolean> =>
  LenientManifest.parse(text).pipe(
    Effect.map((manifest) => manifest.catalog !== undefined),
    Effect.orElseSucceed(() => false)
  );
const verdictOf = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  project: (value: A) => unknown
): Effect.Effect<string, never, R> =>
  effect.pipe(
    Effect.flatMap((value) => encodeValue(project(value))),
    Effect.map((text) => `read ${text}`),
    Effect.orElseSucceed(() => REJECTED)
  );

const StringRecord = S.Record(S.String, S.String);
const DependencyBuckets = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
type DependencyDocument = Partial<Record<(typeof DependencyBuckets)[number], Readonly<Record<string, string>>>>;
const dependencies = (document: DependencyDocument) =>
  R.fromEntries(A.map(DependencyBuckets, (bucket) => [bucket, document[bucket] ?? {}] as const));

// --- the retired readers (oracles, copied from main) ---------------------------

// ChangesetGraph `ChangesetGraphPackageJson` (one shape for the root and members).
const ChangesetGraphOracle = S.Struct({
  name: S.optionalKey(S.String),
  private: S.optionalKey(S.Boolean),
  workspaces: S.optionalKey(
    S.Union([S.Array(S.String), S.Struct({ packages: S.Array(S.String).pipe(S.optionalKey) })])
  ),
});
const decodeChangesetGraphOracle = S.decodeUnknownEffect(S.fromJsonString(ChangesetGraphOracle));

// ChangesetStatus `ChangesetStatusPackageJson`, then the site's name check.
const decodeChangesetStatusOracle = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({ name: S.optionalKey(S.String), version: S.optionalKey(S.String), private: S.optionalKey(S.Boolean) })
  )
);
const requireOracleName = <A extends { readonly name?: string | undefined }>(document: A) =>
  P.isUndefined(document.name) ? Effect.fail("unnamed" as const) : Effect.succeed(document);

// PackageVerify `PackageVerifyPackageJson` (name required by the schema).
const decodePackageVerifyOracle = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ name: S.String, scripts: S.OptionFromOptionalKey(StringRecord) }))
);

// QualityArtifactSupport `PackageJson` over its JSONC record read.
const decodeQualityArtifactOracle = decodeJsoncTextAs(
  S.Struct({
    name: S.String,
    scripts: S.optionalKey(StringRecord),
    workspaces: S.optionalKey(S.Unknown),
    exports: S.optionalKey(S.Unknown),
    dependencies: S.optionalKey(StringRecord),
    devDependencies: S.optionalKey(StringRecord),
    peerDependencies: S.optionalKey(StringRecord),
    optionalDependencies: S.optionalKey(StringRecord),
  })
);

// Quality.schemas `PackageJsonDocument` (Tasks).
const decodeTasksOracle = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      name: S.optionalKey(S.String),
      scripts: S.optionalKey(StringRecord),
      workspaces: S.optionalKey(S.Union([S.Array(S.String), S.Struct({ packages: S.Array(S.String) })])),
    })
  )
);

// CatalogUsage.schemas `CatalogUsageManifestDependencies` (JSONC, defaulted).
const decodeCatalogUsageOracle = decodeJsoncTextAs(
  S.Struct(R.fromEntries(A.map(DependencyBuckets, (bucket) => [bucket, S.optionalKey(StringRecord)] as const)))
);

// CatalogUsage root: the unchanged `CatalogUsageRootManifest` over the old JSONC read.
const decodeCatalogUsageRootOracle = decodeJsoncTextAs(CatalogUsageRootManifest);
const catalogUsageRootProjection = (root: CatalogUsageRootManifest) => [root.catalog, root.catalogs, root.overrides];

// BunResolver `BunPackageJsonDocument` (JSONC, `packageManager` defaults to "").
const decodeBunResolverOracle = decodeJsoncTextAs(S.Struct({ packageManager: S.optionalKey(S.String) }));

// RootCatalog `RootPackageJsonDocument` (JSONC, both records default to {}).
const decodeRootCatalogOracle = decodeJsoncTextAs(
  S.Struct({ catalog: S.optionalKey(StringRecord), devDependencies: S.optionalKey(StringRecord) })
);

// PackageTestTypecheck `PackageManifestDocument` (JSONC; an unreadable manifest is no package).
const decodePackageTestTypecheckOracle = decodeJsoncTextAs(
  S.Struct({ name: S.String, scripts: S.optionalKey(StringRecord) })
);
const testTypecheckProjection = (name: O.Option<string>, scripts: Readonly<Record<string, string>> | undefined) =>
  O.match(O.filter(name, Str.isNonEmpty), { onNone: () => NOT_APPLICABLE, onSome: (value) => [value, scripts ?? {}] });

// EffectSchemaInventoryModules `RootManifest`, `catalogEffectSpecifier` and the
// pin derivation of `parseEffectSchemaInventoryPin`, verbatim from main.
const EffectCatalog = S.Struct({ effect: S.optionalKey(S.String) });
const WorkspacesWithCatalog = S.Struct({ catalog: S.optionalKey(EffectCatalog) });
const isWorkspacesWithCatalog = S.is(WorkspacesWithCatalog);
const InventoryRootManifest = S.Struct({
  catalog: S.optionalKey(EffectCatalog),
  workspaces: S.optionalKey(S.Union([S.Array(S.String), WorkspacesWithCatalog])),
  config: S.OptionFromOptionalKey(
    S.Struct({
      effectSource: S.OptionFromOptionalKey(
        S.Struct({
          version: S.String.check(S.isPattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u)),
          commit: EffectSchemaInventoryPin,
        })
      ),
    })
  ),
});
const decodeInventoryRootManifest = S.decodeUnknownEffect(S.fromJsonString(InventoryRootManifest));
const SNAPSHOT_PIN = /effect@([0-9a-f]{40})$/u;
const catalogEffectSpecifier = (manifest: typeof InventoryRootManifest.Type): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(manifest.catalog?.effect),
    O.orElse(() =>
      pipe(
        O.fromUndefinedOr(manifest.workspaces),
        O.filter(isWorkspacesWithCatalog),
        O.flatMap((workspaces) => O.fromUndefinedOr(workspaces.catalog?.effect))
      )
    )
  );
const inventoryPinOracle = (text: string) =>
  Effect.flatMap(decodeInventoryRootManifest(text), (manifest) => {
    const specifier = catalogEffectSpecifier(manifest);
    return Effect.fromOption(
      pipe(
        specifier,
        O.flatMap(Str.match(SNAPSHOT_PIN)),
        O.flatMap((match) => O.fromUndefinedOr(match[1])),
        O.orElse(() =>
          pipe(
            manifest.config,
            O.flatMap((config) => config.effectSource),
            O.filter((source) => O.contains(source.version)(specifier)),
            O.map((source) => source.commit)
          )
        )
      )
    );
  });

// docgen `Configuration.ts` `PackageJsonSchema` (JSONC through config-file).
const decodeDocgenConfigurationOracle = decodeJsoncTextAs(S.Struct({ homepage: S.String, name: S.String }));

// docgen `Version.ts` `PackageManifestVersion`.
const decodeDocgenVersionOracle = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ version: S.String })));

// --- sites ----------------------------------------------------------------------

type SiteEnvironment = FileSystem.FileSystem | Path.Path;

interface ManifestInput {
  // A temporary copy of the manifest text, for the file-based readers.
  readonly file: string;
  readonly path: string;
  readonly text: string;
}

interface Site {
  readonly adopted: (input: ManifestInput) => Effect.Effect<string, never, SiteEnvironment>;
  readonly oracle: (input: ManifestInput) => Effect.Effect<string, never, SiteEnvironment>;
  readonly site: string;
}

const writeManifest = Effect.fn("PackageJsonReadersParity.writeManifest")(function* (file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, text);
});

// Run a file-based updater over the temporary copy and return the bytes it left.
const updatedBytes = <E>(
  file: string,
  text: string,
  update: (file: string) => Effect.Effect<boolean, E, FileSystem.FileSystem>
): Effect.Effect<string, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* writeManifest(file, text);
    yield* update(file);
    return yield* fs.readFileString(file);
  }).pipe(Effect.orElseSucceed(() => REJECTED));

const SITES: ReadonlyArray<Site> = [
  // The ChangesetGraph root (workspace patterns) site recorded in the 3-A4 run
  // left this script in 4-A2: the reader moved onto `@beep/repo-workspaces`
  // `WorkspacePatterns` (ops/workspace-patterns-adoption-parity.ts).
  {
    site: "repo-cli Quality/ChangesetGraph.ts member (name, private)",
    oracle: ({ text }) => verdictOf(decodeChangesetGraphOracle(text), (d) => [d.name ?? null, d.private === true]),
    adopted: ({ text, path }) =>
      verdictOf(readChangesetGraphWorkspaceManifest(text, path), (m) => [m.name ?? null, m.private === true]),
  },
  {
    site: "repo-cli Quality/ChangesetStatus.ts (name, version, private)",
    oracle: ({ text }) =>
      verdictOf(Effect.flatMap(decodeChangesetStatusOracle(text), requireOracleName), (d) => [
        d.name,
        d.version ?? null,
        d.private !== true,
      ]),
    adopted: ({ text }) =>
      verdictOf(readChangesetStatusWorkspacePackage(text, "dir"), (w) => [
        w.name,
        O.getOrNull(w.version),
        w.publishEnabled,
      ]),
  },
  {
    site: "repo-cli Quality/internal/PackageVerify.ts (scripts of a named manifest)",
    oracle: ({ text }) => verdictOf(decodePackageVerifyOracle(text), (d) => O.getOrElse(d.scripts, () => ({}))),
    adopted: ({ text, path }) => verdictOf(readPackageVerifyWorkspace(text, path, "name", "dir"), (w) => w.scripts),
  },
  {
    // The pattern quarter of this site left with QAS `workspacePatternsFrom`
    // in 4-A1 (#2380: members come from `@beep/repo-workspaces`
    // `WorkspaceDiscovery`); the 3-A4 run recorded all four.
    site: "repo-cli Quality/internal/QualityArtifactSupport.ts (name, scripts, dependencies)",
    oracle: ({ text }) =>
      verdictOf(decodeQualityArtifactOracle(text), (d) => [d.name, d.scripts ?? null, dependencies(d)]),
    adopted: ({ text, path }) =>
      verdictOf(readWorkspacePackageText(text, path, "/dir", "dir"), (info) => [
        info.name,
        info.packageJson.scripts ?? null,
        dependencies(info.packageJson),
      ]),
  },
  {
    // The workspace-pattern third of this site left in 4-A2 (the root patterns
    // come from `@beep/repo-workspaces` `WorkspacePatterns` now); the 3-A4
    // run recorded all three.
    site: "repo-cli Quality/Tasks.ts (name, scripts)",
    oracle: ({ text }) => verdictOf(decodeTasksOracle(text), (d) => [d.name ?? null, d.scripts ?? {}]),
    adopted: ({ text, path }) =>
      verdictOf(readQualityTaskManifest(text, path), (m) => [m.name ?? null, m.scripts ?? {}]),
  },
  {
    site: "repo-cli Quality/CatalogUsage.ts root (catalog, catalogs, overrides)",
    oracle: ({ text }) => verdictOf(decodeCatalogUsageRootOracle(text), catalogUsageRootProjection),
    adopted: ({ text }) => verdictOf(readRootCatalogs(text), catalogUsageRootProjection),
  },
  {
    site: "repo-cli Quality/CatalogUsage.ts (four dependency buckets)",
    oracle: ({ text }) => verdictOf(decodeCatalogUsageOracle(text), dependencies),
    adopted: ({ text, path }) => verdictOf(readCatalogUsageManifest(text, path), dependencies),
  },
  {
    site: "repo-cli VersionSync BunResolver.ts (packageManager)",
    oracle: ({ text }) => verdictOf(decodeBunResolverOracle(text), (d) => d.packageManager ?? ""),
    adopted: ({ text }) => verdictOf(readPackageManagerField(text), (field) => field),
  },
  {
    site: "repo-cli VersionSync RootCatalog.ts (catalog, devDependencies)",
    oracle: ({ text }) => verdictOf(decodeRootCatalogOracle(text), (d) => [d.catalog ?? {}, d.devDependencies ?? {}]),
    adopted: ({ text }) => verdictOf(readRootPackageJsonText(text), (m) => [m.catalog ?? {}, m.devDependencies ?? {}]),
  },
  {
    site: "repo-cli Lint/PackageTestTypecheck.ts (name, scripts of a named manifest)",
    oracle: ({ text }) =>
      verdictOf(decodePackageTestTypecheckOracle(text).pipe(Effect.option), (d) =>
        testTypecheckProjection(
          O.map(d, (document) => document.name),
          O.getOrUndefined(O.flatMapNullishOr(d, (document) => document.scripts))
        )
      ),
    adopted: ({ text }) =>
      verdictOf(readTestTypecheckManifest(text), (m) =>
        testTypecheckProjection(
          O.flatMapNullishOr(m, (document) => document.name),
          O.getOrUndefined(O.flatMapNullishOr(m, (document) => document.scripts))
        )
      ),
  },
  {
    site: "repo-cli Lint/internal/EffectSchemaInventoryModules.ts (inventory pin)",
    oracle: ({ text }) => verdictOf(inventoryPinOracle(text), (pin) => pin),
    adopted: ({ text }) => verdictOf(parseEffectSchemaInventoryPin(text), (pin) => pin),
  },
  {
    site: "docgen Configuration.ts (name, homepage)",
    oracle: ({ text }) => verdictOf(decodeDocgenConfigurationOracle(text), (d) => [d.name, d.homepage]),
    adopted: ({ file, text }) =>
      verdictOf(Effect.andThen(writeManifest(file, text), readDocgenPackageJson(file)), (identity) => [
        identity.name,
        identity.homepage,
      ]),
  },
  {
    site: "docgen Version.ts (version)",
    oracle: ({ text }) => verdictOf(decodeDocgenVersionOracle(text), (d) => d.version),
    adopted: ({ file, text }) =>
      verdictOf(Effect.andThen(writeManifest(file, text), readDocgenManifestVersion(file)), (version) => version),
  },
  {
    site: "repo-cli VersionSync PackageJsonUpdater.ts (packageManager edit bytes)",
    oracle: ({ text }) =>
      Effect.succeed(
        applyJsoncModification(JsoncModification.make({ content: text, path: ["packageManager"], value: "bun@9.9.9" }))
      ),
    adopted: ({ file, text }) => updatedBytes(file, text, updatePackageManagerField("9.9.9")),
  },
  {
    // The updater only rewrites an entry of an existing root `catalog` (the
    // drift items come from that catalog), so manifests without one are out
    // of its domain.
    site: "repo-cli VersionSync PackageJsonUpdater.ts (catalog entry edit bytes, manifests with a catalog)",
    oracle: ({ text }) =>
      Effect.map(hasCatalog(text), (applies) =>
        applies
          ? applyJsoncModification(
              JsoncModification.make({ content: text, path: ["catalog", "effect"], value: "9.9.9" })
            )
          : NOT_APPLICABLE
      ),
    adopted: ({ file, text }) =>
      Effect.flatMap(hasCatalog(text), (applies) =>
        applies
          ? updatedBytes(file, text, updateCatalogEntry("effect", { versionSpecifier: "9.9.9" }))
          : Effect.succeed(NOT_APPLICABLE)
      ),
  },
];

// Differences the PR intends, by site and path; each is pinned by a test. The
// other intended changes (JSONC text, a mixed-type `workspaces` array, an
// object-form `workspaces` without `packages`) occur on no tracked manifest.
const INTENDED: ReadonlyArray<{ readonly site: string; readonly path: string; readonly reason: string }> = [
  {
    site: "repo-cli VersionSync PackageJsonUpdater.ts (packageManager edit bytes)",
    path: "scratchpad/effected/sbom/package.json",
    reason:
      "The kit edit keeps the file's own indentation (tabs here); the retired jsonc edit always inserted 2-space lines into a tab-indented file.",
  },
];

// --- program ------------------------------------------------------------------

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const listing = yield* spawner.string(
    ChildProcess.make("git", ["ls-files", "-z", "--", "*package.json", ":(exclude)**/test/fixtures/**"], {
      cwd: repoRoot,
    })
  );
  const paths = A.sort(
    A.filter(Str.split(listing, "\u0000"), (path) => path === "package.json" || Str.endsWith("/package.json")(path)),
    Order.String
  );
  const pathService = yield* Path.Path;
  const file = pathService.join(yield* fileSystem.makeTempDirectoryScoped(), "package.json");
  const inputs = yield* Effect.forEach(paths, (path) =>
    Effect.map(fileSystem.readFileString(`${repoRoot}${path}`), (text): ManifestInput => ({ file, path, text }))
  );
  const sites = yield* Effect.forEach(SITES, (site) =>
    Effect.gen(function* () {
      const verdicts = yield* Effect.forEach(inputs, (input) =>
        Effect.map(Effect.all([site.oracle(input), site.adopted(input)]), ([oracle, adopted]) => ({
          path: input.path,
          oracle,
          adopted,
        }))
      );
      const divergences = A.filter(verdicts, (row) => row.oracle !== row.adopted);
      return {
        site: site.site,
        manifests: A.length(verdicts),
        agree: A.length(verdicts) - A.length(divergences),
        rejectedByBoth: A.length(A.filter(verdicts, (row) => row.oracle === REJECTED && row.adopted === REJECTED)),
        divergences,
      };
    })
  );
  const unclassified = A.flatMap(sites, (row) =>
    A.filter(
      row.divergences,
      (divergence) => !A.some(INTENDED, (entry) => entry.site === row.site && entry.path === divergence.path)
    )
  );
  const commit = yield* spawner.string(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).pipe(
    Effect.map(Str.trim),
    Effect.map(O.liftPredicate(Str.isNonEmpty)),
    Effect.orElseSucceed(() => O.none<string>())
  );
  const json = yield* encodeReport({
    schemaVersion: 1,
    tool: TOOL,
    scope: SCOPE,
    ...O.match(commit, { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    manifests: A.length(paths),
    sites,
    unclassifiedDivergences: A.length(unclassified),
  });
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(json),
    onSome: (path) => fileSystem.writeFileString(path, `${json}\n`),
  });
  for (const row of sites) {
    yield* Console.log(`${row.agree}/${row.manifests} agree  ${row.site}`);
  }
  if (A.isReadonlyArrayNonEmpty(unclassified)) {
    return yield* new ParityFailure({
      message: `${A.length(unclassified)} unclassified reader divergence(s); see the report.`,
    });
  }
});

// The entry point builds the platform services once and runs the program in their context.
NodeRuntime.runMain(
  Layer.build(NodeServices.layer).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
