/**
 * Read-only fleet-mirror derivation service.
 *
 * Derives a {@link FleetSnapshot} over every checkout sharing this
 * repository's origin: per-checkout git facts, three-state liveness,
 * `merge-tree` conflict prediction against a materialized epoch target, and
 * movement of the measured policy surface. Every derived field is either
 * measured or `unknown` — nothing is inferred from a proxy, and nothing
 * defaults to the safe-sounding value.
 *
 * The scan writes nothing into any checkout. Its only write surface is the
 * scanner object database — a dedicated bare repository under the user cache
 * directory — which exists because `git merge-tree` needs the target *object*,
 * not its SHA, and sibling clones do not share object databases.
 *
 * Module graph: this service depends only on the schema leaf
 * (`Worktree.schemas.ts`) and the error leaf, so `Worktree.command.ts` can
 * register the fleet subcommand without an import cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, Str } from "@beep/utils";
import {
  Clock,
  Context,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Match,
  MutableHashMap,
  MutableHashSet,
  Order,
  Path,
  Result,
} from "effect";
import { configStringOptionSync } from "../../internal/cli/EnvConfig.ts";
import { repoRunOutputBound, runCapturedStreams } from "../../internal/process/StepExec.ts";
import { WorktreeCommandError } from "./Worktree.errors.ts";
import {
  FLEET_LIVENESS_WINDOW_SECONDS,
  FLEET_POLICY_SURFACE,
  FleetCheckout,
  FleetContestedPath,
  FleetEpochTarget,
  FleetLivenessReadings,
  FleetLivenessVerdict,
  FleetScanCoverage,
  FleetScanOptions,
  FleetSnapshot,
  parseWorktreePorcelain,
} from "./Worktree.schemas.ts";
import type * as PlatformError from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { FleetLiveness, FleetLivenessProbe, FleetProbeReading, WorktreeListEntry } from "./Worktree.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/Fleet.service");

/**
 * Path prefixes excluded from change surfaces before the contested-path index
 * is built.
 *
 * **Details**
 *
 * Vendored reference pins and dependency trees dominate cross-checkout
 * overlap noise without representing two agents editing the same file; the
 * exploration measured seven checkouts "colliding" on one vendored `.repos`
 * file from a reference pin moving.
 *
 * **Example** (Read the excluded prefixes)
 *
 * ```ts
 * import { FLEET_SURFACE_EXCLUDE_PREFIXES } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FLEET_SURFACE_EXCLUDE_PREFIXES.includes(".repos/")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FLEET_SURFACE_EXCLUDE_PREFIXES = [".repos/", "node_modules/", ".git/"] as const;

/**
 * Classify a checkout's liveness from its probe readings.
 *
 * **Details**
 *
 * `live` requires positive evidence from any probe. `dormant` requires every
 * probe to have measured a negative — a complete process scan with no match,
 * a transcript that is absent or older than the window, and a worktree mtime
 * older than the window. Anything else is `unknown`: an incomplete process
 * scan or a failed probe leaves open the possibility of a live agent, and a
 * falsely-`dormant` verdict is a silent miss.
 *
 * **Example** (An unreadable process entry yields unknown, never dormant)
 *
 * ```ts
 * import { classifyFleetLiveness, FleetLivenessReadings } from "@beep/repo-cli/commands/Worktree"
 *
 * const verdict = classifyFleetLiveness(
 *   FleetLivenessReadings.make({
 *     processMatches: 0,
 *     processScanComplete: false,
 *     transcript: { _tag: "absent" },
 *     worktreeMtime: { _tag: "measured", ageSeconds: 86_400 },
 *   })
 * )
 * console.log(verdict.status) // "unknown"
 * ```
 *
 * @param readings - Probe readings measured for one checkout.
 * @param windowSeconds - Seconds within which measured activity counts as live.
 * @returns The classified status and the probes that evidenced it.
 * @category utilities
 * @since 0.0.0
 */
export const classifyFleetLiveness = (
  readings: FleetLivenessReadings,
  windowSeconds: number = FLEET_LIVENESS_WINDOW_SECONDS
): FleetLivenessVerdict => {
  const evidence: Array<FleetLivenessProbe> = [];
  if (readings.processMatches > 0) {
    evidence.push("process-cwd");
  }
  if (readings.transcript._tag === "measured" && readings.transcript.ageSeconds < windowSeconds) {
    evidence.push("transcript-mtime");
  }
  if (readings.worktreeMtime._tag === "measured" && readings.worktreeMtime.ageSeconds < windowSeconds) {
    evidence.push("worktree-mtime");
  }
  if (evidence.length > 0) {
    return FleetLivenessVerdict.make({ status: "live", evidence });
  }
  const transcriptNegative = readings.transcript._tag !== "failed";
  const worktreeNegative = readings.worktreeMtime._tag === "measured";
  if (readings.processScanComplete && transcriptNegative && worktreeNegative) {
    return FleetLivenessVerdict.make({ status: "dormant", evidence: [] });
  }
  return FleetLivenessVerdict.make({ status: "unknown", evidence: [] });
};

const RENAME_OR_COPY_STATUS = /[RC]/;

/** One decoded `-z` status record: the paths it claims, whether it counts as an entry, and how many NUL fields it consumed. */
type StatusRecord = {
  readonly paths: ReadonlyArray<string>;
  readonly counted: boolean;
  readonly stride: number;
};

const SKIPPED_STATUS_RECORD: StatusRecord = { paths: A.empty(), counted: false, stride: 1 };

const statusRecordAt = (records: ReadonlyArray<string>, index: number): StatusRecord => {
  const record = records[index];
  if (record === undefined || Str.isEmpty(record)) {
    return SKIPPED_STATUS_RECORD;
  }
  const target = record.slice(3);
  if (!RENAME_OR_COPY_STATUS.test(record.slice(0, 2))) {
    return { paths: [target], counted: true, stride: 1 };
  }
  const origin = O.filter(O.fromUndefinedOr(records[index + 1]), Str.isNonEmpty);
  return {
    paths: O.match(origin, { onNone: () => [target], onSome: (value) => [target, value] }),
    counted: true,
    stride: 2,
  };
};

/**
 * Parse `git status --porcelain=v1 -z -uall` output into entry count and the
 * full set of involved paths.
 *
 * **Details**
 *
 * `-z` records are NUL-delimited and unquoted, so C-quoted paths never appear.
 * Rename and copy records carry the origin path as the following NUL field;
 * both sides enter the path set, because both sides are contested by the
 * change.
 *
 * **Example** (Parse a rename record)
 *
 * ```ts
 * import { parseStatusPorcelainZ } from "@beep/repo-cli/commands/Worktree"
 *
 * const parsed = parseStatusPorcelainZ("R  new.ts\0old.ts\0?? fresh.ts\0")
 * console.log(parsed.entryCount) // 2
 * console.log(parsed.paths) // ["new.ts", "old.ts", "fresh.ts"]
 * ```
 *
 * @param output - Raw stdout from `git status --porcelain=v1 -z -uall`.
 * @returns The entry count and every path the records claim, rename origins included.
 * @category parsing
 * @since 0.0.0
 */
export const parseStatusPorcelainZ = (
  output: string
): { readonly entryCount: number; readonly paths: ReadonlyArray<string> } => {
  const records = Str.split(output, "\0");
  const paths: Array<string> = [];
  let entryCount = 0;
  let index = 0;
  while (index < records.length) {
    const parsed = statusRecordAt(records, index);
    paths.push(...parsed.paths);
    entryCount = parsed.counted ? entryCount + 1 : entryCount;
    index = index + parsed.stride;
  }
  return { entryCount, paths };
};

/**
 * Parse conflicted file names from `git merge-tree --write-tree --name-only`
 * output after a conflicting merge (exit code 1).
 *
 * **Details**
 *
 * The first line is the written tree OID; conflicted file names follow, and an
 * empty line separates them from any informational messages, which are not
 * file names and must not be reported as conflicts.
 *
 * **Example** (Parse a conflicted merge)
 *
 * ```ts
 * import { parseMergeTreeConflictNames } from "@beep/repo-cli/commands/Worktree"
 *
 * const names = parseMergeTreeConflictNames("abc123\nturbo.json\n\nAuto-merging turbo.json\n")
 * console.log(names) // ["turbo.json"]
 * ```
 *
 * @param output - Raw stdout from a conflicting `git merge-tree --write-tree --name-only`.
 * @returns The conflicted file names in output order, deduped.
 * @category parsing
 * @since 0.0.0
 */
export const parseMergeTreeConflictNames = (output: string): ReadonlyArray<string> => {
  const lines = Str.split(output, "\n");
  const names = MutableHashSet.empty<string>();
  const ordered: Array<string> = [];
  for (const line of A.drop(lines, 1)) {
    if (Str.isEmpty(Str.trim(line))) {
      break;
    }
    const name = Str.trim(line);
    if (!MutableHashSet.has(names, name)) {
      MutableHashSet.add(names, name);
      ordered.push(name);
    }
  }
  return ordered;
};

/**
 * Derive the Claude Code transcript directory name for an absolute checkout
 * path.
 *
 * **Gotchas**
 *
 * The mangle replaces `/`, `_`, and `.` with `-`, so it is not injective:
 * `/a/b_c` and `/a/b-c` collide. A transcript hit is activity evidence, not
 * proof of path identity.
 *
 * **Example** (Mangle a checkout path)
 *
 * ```ts
 * import { transcriptProjectDirName } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(transcriptProjectDirName("/home/user/projects/beep_effect"))
 * // "-home-user-projects-beep-effect"
 * ```
 *
 * @param absolutePath - Absolute checkout path to mangle.
 * @returns The Claude Code transcript directory name for that checkout.
 * @category utilities
 * @since 0.0.0
 */
export const transcriptProjectDirName = (absolutePath: string): string => Str.replace(/[/_.]/g, "-")(absolutePath);

type SurfaceIndex = MutableHashMap.MutableHashMap<string, MutableHashSet.MutableHashSet<string>>;

const isSurfacePath = (surfacePath: string): boolean =>
  !A.some(FLEET_SURFACE_EXCLUDE_PREFIXES, (prefix) => Str.startsWith(prefix)(surfacePath));

const claimSurfacePath = (index: SurfaceIndex, surfacePath: string, checkout: string): void => {
  const bucket = MutableHashMap.get(index, surfacePath);
  if (O.isSome(bucket)) {
    MutableHashSet.add(bucket.value, checkout);
    return;
  }
  MutableHashMap.set(index, surfacePath, MutableHashSet.make(checkout));
};

const contestedEntries = (index: SurfaceIndex): ReadonlyArray<FleetContestedPath> => {
  const contested: Array<FleetContestedPath> = [];
  for (const [surfacePath, bucket] of index) {
    if (MutableHashSet.size(bucket) > 1) {
      contested.push(
        FleetContestedPath.make({
          path: surfacePath,
          checkouts: A.sort(A.fromIterable(bucket), Order.String),
        })
      );
    }
  }
  return contested;
};

/**
 * Build the contested-path index from per-checkout change surfaces.
 *
 * **Details**
 *
 * One pass over all surface entries into a path → checkouts index; only paths
 * claimed by two or more checkouts survive. Paths under
 * {@link FLEET_SURFACE_EXCLUDE_PREFIXES} are dropped first. Output is sorted
 * by path for deterministic snapshots.
 *
 * **Example** (Two checkouts contesting one path)
 *
 * ```ts
 * import { buildContestedIndex } from "@beep/repo-cli/commands/Worktree"
 *
 * const surfaces: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
 *   ["/fleet/a", ["goals/INDEX.md", "a-only.ts"]],
 *   ["/fleet/b", ["goals/INDEX.md"]],
 * ]
 * console.log(buildContestedIndex(surfaces).map((entry) => entry.path)) // ["goals/INDEX.md"]
 * ```
 *
 * @param surfaces - One `[checkoutPath, changedPaths]` pair per checkout.
 * @returns Paths claimed by two or more checkouts, sorted by path with sorted checkout lists.
 * @category utilities
 * @since 0.0.0
 */
export const buildContestedIndex = (
  surfaces: ReadonlyArray<readonly [string, ReadonlyArray<string>]>
): ReadonlyArray<FleetContestedPath> => {
  const index = MutableHashMap.empty<string, MutableHashSet.MutableHashSet<string>>();
  for (const [checkout, paths] of surfaces) {
    for (const surfacePath of A.filter(paths, isSurfacePath)) {
      claimSurfacePath(index, surfacePath, checkout);
    }
  }
  return A.sortWith(contestedEntries(index), (entry) => entry.path, Order.String);
};

/**
 * Contract for the fleet-mirror derivation service.
 *
 * @category services
 * @since 0.0.0
 */
export interface FleetMirrorServiceShape {
  /**
   * Derive one read-only fleet snapshot: enumerate checkouts sharing the
   * origin, classify liveness, materialize the epoch target into the scanner
   * object database, predict conflicts for live checkouts, and evaluate
   * policy-surface movement.
   *
   * @since 0.0.0
   */
  readonly scan: (options?: FleetScanOptions) => Effect.Effect<FleetSnapshot, WorktreeCommandError>;
}

type FleetMirrorServiceRequirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

/**
 * Service tag for the fleet-mirror derivation scan.
 *
 * **Example** (Access the service)
 *
 * ```ts
 * import { FleetMirrorService } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(FleetMirrorService, (service) => service.scan())
 * console.log(program.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FleetMirrorService extends Context.Service<FleetMirrorService, FleetMirrorServiceShape>()(
  $I`FleetMirrorService`
) {}

type GitProbeResult = {
  readonly exitCode: number;
  readonly stdout: string;
};

type CheckoutStub = {
  readonly path: string;
  readonly kind: "clone" | "linked-worktree";
  readonly entry: WorktreeListEntry | null;
};

type ProcessScan = {
  readonly counts: MutableHashMap.MutableHashMap<string, number>;
  readonly scanned: number;
  readonly unreadable: number;
  readonly complete: boolean;
};

type ScannerContext = {
  readonly scannerDir: string;
  readonly available: boolean;
  readonly env: Record<string, string>;
};

const normalizeOriginUrl = (url: string): string => {
  const trimmed = Str.trim(url);
  const withoutSlash = Str.endsWith("/")(trimmed) ? trimmed.slice(0, -1) : trimmed;
  return Str.endsWith(".git")(withoutSlash) ? withoutSlash.slice(0, -4) : withoutSlash;
};

const platformErrorTag = (error: PlatformError.PlatformError): string => error.reason._tag;

const IGNORED_TREE_ENTRIES = [".git", "node_modules"] as const;

/** Runs git, absorbing spawn failures and truncation into `O.none()` so callers treat them as failed probes. */
const runGitProbe = Effect.fn("Fleet.runGitProbe")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  env?: Record<string, string>
): Effect.fn.Return<O.Option<GitProbeResult>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const captured = yield* runCapturedStreams({
    command: "git",
    args,
    cwd,
    extendEnv: true,
    env,
    stdin: "ignore",
    bound: repoRunOutputBound,
    trim: false,
  }).pipe(Effect.option);
  return O.flatMap(captured, (result) =>
    result.truncated ? O.none() : O.some({ exitCode: result.exitCode, stdout: result.stdout })
  );
});

// A zero-exit stdout, or `O.none()` for any spawn failure, nonzero exit, or truncation.
const gitStdout = (probe: O.Option<GitProbeResult>): O.Option<string> =>
  O.flatMap(probe, (result) => (result.exitCode === 0 ? O.some(result.stdout) : O.none()));

const nulPaths = (stdout: string): ReadonlyArray<string> => A.filter(Str.split(stdout, "\0"), Str.isNonEmpty);

/** A sibling directory counts as a fleet clone only when it holds a `.git` directory whose origin normalizes to ours. */
const cloneMatchesOrigin = Effect.fn("Fleet.cloneMatchesOrigin")(function* (
  candidate: string,
  normalizedOrigin: string
): Effect.fn.Return<boolean, never, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const gitInfo = yield* fs.stat(path.join(candidate, ".git")).pipe(Effect.option);
  if (O.isNone(gitInfo) || gitInfo.value.type !== "Directory") {
    return false;
  }
  const originOutput = gitStdout(yield* runGitProbe(candidate, ["remote", "get-url", "origin"]));
  return O.match(originOutput, {
    onNone: () => false,
    onSome: (output) => normalizeOriginUrl(output) === normalizedOrigin,
  });
});

const discoverClones = Effect.fn("Fleet.discoverClones")(function* (
  fleetRoot: string,
  normalizedOrigin: string
): Effect.fn.Return<ReadonlyArray<string>, WorktreeCommandError, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs
    .readDirectory(fleetRoot)
    .pipe(
      Effect.mapError(WorktreeCommandError.new(`Failed to read the fleet root ${fleetRoot}.`, { path: fleetRoot }))
    );
  const clones: Array<string> = [];
  for (const name of A.sort(names, Order.String)) {
    const candidate = path.join(fleetRoot, name);
    if (yield* cloneMatchesOrigin(candidate, normalizedOrigin)) {
      clones.push(candidate);
    }
  }
  return clones;
});

/** Every checkout one clone reports. A clone whose `worktree list` fails still contributes itself, so it is never dropped. */
const cloneStubs = Effect.fn("Fleet.cloneStubs")(function* (
  clone: string
): Effect.fn.Return<ReadonlyArray<CheckoutStub>, never, FleetMirrorServiceRequirements> {
  const porcelain = gitStdout(yield* runGitProbe(clone, ["worktree", "list", "--porcelain"]));
  if (O.isNone(porcelain)) {
    const unlisted: CheckoutStub = { path: clone, kind: "clone", entry: null };
    return [unlisted];
  }
  return A.map(
    parseWorktreePorcelain(porcelain.value),
    (entry, index): CheckoutStub => ({
      path: entry.path,
      kind: index === 0 ? "clone" : "linked-worktree",
      entry,
    })
  );
});

// Keep the first stub claiming each path, matching the clone-order precedence of the sequential scan it replaces.
const dedupeStubs = (stubs: ReadonlyArray<CheckoutStub>): ReadonlyArray<CheckoutStub> => {
  const seen = MutableHashSet.empty<string>();
  const unique: Array<CheckoutStub> = [];
  for (const stub of stubs) {
    if (MutableHashSet.has(seen, stub.path)) {
      continue;
    }
    MutableHashSet.add(seen, stub.path);
    unique.push(stub);
  }
  return unique;
};

const enumerateFleet = Effect.fn("Fleet.enumerateFleet")(function* (
  fleetRoot: string,
  normalizedOrigin: string
): Effect.fn.Return<
  { readonly clones: ReadonlyArray<string>; readonly stubs: ReadonlyArray<CheckoutStub> },
  WorktreeCommandError,
  FleetMirrorServiceRequirements
> {
  const clones = yield* discoverClones(fleetRoot, normalizedOrigin);
  const stubs = dedupeStubs(A.flatten(yield* Effect.forEach(clones, cloneStubs)));
  return { clones, stubs: A.sortWith(stubs, (stub) => stub.path, Order.String) };
});

const PID_DIRECTORY_NAME = /^[0-9]+$/;

/** One process's working directory. `unreadable` marks an entry the scan could not read; a vanished pid is not unreadable. */
type ProcessCwdReading = {
  readonly cwd: O.Option<string>;
  readonly unreadable: boolean;
};

const processCwdReading = Effect.fn("Fleet.processCwdReading")(function* (
  pid: string
): Effect.fn.Return<ProcessCwdReading, never, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* Effect.result(fs.readLink(`/proc/${pid}/cwd`));
  return Result.match(cwd, {
    onFailure: (error): ProcessCwdReading => ({
      cwd: O.none(),
      unreadable: platformErrorTag(error) !== "NotFound",
    }),
    onSuccess: (value): ProcessCwdReading => ({ cwd: O.some(value), unreadable: false }),
  });
});

// Credit a working directory to the longest checkout path containing it, so a linked worktree outranks its parent clone.
const attributeProcessCwd = (
  counts: MutableHashMap.MutableHashMap<string, number>,
  byLengthDesc: ReadonlyArray<string>,
  cwd: string
): void => {
  const owner = A.findFirst(byLengthDesc, (candidate) => cwd === candidate || Str.startsWith(`${candidate}/`)(cwd));
  if (O.isSome(owner)) {
    const previous = O.getOrElse(MutableHashMap.get(counts, owner.value), () => 0);
    MutableHashMap.set(counts, owner.value, previous + 1);
  }
};

const scanProcesses = Effect.fn("Fleet.scanProcesses")(function* (
  checkoutPaths: ReadonlyArray<string>
): Effect.fn.Return<ProcessScan, never, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const counts = MutableHashMap.empty<string, number>();
  const byLengthDesc = A.sort(
    checkoutPaths,
    Order.mapInput(Order.Number, (candidate: string) => -candidate.length)
  );
  const names = yield* fs.readDirectory("/proc").pipe(Effect.option);
  if (O.isNone(names)) {
    return { counts, scanned: 0, unreadable: 0, complete: false };
  }
  const pids = A.filter(names.value, (name) => PID_DIRECTORY_NAME.test(name));
  const readings = yield* Effect.forEach(pids, processCwdReading);
  for (const cwd of A.getSomes(A.map(readings, (reading) => reading.cwd))) {
    attributeProcessCwd(counts, byLengthDesc, cwd);
  }
  const unreadable = A.length(A.filter(readings, (reading) => reading.unreadable));
  return { counts, scanned: A.length(pids), unreadable, complete: unreadable === 0 };
});

const PROBE_FAILED: FleetProbeReading = { _tag: "failed" };
const PROBE_ABSENT: FleetProbeReading = { _tag: "absent" };

/** One filesystem entry's mtime in epoch millis plus whether it is a directory; an unreadable entry reads as neither. */
type EntryReading = {
  readonly millis: O.Option<number>;
  readonly directory: boolean;
};

const UNREADABLE_ENTRY: EntryReading = { millis: O.none(), directory: false };

const entryReading = Effect.fn("Fleet.entryReading")(function* (
  entryPath: string
): Effect.fn.Return<EntryReading, never, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(entryPath).pipe(Effect.option);
  return O.match(info, {
    onNone: () => UNREADABLE_ENTRY,
    onSome: (value): EntryReading => ({
      millis: O.map(value.mtime, (date) => date.getTime()),
      directory: value.type === "Directory",
    }),
  });
});

const entryMillis = (readings: ReadonlyArray<EntryReading>): ReadonlyArray<number> =>
  A.getSomes(A.map(readings, (reading) => reading.millis));

/** Absolute paths of a directory's immediate non-ignored children; `O.none()` when the directory itself is unreadable. */
const readableChildren = Effect.fn("Fleet.readableChildren")(function* (
  dir: string
): Effect.fn.Return<O.Option<ReadonlyArray<string>>, never, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs.readDirectory(dir).pipe(Effect.option);
  return O.map(names, (values) =>
    A.map(
      A.filter(values, (name) => !A.contains(IGNORED_TREE_ENTRIES, name)),
      (name) => path.join(dir, name)
    )
  );
});

/** Mtimes of one directory's children; an unreadable directory contributes nothing rather than failing the probe. */
const childMillis = Effect.fn("Fleet.childMillis")(function* (
  dir: string
): Effect.fn.Return<ReadonlyArray<number>, never, FleetMirrorServiceRequirements> {
  const children = yield* readableChildren(dir);
  if (O.isNone(children)) {
    return A.empty();
  }
  return entryMillis(yield* Effect.forEach(children.value, entryReading));
});

/** Mtimes across the given entries and, for those that are directories, their children — the checkout's top two levels. */
const treeMillis = Effect.fn("Fleet.treeMillis")(function* (
  entryPaths: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<number>, never, FleetMirrorServiceRequirements> {
  const readings = yield* Effect.forEach(entryPaths, entryReading);
  const directories = A.map(
    A.filter(A.zip(entryPaths, readings), ([, reading]) => reading.directory),
    ([entryPath]) => entryPath
  );
  const nested = yield* Effect.forEach(directories, childMillis);
  return A.appendAll(entryMillis(readings), A.flatten(nested));
});

const newestMillis = (millis: ReadonlyArray<number>): O.Option<number> =>
  A.reduce(millis, O.none<number>(), (newest, value) =>
    O.isSome(newest) && newest.value >= value ? newest : O.some(value)
  );

// Age of the newest reading, or a failed probe when nothing was measured — never a measured zero.
const measuredSince = (millis: ReadonlyArray<number>, nowMillis: number): FleetProbeReading =>
  O.match(newestMillis(millis), {
    onNone: () => PROBE_FAILED,
    onSome: (newest): FleetProbeReading => ({
      _tag: "measured",
      ageSeconds: Math.max(0, (nowMillis - newest) / 1000),
    }),
  });

const transcriptReading = Effect.fn("Fleet.transcriptReading")(function* (
  homeDir: O.Option<string>,
  checkoutPath: string,
  nowMillis: number
): Effect.fn.Return<FleetProbeReading, never, FleetMirrorServiceRequirements> {
  if (O.isNone(homeDir)) {
    return PROBE_FAILED;
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.join(homeDir.value, ".claude", "projects", transcriptProjectDirName(checkoutPath));
  const names = yield* Effect.result(fs.readDirectory(dir));
  if (Result.isFailure(names)) {
    return platformErrorTag(names.failure) === "NotFound" ? PROBE_ABSENT : PROBE_FAILED;
  }
  const transcripts = A.filter(names.success, Str.endsWith(".jsonl"));
  if (transcripts.length === 0) {
    return PROBE_ABSENT;
  }
  const readings = yield* Effect.forEach(transcripts, (name) => entryReading(path.join(dir, name)));
  return measuredSince(entryMillis(readings), nowMillis);
});

const worktreeMtimeReading = Effect.fn("Fleet.worktreeMtimeReading")(function* (
  checkoutPath: string,
  nowMillis: number
): Effect.fn.Return<FleetProbeReading, never, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const rootInfo = yield* fs.stat(checkoutPath).pipe(Effect.option);
  if (O.isNone(rootInfo)) {
    return PROBE_FAILED;
  }
  const entries = yield* readableChildren(checkoutPath);
  if (O.isNone(entries)) {
    return PROBE_FAILED;
  }
  const rootMillis = A.getSomes([O.map(rootInfo.value.mtime, (date) => date.getTime())]);
  return measuredSince(A.appendAll(rootMillis, yield* treeMillis(entries.value)), nowMillis);
});

const ensureScanner = Effect.fn("Fleet.ensureScanner")(function* (
  scannerDir: string,
  clones: ReadonlyArray<string>
): Effect.fn.Return<ScannerContext, never, FleetMirrorServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const alternates = A.join(
    A.map(clones, (clone) => path.join(clone, ".git", "objects")),
    ":"
  );
  const env = {
    GIT_TERMINAL_PROMPT: "0",
    GIT_ALTERNATE_OBJECT_DIRECTORIES: alternates,
  };
  const headPresent = yield* fs.exists(path.join(scannerDir, "HEAD")).pipe(Effect.orElseSucceed(() => false));
  if (headPresent) {
    return { scannerDir, available: true, env };
  }
  const made = yield* fs.makeDirectory(scannerDir, { recursive: true }).pipe(Effect.option);
  if (O.isNone(made)) {
    return { scannerDir, available: false, env };
  }
  const init = yield* runGitProbe(scannerDir, ["init", "--bare", "--quiet"]);
  const initialized = O.match(init, {
    onNone: () => false,
    onSome: (result) => result.exitCode === 0,
  });
  return { scannerDir, available: initialized, env };
});

const materializeTarget = Effect.fn("Fleet.materializeTarget")(function* (
  scanner: ScannerContext,
  originUrl: string,
  targetRef: string
): Effect.fn.Return<FleetEpochTarget, never, FleetMirrorServiceRequirements> {
  if (!scanner.available) {
    return FleetEpochTarget.make({ ref: targetRef, sha: null, materialized: false });
  }
  const lsRemote = gitStdout(
    yield* runGitProbe(scanner.scannerDir, ["ls-remote", "--quiet", originUrl, `refs/heads/${targetRef}`], scanner.env)
  );
  const sha = O.flatMap(lsRemote, (output) => {
    const token = A.head(Str.split(Str.trim(output), /\s+/));
    return O.filter(token, (value) => /^[0-9a-f]{40,64}$/.test(value));
  });
  if (O.isNone(sha)) {
    return FleetEpochTarget.make({ ref: targetRef, sha: null, materialized: false });
  }
  const hasObject = Effect.fnUntraced(function* (): Effect.fn.Return<
    boolean,
    never,
    ChildProcessSpawner.ChildProcessSpawner
  > {
    const probe = yield* runGitProbe(scanner.scannerDir, ["cat-file", "-e", `${sha.value}^{commit}`], scanner.env);
    return O.match(probe, { onNone: () => false, onSome: (result) => result.exitCode === 0 });
  });
  if (yield* hasObject()) {
    return FleetEpochTarget.make({ ref: targetRef, sha: sha.value, materialized: true });
  }
  yield* runGitProbe(
    scanner.scannerDir,
    ["fetch", "--no-tags", "--quiet", originUrl, `+refs/heads/${targetRef}:refs/fleet-mirror/target`],
    scanner.env
  );
  return FleetEpochTarget.make({ ref: targetRef, sha: sha.value, materialized: yield* hasObject() });
});

type CheckoutDerivation = {
  readonly row: FleetCheckout;
  readonly surface: ReadonlyArray<string>;
  readonly degraded: boolean;
};

/** Everything one scan measured once and every checkout row reads: the scanner, epoch target, process scan, and clock. */
type DerivationContext = {
  readonly scanner: ScannerContext;
  readonly target: FleetEpochTarget;
  readonly processScan: ProcessScan;
  readonly homeDir: O.Option<string>;
  readonly nowMillis: number;
  readonly windowSeconds: number;
};

type CheckoutEntryFacts = {
  readonly branch: string | null;
  readonly detached: boolean | null;
  readonly head: string | null;
};

const ABSENT_ENTRY_FACTS: CheckoutEntryFacts = { branch: null, detached: null, head: null };

// Enumeration facts, or all-null when `git worktree list` produced no entry for this checkout.
const entryFacts = (entry: WorktreeListEntry | null): CheckoutEntryFacts =>
  entry === null ? ABSENT_ENTRY_FACTS : { branch: entry.branch, detached: entry.detached, head: entry.head };

type StatusFacts = {
  readonly dirtyCount: number | null;
  readonly dirtyPaths: ReadonlyArray<string>;
};

const statusFacts = Effect.fn("Fleet.statusFacts")(function* (
  checkoutPath: string
): Effect.fn.Return<StatusFacts, never, FleetMirrorServiceRequirements> {
  const statusOutput = gitStdout(yield* runGitProbe(checkoutPath, ["status", "--porcelain=v1", "-z", "-uall"]));
  const status = O.map(statusOutput, parseStatusPorcelainZ);
  return {
    dirtyCount: O.match(status, { onNone: () => null, onSome: (parsed) => parsed.entryCount }),
    dirtyPaths: O.match(status, { onNone: A.empty<string>, onSome: (parsed) => parsed.paths }),
  };
});

type LivenessFacts = {
  readonly verdict: FleetLivenessVerdict;
  readonly transcript: FleetProbeReading;
  readonly worktreeMtime: FleetProbeReading;
};

const livenessFacts = Effect.fn("Fleet.livenessFacts")(function* (
  checkoutPath: string,
  context: DerivationContext
): Effect.fn.Return<LivenessFacts, never, FleetMirrorServiceRequirements> {
  const transcript = yield* transcriptReading(context.homeDir, checkoutPath, context.nowMillis);
  const worktreeMtime = yield* worktreeMtimeReading(checkoutPath, context.nowMillis);
  const verdict = classifyFleetLiveness(
    FleetLivenessReadings.make({
      processMatches: O.getOrElse(MutableHashMap.get(context.processScan.counts, checkoutPath), () => 0),
      processScanComplete: context.processScan.complete,
      transcript,
      worktreeMtime,
    }),
    context.windowSeconds
  );
  return { verdict, transcript, worktreeMtime };
});

const resolveMergeBase = Effect.fn("Fleet.resolveMergeBase")(function* (
  scanner: ScannerContext,
  head: string,
  targetSha: string
): Effect.fn.Return<O.Option<string>, never, FleetMirrorServiceRequirements> {
  const output = gitStdout(yield* runGitProbe(scanner.scannerDir, ["merge-base", targetSha, head], scanner.env));
  return O.filter(O.map(output, Str.trim), Str.isNonEmpty);
});

type BranchDiffReading = {
  readonly count: number | null;
  readonly paths: ReadonlyArray<string>;
  readonly probeFailed: boolean;
};

const BRANCH_DIFF_PROBE_FAILED: BranchDiffReading = { count: null, paths: A.empty(), probeFailed: true };

const branchDiffReading = Effect.fn("Fleet.branchDiffReading")(function* (
  scanner: ScannerContext,
  mergeBase: string,
  head: string
): Effect.fn.Return<BranchDiffReading, never, FleetMirrorServiceRequirements> {
  const output = gitStdout(
    yield* runGitProbe(scanner.scannerDir, ["diff", "--name-only", "-z", mergeBase, head], scanner.env)
  );
  return O.match(output, {
    onNone: () => BRANCH_DIFF_PROBE_FAILED,
    onSome: (stdout): BranchDiffReading => {
      const paths = nulPaths(stdout);
      return { count: A.length(paths), paths, probeFailed: false };
    },
  });
});

type PolicyReading = {
  readonly movement: FleetCheckout["policyMovement"];
  readonly reason: FleetCheckout["policyReason"];
  readonly paths: ReadonlyArray<string>;
  readonly probeFailed: boolean;
};

const POLICY_PROBE_FAILED: PolicyReading = {
  movement: "unknown",
  reason: "probe-failed",
  paths: A.empty(),
  probeFailed: true,
};

const policyReading = Effect.fn("Fleet.policyReading")(function* (
  scanner: ScannerContext,
  mergeBase: string,
  targetSha: string
): Effect.fn.Return<PolicyReading, never, FleetMirrorServiceRequirements> {
  const output = gitStdout(
    yield* runGitProbe(
      scanner.scannerDir,
      ["diff", "--name-only", "-z", mergeBase, targetSha, "--", ...FLEET_POLICY_SURFACE],
      scanner.env
    )
  );
  return O.match(output, {
    onNone: () => POLICY_PROBE_FAILED,
    onSome: (stdout): PolicyReading => {
      const paths = nulPaths(stdout);
      return { movement: paths.length > 0 ? "moved" : "unmoved", reason: null, paths, probeFailed: false };
    },
  });
});

type PolicyDerivation = {
  readonly mergeBase: string | null;
  readonly branchDiffCount: number | null;
  readonly branchDiffPaths: ReadonlyArray<string>;
  readonly policyMovement: FleetCheckout["policyMovement"];
  readonly policyReason: FleetCheckout["policyReason"];
  readonly policyPaths: ReadonlyArray<string>;
  readonly probeFailed: boolean;
};

const MERGE_BASE_PROBE_FAILED: PolicyDerivation = {
  mergeBase: null,
  branchDiffCount: null,
  branchDiffPaths: A.empty(),
  policyMovement: "unknown",
  policyReason: "probe-failed",
  policyPaths: A.empty(),
  probeFailed: true,
};

const policyDerivation = Effect.fn("Fleet.policyDerivation")(function* (
  scanner: ScannerContext,
  head: string,
  targetSha: string
): Effect.fn.Return<PolicyDerivation, never, FleetMirrorServiceRequirements> {
  const mergeBase = yield* resolveMergeBase(scanner, head, targetSha);
  if (O.isNone(mergeBase)) {
    return MERGE_BASE_PROBE_FAILED;
  }
  const branchDiff = yield* branchDiffReading(scanner, mergeBase.value, head);
  const policy = yield* policyReading(scanner, mergeBase.value, targetSha);
  return {
    mergeBase: mergeBase.value,
    branchDiffCount: branchDiff.count,
    branchDiffPaths: branchDiff.paths,
    policyMovement: policy.movement,
    policyReason: policy.reason,
    policyPaths: policy.paths,
    probeFailed: branchDiff.probeFailed || policy.probeFailed,
  };
});

type ConflictDerivation = {
  readonly conflict: FleetCheckout["conflict"];
  readonly conflictReason: FleetCheckout["conflictReason"];
  readonly conflictPaths: ReadonlyArray<string>;
  readonly probeFailed: boolean;
};

const CONFLICT_NOT_LIVE: ConflictDerivation = {
  conflict: "unknown",
  conflictReason: "not-live",
  conflictPaths: A.empty(),
  probeFailed: false,
};

const CONFLICT_PROBE_FAILED: ConflictDerivation = {
  conflict: "unknown",
  conflictReason: "probe-failed",
  conflictPaths: A.empty(),
  probeFailed: true,
};

const CONFLICT_CLEAN: ConflictDerivation = {
  conflict: "clean",
  conflictReason: null,
  conflictPaths: A.empty(),
  probeFailed: false,
};

// `merge-tree --write-tree` exits 0 clean and 1 conflicted; every other exit is a failed probe, never clean.
const mergeTreeDerivation = (result: GitProbeResult): ConflictDerivation =>
  Match.value(result.exitCode).pipe(
    Match.when(0, () => CONFLICT_CLEAN),
    Match.when(
      1,
      (): ConflictDerivation => ({
        conflict: "conflict",
        conflictReason: null,
        conflictPaths: parseMergeTreeConflictNames(result.stdout),
        probeFailed: false,
      })
    ),
    Match.orElse(() => CONFLICT_PROBE_FAILED)
  );

const conflictDerivation = Effect.fn("Fleet.conflictDerivation")(function* (
  scanner: ScannerContext,
  head: string,
  targetSha: string,
  livenessStatus: FleetLiveness
): Effect.fn.Return<ConflictDerivation, never, FleetMirrorServiceRequirements> {
  if (livenessStatus !== "live") {
    return CONFLICT_NOT_LIVE;
  }
  const mergeTree = yield* runGitProbe(
    scanner.scannerDir,
    ["merge-tree", "--write-tree", "--name-only", head, targetSha],
    scanner.env
  );
  return O.match(mergeTree, { onNone: () => CONFLICT_PROBE_FAILED, onSome: mergeTreeDerivation });
});

type DerivedSignals = PolicyDerivation & ConflictDerivation;

// Every signal unmeasured for one stated reason — the shape both `head-unknown` and `target-unmaterialized` produce.
const unmeasuredSignals = (reason: NonNullable<FleetCheckout["policyReason"]>): DerivedSignals => ({
  mergeBase: null,
  branchDiffCount: null,
  branchDiffPaths: A.empty(),
  policyMovement: "unknown",
  policyReason: reason,
  policyPaths: A.empty(),
  conflict: "unknown",
  conflictReason: reason,
  conflictPaths: A.empty(),
  probeFailed: false,
});

/** Reason precedence is positional: an unknown head outranks an unmaterialized target, which outranks any later probe. */
const deriveSignals = Effect.fn("Fleet.deriveSignals")(function* (
  context: DerivationContext,
  head: string | null,
  livenessStatus: FleetLiveness
): Effect.fn.Return<DerivedSignals, never, FleetMirrorServiceRequirements> {
  const targetSha = context.target.materialized ? context.target.sha : null;
  if (head === null) {
    return unmeasuredSignals("head-unknown");
  }
  if (targetSha === null) {
    return unmeasuredSignals("target-unmaterialized");
  }
  const policy = yield* policyDerivation(context.scanner, head, targetSha);
  const conflict = yield* conflictDerivation(context.scanner, head, targetSha, livenessStatus);
  return {
    mergeBase: policy.mergeBase,
    branchDiffCount: policy.branchDiffCount,
    branchDiffPaths: policy.branchDiffPaths,
    policyMovement: policy.policyMovement,
    policyReason: policy.policyReason,
    policyPaths: policy.policyPaths,
    conflict: conflict.conflict,
    conflictReason: conflict.conflictReason,
    conflictPaths: conflict.conflictPaths,
    probeFailed: policy.probeFailed || conflict.probeFailed,
  };
});

const deriveCheckout = Effect.fn("Fleet.deriveCheckout")(function* (
  stub: CheckoutStub,
  context: DerivationContext
): Effect.fn.Return<CheckoutDerivation, never, FleetMirrorServiceRequirements> {
  const status = yield* statusFacts(stub.path);
  const liveness = yield* livenessFacts(stub.path, context);
  const entry = entryFacts(stub.entry);
  const signals = yield* deriveSignals(context, entry.head, liveness.verdict.status);

  const row = FleetCheckout.make({
    path: stub.path,
    kind: stub.kind,
    branch: entry.branch,
    detached: entry.detached,
    head: entry.head,
    dirtyCount: status.dirtyCount,
    mergeBase: signals.mergeBase,
    branchDiffCount: signals.branchDiffCount,
    liveness: liveness.verdict.status,
    livenessEvidence: liveness.verdict.evidence,
    conflict: signals.conflict,
    conflictReason: signals.conflictReason,
    conflictPaths: signals.conflictPaths,
    policyMovement: signals.policyMovement,
    policyReason: signals.policyReason,
    policyPaths: signals.policyPaths,
  });

  const degraded =
    status.dirtyCount === null ||
    entry.head === null ||
    stub.entry === null ||
    liveness.transcript._tag === "failed" ||
    liveness.worktreeMtime._tag === "failed" ||
    signals.probeFailed;

  return { row, surface: A.appendAll(status.dirtyPaths, signals.branchDiffPaths), degraded };
});

const homeDirectory = (): O.Option<string> => configStringOptionSync("HOME");

const cacheDirectory = (homeDir: O.Option<string>): O.Option<string> =>
  O.orElse(configStringOptionSync("XDG_CACHE_HOME"), () => O.map(homeDir, (home) => `${home}/.cache`));

const scanFleet = Effect.fn("Fleet.scanFleet")(function* (
  options: FleetScanOptions
): Effect.fn.Return<FleetSnapshot, WorktreeCommandError, FleetMirrorServiceRequirements> {
  const path = yield* Path.Path;
  const nowMillis = yield* Clock.currentTimeMillis;
  const scannedAt = DateTime.formatIso(yield* DateTime.now);
  const windowSeconds = options.livenessWindowSeconds ?? FLEET_LIVENESS_WINDOW_SECONDS;
  const targetRef = options.targetRef ?? "main";

  const currentRoot = yield* findRepoRoot(options.startFrom).pipe(
    Effect.mapError(WorktreeCommandError.new("Failed to locate the current repository root."))
  );

  const originProbe = gitStdout(yield* runGitProbe(currentRoot, ["remote", "get-url", "origin"]));
  const originUrl = options.originUrl ?? (O.isSome(originProbe) ? Str.trim(originProbe.value) : null);
  if (originUrl === null || Str.isEmpty(originUrl)) {
    return yield* WorktreeCommandError.make({
      message: "Failed to resolve the origin URL for the current repository.",
      path: currentRoot,
    });
  }
  const normalizedOrigin = normalizeOriginUrl(originUrl);

  const fleetRoot = yield* O.match(O.fromUndefinedOr(options.fleetRoot), {
    onSome: Effect.succeed,
    onNone: () =>
      Effect.map(runGitProbe(currentRoot, ["rev-parse", "--git-common-dir"]), (probe): string =>
        O.match(gitStdout(probe), {
          onNone: () => path.dirname(currentRoot),
          onSome: (output) => path.dirname(path.dirname(path.resolve(currentRoot, Str.trim(output)))),
        })
      ),
  });

  const homeDir = O.orElse(O.fromUndefinedOr(options.homeDir), () => homeDirectory());
  const scannerDir = O.getOrElse(O.fromUndefinedOr(options.scannerDir), () =>
    O.match(cacheDirectory(homeDir), {
      onNone: () => path.join(fleetRoot, ".beep-fleet-scanner"),
      onSome: (cache) => path.join(cache, "beep", "fleet-scanner"),
    })
  );

  const { clones, stubs } = yield* enumerateFleet(fleetRoot, normalizedOrigin);
  const processScan = yield* scanProcesses(A.map(stubs, (stub) => stub.path));
  const scanner = yield* ensureScanner(scannerDir, clones);
  const target = yield* materializeTarget(scanner, originUrl, targetRef);

  const context: DerivationContext = { scanner, target, processScan, homeDir, nowMillis, windowSeconds };
  const derivations = yield* Effect.forEach(stubs, (stub) => deriveCheckout(stub, context), { concurrency: 8 });

  const contestedPaths = buildContestedIndex(
    A.map(derivations, (derivation) => [derivation.row.path, derivation.surface] as const)
  );

  return FleetSnapshot.make({
    fleetRoot,
    originUrl,
    scannedAt,
    target,
    coverage: FleetScanCoverage.make({
      clonesDiscovered: A.length(clones),
      checkoutsDiscovered: A.length(stubs),
      checkoutsDegraded: A.length(A.filter(derivations, (derivation) => derivation.degraded)),
      processesScanned: processScan.scanned,
      processesUnreadable: processScan.unreadable,
    }),
    checkouts: A.map(derivations, (derivation) => derivation.row),
    contestedPaths,
  });
});

const makeFleetMirrorService = Effect.fn("FleetMirrorService.make")(function* () {
  const runtimeContext = yield* Effect.context<FleetMirrorServiceRequirements>();
  return FleetMirrorService.of({
    scan: Effect.fn("FleetMirrorService.scan")((options) =>
      scanFleet(options ?? FleetScanOptions.make({})).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Live layer for {@link FleetMirrorService}.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { FleetMirrorServiceLive } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(typeof FleetMirrorServiceLive) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FleetMirrorServiceLive: Layer.Layer<FleetMirrorService, never, FleetMirrorServiceRequirements> =
  Layer.effect(FleetMirrorService, makeFleetMirrorService());
