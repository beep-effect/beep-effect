/**
 * `@beep/lockfiles` adoption parity (3-A1).
 *
 * repo-cli read the root `bun.lock` twice by hand: `Quality/CatalogUsage.ts`
 * (`readLockfilePackages`, the set of every name something is installed as)
 * and `VersionSync/internal/resolvers/RootCatalog.ts`
 * (`readLockfileResolvedVersion`, the version the root resolves a tool to).
 * 3-A1 moves both onto `Lockfile.parse`. This script keeps a frozen copy of
 * each legacy reader and compares it with the adopted expression over the live
 * root `bun.lock`:
 *
 * - names: legacy key/specifier splitting against
 *   `packages.flatMap((pkg) => [pkg.installName, pkg.name])`;
 * - versions: for every name either side knows plus every `packages` key,
 *   legacy `packages[name][0]` prefix-stripping against
 *   `rootPackage(name)` filtered to a non-workspace package of that real name.
 *
 * Every difference is listed and classified; the run fails on any
 * unclassified one.
 *
 * Usage (from the repo root, after `bun install`):
 *
 *   bun goals/effected-promotion/ops/lockfiles-adoption-parity.ts [--out <report.json>]
 */

import * as NodeURL from "node:url";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// --- report schema ------------------------------------------------------------

const Sample = S.Array(S.String);

const ParityReport = S.Struct({
  schemaVersion: S.tag(1),
  commit: S.optionalKey(S.NonEmptyString),
  tool: S.NonEmptyString,
  generatedAt: S.NonEmptyString,
  lockfile: S.NonEmptyString,
  packagesKeys: S.Int,
  names: S.Struct({
    legacy: S.Int,
    kit: S.Int,
    agree: S.Int,
    onlyLegacy: Sample,
    onlyKit: Sample,
  }),
  versions: S.Struct({
    probed: S.Int,
    legacySome: S.Int,
    kitSome: S.Int,
    agree: S.Int,
    workspaceProtocolOnlyLegacy: Sample,
    unclassified: Sample,
  }),
  // Per-read cost (median of TIMING_RUNS) of each reader over the same
  // content: the legacy shallow decode against the full kit parse.
  timing: S.Struct({
    runs: S.Int,
    legacyMedianMs: S.Finite,
    kitMedianMs: S.Finite,
  }),
  ok: S.Boolean,
});
type ParityReport = typeof ParityReport.Type;

const encodeReport = S.encodeEffect(S.fromJsonString(ParityReport, { space: 2 }));

class LockfilesAdoptionParityFailed extends Data.TaggedError("LockfilesAdoptionParityFailed")<{
  readonly reason: string;
}> {}

const TOOL = "goals/effected-promotion/ops/lockfiles-adoption-parity.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));

// --- frozen legacy readers (repo-cli before 3-A1) -------------------------------

const LegacyLockfile = S.Struct({
  packages: S.Record(S.String, S.Array(S.Unknown)).pipe(S.withDecodingDefaultKey(Effect.succeed({}))),
});
const decodeLegacyLockfile = Jsonc.bind(LegacyLockfile).decode;

// CatalogUsage `packageNameFromSpecifier`: split at the last `@` past index 0.
const packageNameFromSpecifier = (specifier: string): string =>
  pipe(
    Str.lastIndexOf("@")(specifier),
    O.filter((index) => index > 0),
    O.match({ onNone: () => specifier, onSome: (index) => Str.slice(0, index)(specifier) })
  );

// CatalogUsage `installedNameFromLockKey`.
const installedNameFromLockKey = (key: string): string => {
  const segments = Str.split("/")(key);
  const last = A.lastNonEmpty(segments);
  return pipe(
    A.get(segments, segments.length - 2),
    O.filter(Str.startsWith("@")),
    O.match({ onNone: () => last, onSome: (scope) => `${scope}/${last}` })
  );
};

const legacyNames = (packages: R.ReadonlyRecord<string, ReadonlyArray<unknown>>): ReadonlyArray<string> =>
  pipe(
    R.toEntries(packages),
    A.flatMap(([key, entry]) => [
      installedNameFromLockKey(key),
      ...A.fromOption(O.map(O.filter(A.head(entry), P.isString), packageNameFromSpecifier)),
    ]),
    A.dedupe
  );

// RootCatalog `readLockfileResolvedVersion`.
const legacyVersion = (packages: R.ReadonlyRecord<string, ReadonlyArray<unknown>>, name: string): O.Option<string> =>
  O.flatMap(O.flatMap(R.get(packages, name), A.head), (specifier) =>
    P.isString(specifier) && Str.startsWith(`${name}@`)(specifier)
      ? O.some(Str.slice(name.length + 1)(specifier))
      : O.none()
  );

// --- adopted expressions (repo-cli after 3-A1) ----------------------------------

const kitNames = (lockfile: Lockfile): ReadonlyArray<string> =>
  A.dedupe(A.flatMap(lockfile.packages, (pkg) => [pkg.installName, pkg.name]));

const kitVersion = (lockfile: Lockfile, name: string): O.Option<string> =>
  lockfile.rootPackage(name).pipe(
    O.filter((pkg) => !pkg.isWorkspace && pkg.name === name),
    O.map((pkg) => pkg.version)
  );

// --- main ---------------------------------------------------------------------

const TIMING_RUNS = 15;

const medianMs = Effect.fnUntraced(function* <A, E>(read: Effect.Effect<A, E>) {
  const samples = yield* Effect.forEach(A.range(1, TIMING_RUNS), () =>
    Effect.map(Effect.timed(read), ([duration]) => Duration.toMillis(duration))
  );
  const ordered = A.sort(samples, Order.Number);
  return Num.round(
    O.getOrElse(A.get(ordered, TIMING_RUNS >> 1), () => 0),
    1
  );
});

const versionEquivalence = O.makeEquivalence(Str.Equivalence);

const sorted = (values: Iterable<string>): ReadonlyArray<string> => A.sort(A.fromIterable(values), Order.String);

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

const gitHead = (): O.Option<string> => {
  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repoRoot });
  return pipe(
    O.some(result.stdout.toString().trim()),
    O.filter((text) => result.exitCode === 0 && /^[0-9a-f]{40}$/.test(text))
  );
};

const program = Effect.fn("LockfilesAdoptionParity.main")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const content = yield* fileSystem.readFileString(`${repoRoot}bun.lock`);
  const legacy = yield* decodeLegacyLockfile(content);
  const lockfile = yield* Lockfile.parse(content, { format: "bun" });

  const before = HashSet.fromIterable(legacyNames(legacy.packages));
  const after = HashSet.fromIterable(kitNames(lockfile));
  const onlyLegacy = sorted(HashSet.difference(before, after));
  const onlyKit = sorted(HashSet.difference(after, before));

  const probes = sorted(HashSet.union(HashSet.union(before, after), HashSet.fromIterable(R.keys(legacy.packages))));
  const rows = A.map(probes, (name) => ({
    name,
    legacy: legacyVersion(legacy.packages, name),
    kit: kitVersion(lockfile, name),
  }));
  const agrees = (row: (typeof rows)[number]) => versionEquivalence(row.legacy, row.kit);
  const disagreeing = A.filter(rows, (row) => !agrees(row));
  // The plan's RootCatalog rule (W3-g): a workspace package is no installed
  // tool, so a legacy `workspace:<path>` "version" becomes None.
  const isWorkspaceProtocolRow = (row: (typeof rows)[number]) =>
    O.isNone(row.kit) &&
    O.exists(row.legacy, Str.startsWith("workspace:")) &&
    O.exists(lockfile.rootPackage(row.name), (pkg) => pkg.isWorkspace);
  const workspaceProtocol = A.filter(disagreeing, isWorkspaceProtocolRow);
  const unclassified = A.filter(disagreeing, (row) => !isWorkspaceProtocolRow(row));

  const legacyMedianMs = yield* medianMs(decodeLegacyLockfile(content));
  const kitMedianMs = yield* medianMs(Lockfile.parse(content, { format: "bun" }));

  const ok =
    A.isReadonlyArrayEmpty(onlyLegacy) && A.isReadonlyArrayEmpty(onlyKit) && A.isReadonlyArrayEmpty(unclassified);
  const report: ParityReport = {
    schemaVersion: 1,
    ...O.match(gitHead(), { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    tool: TOOL,
    generatedAt: DateTime.formatIso(yield* DateTime.now),
    lockfile: "bun.lock",
    packagesKeys: R.size(legacy.packages),
    names: {
      legacy: HashSet.size(before),
      kit: HashSet.size(after),
      agree: HashSet.size(HashSet.intersection(before, after)),
      onlyLegacy,
      onlyKit,
    },
    versions: {
      probed: rows.length,
      legacySome: A.filter(rows, (row) => O.isSome(row.legacy)).length,
      kitSome: A.filter(rows, (row) => O.isSome(row.kit)).length,
      agree: rows.length - disagreeing.length,
      workspaceProtocolOnlyLegacy: A.map(workspaceProtocol, (row) => row.name),
      unclassified: A.map(
        unclassified,
        (row) =>
          `${row.name}: legacy=${O.getOrElse(row.legacy, () => "None")} kit=${O.getOrElse(row.kit, () => "None")}`
      ),
    },
    timing: { runs: TIMING_RUNS, legacyMedianMs, kitMedianMs },
    ok,
  };
  const encoded = yield* encodeReport(report);
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(encoded),
    onSome: (out) => fileSystem.writeFileString(out, `${encoded}\n`),
  });
  yield* Console.log(
    `names: ${report.names.agree} agree (legacy ${report.names.legacy}, kit ${report.names.kit}); versions: ${report.versions.agree}/${report.versions.probed} agree (legacy Some ${report.versions.legacySome}, kit Some ${report.versions.kitSome}, ${workspaceProtocol.length} workspace-protocol rows now None, ${unclassified.length} unclassified); per-read median ${legacyMedianMs} ms legacy, ${kitMedianMs} ms kit`
  );
  if (!ok) {
    return yield* new LockfilesAdoptionParityFailed({ reason: "the adopted readers disagree with the legacy readers" });
  }
});

program().pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
