/**
 * Residue reap's `drainable` class: assess whole fleet checkouts against the
 * drain predicate, keep the grace window in the fleet registry, bundle
 * local-only work before removal, and journal every applied decision.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isPathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { GitObjectId } from "@beep/schema/Conformance";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCaptureRaw } from "../../../internal/repo-run/RepoRun.executor.ts";
import { classifyFleetLiveness } from "../Fleet.service.ts";
import { FleetLivenessReadings } from "../Worktree.schemas.ts";
import { FleetDrainStatus, FleetRegistryRow, FleetSeatRole } from "./FleetRegistry.schemas.ts";
import { fleetAdoptionRole } from "./FleetRegistry.ts";
import {
  ResidueDrainAssessment,
  ResidueDrainCheckResult,
  ResidueDrainDisk,
  ResidueDrainJournalEntry,
} from "./ResidueReapDrain.schemas.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { FleetCheckoutKind } from "../Worktree.schemas.ts";
import type {
  ResidueDrainCheck,
  ResidueDrainFleetFacts,
  ResidueDrainJournalOutcome,
  ResidueDrainLivenessReadings,
  ResidueDrainOutcome,
} from "./ResidueReapDrain.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/internal/ResidueReapDrain");

const decodeGitObjectId = S.decodeUnknownOption(GitObjectId);
const encodeJournalEntry = S.encodeEffect(S.fromJsonString(ResidueDrainJournalEntry));

/**
 * Probe contract for the facts a drain reads outside git: fleet-wide facts,
 * per-checkout liveness readings, and the registry rows holding grace state.
 *
 * **Details**
 *
 * `facts` answers `None` when the registry, roots or state directory cannot
 * be read; the drain then assesses nothing. `updateRegistry` applies a
 * transform to the registry rows under the registry lock and answers the rows
 * it wrote, or `None` when the write failed.
 *
 * @category ports
 * @since 0.0.0
 */
export type ResidueDrainProbeShape = {
  readonly facts: (repoRoot: string) => Effect.Effect<O.Option<ResidueDrainFleetFacts>>;
  readonly livenessReadings: (checkout: string, nowMillis: number) => Effect.Effect<ResidueDrainLivenessReadings>;
  readonly updateRegistry: (
    repoRoot: string,
    transform: (rows: ReadonlyArray<FleetRegistryRow>) => ReadonlyArray<FleetRegistryRow>
  ) => Effect.Effect<O.Option<ReadonlyArray<FleetRegistryRow>>>;
};

/**
 * Service tag for the drain probe.
 *
 * **Example** (Access the probe)
 *
 * ```ts
 * import { ResidueDrainProbe } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(ResidueDrainProbe, (probe) => probe.facts("/repo"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ResidueDrainProbe extends Context.Service<ResidueDrainProbe, ResidueDrainProbeShape>()(
  $I`ResidueDrainProbe`
) {}

/**
 * Build a drain probe layer from a fixed shape, for tests and offline runs.
 *
 * **Example** (A probe that cannot read fleet facts)
 *
 * ```ts
 * import { layerResidueDrainProbeTest } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const layer = layerResidueDrainProbeTest({
 *   facts: () => Effect.succeedNone,
 *   livenessReadings: () => Effect.die("unused"),
 *   updateRegistry: () => Effect.succeedNone,
 * })
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @param shape - The probe implementation.
 * @returns A layer providing {@link ResidueDrainProbe}.
 * @category layers
 * @since 0.0.0
 */
export const layerResidueDrainProbeTest = (shape: ResidueDrainProbeShape): Layer.Layer<ResidueDrainProbe> =>
  Layer.succeed(ResidueDrainProbe, ResidueDrainProbe.of(shape));

type DrainRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner;

type CwdProbe = (candidatePath: string) => Effect.Effect<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path>;

// Git facts of one checkout: where it lives, which `.git` holds it, and what it has checked out.
type DrainLayout = {
  readonly checkout: string;
  readonly real: string;
  readonly kind: FleetCheckoutKind;
  readonly commonDir: string;
  readonly owningClone: O.Option<string>;
  readonly branch: O.Option<string>;
  readonly head: O.Option<string>;
};

// An `objects/info/alternates` entry: `borrower` reads objects from `objects`.
type Borrowing = {
  readonly borrower: string;
  readonly objects: string;
};

// Everything one drain pass reads once and every checkout's checks share: the fleet facts, the
// invoker's real path, every fleet clone's alternates entries (`None` when one is unreadable),
// the clock, the grace window and the reap's process-cwd probe.
type ResidueDrainContext = {
  readonly facts: ResidueDrainFleetFacts;
  readonly invoker: string;
  readonly borrowings: O.Option<ReadonlyArray<{ readonly borrower: string; readonly objects: string }>>;
  readonly nowMillis: number;
  readonly graceDays: number;
  readonly cwdProbe: CwdProbe;
};

// Stdout of a successful git command; any failure or non-zero exit is `None`.
const gitStdout = (cwd: string, args: ReadonlyArray<string>) =>
  runRepoCommandCaptureRaw("git", ["--no-optional-locks", ...args], cwd).pipe(
    Effect.option,
    Effect.map(O.flatMap((capture) => (N.Equivalence(capture.exitCode, 0) ? O.some(capture.output) : O.none())))
  );

const nonEmptyLines = (text: string): ReadonlyArray<string> =>
  A.filter(A.map(Str.split("\n")(text), Str.trim), Str.isNonEmpty);

const trimmedNonEmpty = (text: O.Option<string>): O.Option<string> => O.filter(O.map(text, Str.trim), Str.isNonEmpty);

const drainLayout = Effect.fnUntraced(function* (
  checkout: string
): Effect.fn.Return<O.Option<DrainLayout>, never, DrainRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const real = yield* fs.realPath(checkout).pipe(Effect.option);
  if (O.isNone(real)) return O.none();
  const dirs = yield* gitStdout(real.value, ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"]);
  const lines = O.map(dirs, nonEmptyLines);
  const gitDir = O.flatMap(lines, A.get(0));
  const commonDirLexical = O.flatMap(lines, A.get(1));
  if (O.isNone(gitDir) || O.isNone(commonDirLexical)) return O.none();
  const gitDirReal = yield* fs.realPath(gitDir.value).pipe(Effect.option);
  const commonDir = yield* fs.realPath(commonDirLexical.value).pipe(Effect.option);
  if (O.isNone(gitDirReal) || O.isNone(commonDir)) return O.none();
  const clone = Str.Equivalence(gitDirReal.value, commonDir.value);
  const branch = yield* gitStdout(real.value, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const head = yield* gitStdout(real.value, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  return O.some({
    checkout,
    real: real.value,
    kind: clone ? "clone" : "linked-worktree",
    commonDir: commonDir.value,
    owningClone: clone ? O.none() : O.some(path.dirname(commonDir.value)),
    branch: trimmedNonEmpty(branch),
    head: trimmedNonEmpty(head),
  });
});

// Every alternates entry of every fleet clone; one unreadable file makes the index unknown.
const borrowingsOf = Effect.fnUntraced(function* (
  layouts: ReadonlyArray<DrainLayout>
): Effect.fn.Return<O.Option<ReadonlyArray<Borrowing>>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const clones = A.filter(layouts, (layout) => layout.kind === "clone");
  const readings = yield* Effect.forEach(clones, (clone) => {
    const objects = path.join(clone.commonDir, "objects");
    const file = path.join(objects, "info", "alternates");
    return fs.exists(file).pipe(
      Effect.flatMap((exists) => (exists ? fs.readFileString(file) : Effect.succeed(""))),
      Effect.map((text) =>
        A.map(
          A.filter(nonEmptyLines(text), (line) => !Str.startsWith("#")(line)),
          (line): Borrowing => ({ borrower: clone.checkout, objects: path.resolve(objects, line) })
        )
      ),
      Effect.option
    );
  });
  return A.every(readings, O.isSome) ? O.some(A.flatten(A.getSomes(readings))) : O.none();
});

/**
 * Read the fleet facts and borrowing index one drain pass shares.
 *
 * **Details**
 *
 * Answers `None` when the probe cannot read the fleet facts; the drain then
 * assesses nothing and the reap reports a warning.
 *
 * **Example** (Build the context effect)
 *
 * ```ts
 * import { loadResidueDrainContext } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const context = loadResidueDrainContext({
 *   repoRoot: "/repo",
 *   checkouts: ["/repo"],
 *   nowMillis: 0,
 *   graceDays: 7,
 *   cwdProbe: () => Effect.succeed(O.some(false)),
 * })
 * console.log(Effect.isEffect(context)) // true
 * ```
 *
 * @param input - The invoking checkout, the fleet checkouts, the clock, the grace window and the cwd probe.
 * @returns The shared drain context, or `None` when the fleet facts are unreadable.
 * @category constructors
 * @since 0.0.0
 */
export const loadResidueDrainContext = Effect.fnUntraced(function* (input: {
  readonly repoRoot: string;
  readonly checkouts: ReadonlyArray<string>;
  readonly nowMillis: number;
  readonly graceDays: number;
  readonly cwdProbe: CwdProbe;
}): Effect.fn.Return<O.Option<ResidueDrainContext>, never, DrainRequirements | ResidueDrainProbe> {
  const fs = yield* FileSystem.FileSystem;
  const probe = yield* ResidueDrainProbe;
  const facts = yield* probe.facts(input.repoRoot);
  if (O.isNone(facts)) return O.none();
  const invoker = yield* fs.realPath(input.repoRoot).pipe(Effect.orElseSucceed(() => input.repoRoot));
  const layouts = yield* Effect.forEach(input.checkouts, drainLayout, { concurrency: 8 });
  const borrowings = yield* borrowingsOf(A.getSomes(layouts));
  return O.some({
    facts: facts.value,
    invoker,
    borrowings,
    nowMillis: input.nowMillis,
    graceDays: input.graceDays,
    cwdProbe: input.cwdProbe,
  });
});

const checkResult = (check: ResidueDrainCheck, outcome: ResidueDrainOutcome, detail: string) =>
  ResidueDrainCheckResult.make({ check, outcome, detail });

const refuses = (result: ResidueDrainCheckResult): boolean =>
  result.outcome === "fail" || result.outcome === "probe-failed";

// A path list check: unreadable list → probe-failed, any listed path inside the checkout → fail.
const pathListCheck = (
  check: ResidueDrainCheck,
  layout: DrainLayout,
  paths: ReadonlyArray<string> | null,
  failure: (path: string) => string,
  success: string
): ResidueDrainCheckResult => {
  if (paths === null) return checkResult(check, "probe-failed", "probe could not answer");
  const hit = A.findFirst(
    paths,
    (candidate) => isPathWithinRoot(layout.real, candidate) || isPathWithinRoot(layout.checkout, candidate)
  );
  return O.match(hit, {
    onNone: () => checkResult(check, "pass", success),
    onSome: (path) => checkResult(check, "fail", failure(path)),
  });
};

const registryRowFor = (facts: ResidueDrainFleetFacts, checkout: string): O.Option<FleetRegistryRow> =>
  A.findFirst(facts.registry, (row) => Str.Equivalence(row.checkout, checkout));

const seatRoleOf = (facts: ResidueDrainFleetFacts, layout: DrainLayout): FleetSeatRole =>
  O.match(registryRowFor(facts, layout.checkout), {
    onNone: () => fleetAdoptionRole({ roots: facts.roots, checkout: layout.checkout, kind: layout.kind }),
    onSome: (row) => row.seatRole,
  });

const livenessCheck = Effect.fnUntraced(function* (context: ResidueDrainContext, layout: DrainLayout) {
  const probe = yield* ResidueDrainProbe;
  const readings = yield* probe.livenessReadings(layout.checkout, context.nowMillis);
  const cwd = yield* context.cwdProbe(layout.real);
  const verdict = classifyFleetLiveness(
    FleetLivenessReadings.make({
      processMatches: O.exists(cwd, (live) => live) ? 1 : 0,
      processScanComplete: O.isSome(cwd),
      sessionMatches: readings.sessionMatches,
      transcript: readings.transcript,
      worktreeMtime: readings.worktreeMtime,
    })
  );
  if (verdict.status === "dormant") return checkResult("liveness", "pass", "confirmed dormant");
  return verdict.status === "live"
    ? checkResult("liveness", "fail", `live (${A.join(verdict.evidence, ", ")})`)
    : checkResult("liveness", "probe-failed", "liveness unknown: a probe could not confirm inactivity");
});

const ownedWorktreesCheck = Effect.fnUntraced(function* (layout: DrainLayout) {
  if (layout.kind !== "clone") return checkResult("owned-worktrees", "pass", "linked worktree owns no worktrees");
  const listing = yield* gitStdout(layout.real, ["worktree", "list", "--porcelain"]);
  if (O.isNone(listing)) return checkResult("owned-worktrees", "probe-failed", "git worktree list failed");
  const blocks = A.filter(A.map(Str.split("\n\n")(listing.value), nonEmptyLines), (lines) =>
    O.exists(A.head(lines), Str.startsWith("worktree "))
  );
  // The first block is the clone itself; a prunable entry has lost its directory and holds nothing.
  const registered = A.filter(A.drop(blocks, 1), (lines) => !A.some(lines, Str.startsWith("prunable")));
  return A.isReadonlyArrayEmpty(registered)
    ? checkResult("owned-worktrees", "pass", "no registered worktrees")
    : checkResult("owned-worktrees", "fail", `${A.length(registered)} registered worktree(s) still use this clone`);
});

const objectBorrowersCheck = (context: ResidueDrainContext, layout: DrainLayout): ResidueDrainCheckResult => {
  if (layout.kind !== "clone") return checkResult("object-borrowers", "pass", "linked worktree lends no objects");
  return O.match(context.borrowings, {
    onNone: () => checkResult("object-borrowers", "probe-failed", "an alternates file could not be read"),
    onSome: (borrowings) => {
      const borrowers = A.dedupe(
        A.map(
          A.filter(
            borrowings,
            (borrowing) =>
              !Str.Equivalence(borrowing.borrower, layout.checkout) &&
              isPathWithinRoot(layout.commonDir, borrowing.objects)
          ),
          (borrowing) => borrowing.borrower
        )
      );
      return A.isReadonlyArrayEmpty(borrowers)
        ? checkResult("object-borrowers", "pass", "no clone borrows objects from it")
        : checkResult("object-borrowers", "fail", `objects borrowed by ${A.join(borrowers, ", ")}`);
    },
  });
};

// What counts as local-only work: a clone's branches, tags, HEAD and stashes; a lane's HEAD.
type LocalOnlySpec = {
  readonly include: ReadonlyArray<string>;
  readonly exclude: ReadonlyArray<string>;
  readonly stashes: ReadonlyArray<string>;
};

const localOnlySpec = Effect.fnUntraced(function* (layout: DrainLayout) {
  if (layout.kind !== "clone") {
    return O.some<LocalOnlySpec>({ include: ["HEAD"], exclude: ["--remotes", "--branches", "--tags"], stashes: [] });
  }
  const stashes = yield* gitStdout(layout.real, ["stash", "list", "--format=%H"]);
  return O.map(
    stashes,
    (text): LocalOnlySpec => ({
      include: ["--branches", "--tags", "HEAD"],
      exclude: ["--remotes"],
      stashes: nonEmptyLines(text),
    })
  );
});

const countRevisions = Effect.fnUntraced(function* (layout: DrainLayout, args: ReadonlyArray<string>) {
  const counted = yield* gitStdout(layout.real, ["rev-list", "--count", ...args]);
  return O.flatMap(trimmedNonEmpty(counted), N.parse);
});

const localOnlyCheck = Effect.fnUntraced(function* (layout: DrainLayout) {
  const spec = yield* localOnlySpec(layout);
  if (O.isNone(spec)) return checkResult("local-only-work", "probe-failed", "git stash list failed");
  const commits = yield* countRevisions(layout, [
    ...spec.value.include,
    ...spec.value.stashes,
    "--not",
    ...spec.value.exclude,
  ]);
  return O.match(commits, {
    onNone: () => checkResult("local-only-work", "probe-failed", "git rev-list failed"),
    onSome: (count) =>
      N.Equivalence(count, 0)
        ? checkResult("local-only-work", "pass", "every local ref is reachable from a remote ref")
        : checkResult(
            "local-only-work",
            "bundle-required",
            `${count} local-only commit(s), ${A.length(spec.value.stashes)} stash(es)`
          ),
  });
});

const cleanTreeCheck = Effect.fnUntraced(function* (layout: DrainLayout) {
  const status = yield* gitStdout(layout.real, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=none",
  ]);
  return O.match(status, {
    onNone: () => checkResult("clean-tree", "probe-failed", "git status failed"),
    onSome: (text) => {
      const changed = A.length(A.filter(Str.split("\u0000")(text), Str.isNonEmpty));
      return N.Equivalence(changed, 0)
        ? checkResult("clean-tree", "pass", "clean")
        : checkResult("clean-tree", "fail", `${changed} changed path(s)`);
    },
  });
});

const notEvaluated = (check: ResidueDrainCheck) =>
  checkResult(check, "not-evaluated", "skipped: an earlier check refused the drain");

// Every check except the grace window, cheap facts first; the costly git reads run only while nothing refused.
const predicateChecks = Effect.fnUntraced(function* (context: ResidueDrainContext, layout: DrainLayout) {
  const { facts } = context;
  const role = seatRoleOf(facts, layout);
  const exempt = O.exists(registryRowFor(facts, layout.checkout), (row) => row.retentionExempt);
  const cheap = [
    FleetSeatRole.is.legacy(role) || FleetSeatRole.is.adopted(role)
      ? checkResult("seat-role", "pass", `seat role ${role}`)
      : checkResult("seat-role", "fail", `seat role ${role} is an authored seat`),
    exempt
      ? checkResult("retention-exempt", "fail", "registry marks it retention-exempt")
      : checkResult("retention-exempt", "pass", "not exempt"),
    isPathWithinRoot(layout.real, context.invoker)
      ? checkResult("invoking-checkout", "fail", "the reap runs from inside it")
      : checkResult("invoking-checkout", "pass", "not the invoking checkout"),
    pathListCheck(
      "timer-host",
      layout,
      facts.timerDirectories,
      (dir) => `systemd user unit working directory ${dir}`,
      "hosts no systemd user unit"
    ),
    pathListCheck(
      "proof-unit",
      layout,
      facts.proofUnitCheckouts,
      (dir) => `active beep-proof unit for ${dir}`,
      "no active beep-proof unit"
    ),
    O.match(layout.branch, {
      onNone: () =>
        facts.openPullRequestHeads === null
          ? checkResult("open-pr", "probe-failed", "open pull requests could not be listed")
          : checkResult("open-pr", "pass", "detached HEAD"),
      onSome: (branch) =>
        facts.openPullRequestHeads === null
          ? checkResult("open-pr", "probe-failed", "open pull requests could not be listed")
          : A.contains(facts.openPullRequestHeads, branch)
            ? checkResult("open-pr", "fail", `branch ${branch} has an open pull request`)
            : checkResult("open-pr", "pass", `no open pull request for ${branch}`),
    }),
    pathListCheck(
      "session-ledger",
      layout,
      facts.openSessionCheckouts,
      (dir) => `open session-ledger row for ${dir}`,
      "no open session-ledger row"
    ),
  ];
  const liveness = yield* livenessCheck(context, layout);
  const owned = yield* ownedWorktreesCheck(layout);
  const borrowed = objectBorrowersCheck(context, layout);
  const early = [...cheap, liveness, owned, borrowed];
  if (A.some(early, refuses)) return A.appendAll(early, [notEvaluated("local-only-work"), notEvaluated("clean-tree")]);
  const localOnly = yield* localOnlyCheck(layout);
  if (refuses(localOnly)) return A.appendAll(early, [localOnly, notEvaluated("clean-tree")]);
  const clean = yield* cleanTreeCheck(layout);
  return A.appendAll(early, [localOnly, clean]);
});

const predicateHolds = (checks: ReadonlyArray<ResidueDrainCheckResult>): boolean =>
  A.every(checks, (result) => result.outcome === "pass" || result.outcome === "bundle-required");

const graceCheck = (
  context: ResidueDrainContext,
  observation: Observation,
  row: O.Option<FleetRegistryRow>
): ResidueDrainCheckResult => {
  if (!observation.drainable) return checkResult("grace-window", "not-evaluated", "the drain predicate does not hold");
  // A grace start counts only for the HEAD it was recorded at.
  const since = O.flatMap(
    O.filter(row, (value) =>
      O.exists(
        observation.layout.head,
        (head) => value.drainingHead !== null && Str.Equivalence(head, value.drainingHead)
      )
    ),
    (value) => O.fromNullishOr(value.drainingSince)
  );
  if (O.isNone(since)) {
    return checkResult("grace-window", "probe-failed", "the registry holds no grace start for this HEAD");
  }
  const sinceMillis = DateTime.toEpochMillis(since.value);
  const dueMillis = sinceMillis + Duration.toMillis(Duration.days(context.graceDays));
  const sinceIso = DateTime.formatIso(since.value);
  return context.nowMillis >= dueMillis
    ? checkResult("grace-window", "pass", `drainable since ${sinceIso}`)
    : checkResult(
        "grace-window",
        "fail",
        `drainable since ${sinceIso}; eligible from ${DateTime.formatIso(DateTime.makeUnsafe(dueMillis))}`
      );
};

type Observation = {
  readonly layout: DrainLayout;
  readonly role: FleetSeatRole;
  readonly checks: ReadonlyArray<ResidueDrainCheckResult>;
  readonly drainable: boolean;
};

const observeRow = (row: FleetRegistryRow, observation: Observation, now: DateTime.Utc): FleetRegistryRow => {
  const head = O.flatMap(observation.layout.head, decodeGitObjectId);
  if (observation.drainable && O.isSome(head)) {
    const keep = row.drainingSince !== null && row.drainingHead === head.value;
    return FleetRegistryRow.make({
      ...row,
      drainStatus: FleetDrainStatus.Enum.draining,
      drainingSince: keep ? row.drainingSince : now,
      drainingHead: head.value,
    });
  }
  return FleetRegistryRow.make({
    ...row,
    drainStatus: FleetDrainStatus.is.retired(row.drainStatus) ? row.drainStatus : FleetDrainStatus.Enum.active,
    drainingSince: null,
    drainingHead: null,
  });
};

// Record each observation on its registry row, adopting checkouts the registry does not list yet.
const observeRegistry =
  (observations: ReadonlyArray<Observation>, now: DateTime.Utc) =>
  (rows: ReadonlyArray<FleetRegistryRow>): ReadonlyArray<FleetRegistryRow> => {
    const observationFor = (checkout: string) =>
      A.findFirst(observations, (observation) => Str.Equivalence(observation.layout.checkout, checkout));
    const updated = A.map(rows, (row) =>
      O.match(observationFor(row.checkout), {
        onNone: () => row,
        onSome: (observation) => observeRow(row, observation, now),
      })
    );
    const adopted = A.map(
      A.filter(
        observations,
        (observation) => !A.some(rows, (row) => Str.Equivalence(row.checkout, observation.layout.checkout))
      ),
      (observation) =>
        observeRow(
          FleetRegistryRow.make({
            checkout: observation.layout.checkout,
            seatRole: observation.role,
            owningSeat: O.getOrNull(observation.layout.owningClone),
          }),
          observation,
          now
        )
    );
    return A.sortWith(A.appendAll(updated, adopted), (row) => row.checkout, Order.String);
  };

const assessmentOf = (
  context: ResidueDrainContext,
  observation: Observation,
  row: O.Option<FleetRegistryRow>
): ResidueDrainAssessment => {
  const grace = graceCheck(context, observation, row);
  const since = O.flatMap(row, (value) => O.fromNullishOr(value.drainingSince));
  return ResidueDrainAssessment.make({
    checkout: observation.layout.checkout,
    kind: observation.layout.kind,
    seatRole: observation.role,
    owningClone: O.getOrNull(observation.layout.owningClone),
    branch: O.getOrNull(observation.layout.branch),
    head: O.getOrNull(observation.layout.head),
    drainingSince: O.getOrNull(O.map(since, DateTime.formatIso)),
    graceDays: context.graceDays,
    checks: A.append(observation.checks, grace),
    drainable: observation.drainable,
    eligible: observation.drainable && grace.outcome === "pass",
    bundle: null,
    preserved: null,
  });
};

const observe = Effect.fnUntraced(function* (context: ResidueDrainContext, layout: DrainLayout) {
  const checks = yield* predicateChecks(context, layout);
  return {
    layout,
    role: seatRoleOf(context.facts, layout),
    checks,
    drainable: predicateHolds(checks),
  } satisfies Observation;
});

/**
 * Assess every fleet checkout against the drain predicate and record the
 * observations in the fleet registry.
 *
 * **Details**
 *
 * Each checkout gets every drain check (see {@link ResidueDrainCheck}); a
 * checkout whose git layout cannot be read is reported in `unreadable`.
 * The registry update keeps a row's `drainingSince` while the predicate keeps
 * holding at the same HEAD and clears it otherwise, so `grace-window` passes
 * only after an unbroken drainable run of `graceDays`. Dry runs record
 * observations too: the registry is bookkeeping, never checkout state.
 *
 * **Example** (Build the assessment effect)
 *
 * ```ts
 * import { assessResidueDrain } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof assessResidueDrain) // "function"
 * ```
 *
 * @param context - The shared drain context.
 * @param repoRoot - The invoking checkout, which keys the registry.
 * @param checkouts - The fleet checkouts to assess.
 * @returns One assessment per readable checkout, the unreadable checkouts, and warnings.
 * @category workflows
 * @since 0.0.0
 */
export const assessResidueDrain = Effect.fnUntraced(function* (
  context: ResidueDrainContext,
  repoRoot: string,
  checkouts: ReadonlyArray<string>
): Effect.fn.Return<
  {
    readonly assessments: ReadonlyArray<ResidueDrainAssessment>;
    readonly unreadable: ReadonlyArray<string>;
    readonly warnings: ReadonlyArray<string>;
  },
  never,
  DrainRequirements | ResidueDrainProbe
> {
  const probe = yield* ResidueDrainProbe;
  const layouts = yield* Effect.forEach(
    checkouts,
    (checkout) => Effect.map(drainLayout(checkout), (layout) => [checkout, layout] as const),
    { concurrency: 8 }
  );
  const unreadable = A.map(
    A.filter(layouts, ([, layout]) => O.isNone(layout)),
    ([checkout]) => checkout
  );
  const observations = yield* Effect.forEach(
    A.getSomes(A.map(layouts, ([, layout]) => layout)),
    (layout) => observe(context, layout),
    { concurrency: 4 }
  );
  const now = DateTime.makeUnsafe(context.nowMillis);
  const written = yield* probe.updateRegistry(repoRoot, observeRegistry(observations, now));
  const rows = O.getOrElse(written, () => context.facts.registry);
  const assessments = A.map(observations, (observation) =>
    assessmentOf(
      context,
      observation,
      A.findFirst(rows, (row) => Str.Equivalence(row.checkout, observation.layout.checkout))
    )
  );
  return {
    assessments,
    unreadable,
    warnings: O.isNone(written)
      ? ["The fleet registry could not record drain observations; no grace window advanced."]
      : [],
  };
});

type BundleSpec = LocalOnlySpec & { readonly tempRefs: ReadonlyArray<string> };

const bundleFileName = (real: string, runId: string): string =>
  `${Str.replace(/^_+/u, "")(Str.replace(/[^A-Za-z0-9._-]+/gu, "_")(real))}-${runId}.bundle`;

// A verified bundle and the head shas it carries.
type BundleWritten = { readonly file: string; readonly heads: ReadonlyArray<string> };

const writeBundle = Effect.fnUntraced(function* (
  layout: DrainLayout,
  spec: BundleSpec,
  file: string
): Effect.fn.Return<Result.Result<BundleWritten, string>, never, DrainRequirements> {
  const include = [...spec.include, ...spec.tempRefs];
  const created = yield* gitStdout(layout.real, ["bundle", "create", file, ...include, "--not", ...spec.exclude]);
  if (O.isNone(created)) return Result.fail("git bundle create failed");
  const verified = yield* gitStdout(layout.real, ["bundle", "verify", file]);
  if (O.isNone(verified)) return Result.fail("git bundle verify failed");
  const heads = yield* gitStdout(layout.real, ["bundle", "list-heads", file]);
  const shas = A.getSomes(
    A.map(O.getOrElse(O.map(heads, nonEmptyLines), A.empty<string>), (line) => A.head(Str.split(" ")(line)))
  );
  if (A.isReadonlyArrayEmpty(shas)) return Result.fail("the bundle lists no heads");
  // Every local-only commit must be reachable from a bundled head.
  const residual = yield* countRevisions(layout, [...include, "--not", ...spec.exclude, ...shas]);
  return O.exists(residual, (count) => N.Equivalence(count, 0))
    ? Result.succeed({ file, heads: shas })
    : Result.fail("the bundle does not cover every local-only commit");
});

const bundleLocalOnlyWork = Effect.fnUntraced(function* (
  layout: DrainLayout,
  stateDirectory: string,
  runId: string
): Effect.fn.Return<Result.Result<BundleWritten, string>, never, DrainRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spec = yield* localOnlySpec(layout);
  if (O.isNone(spec)) return Result.fail("git stash list failed");
  const directory = path.join(stateDirectory, DRAIN_BUNDLES);
  const made = yield* fs.makeDirectory(directory, { recursive: true }).pipe(Effect.option);
  if (O.isNone(made)) return Result.fail(`could not create ${directory}`);
  const file = path.join(directory, bundleFileName(layout.real, runId));
  // Stash entries are reflog entries, not refs: name each under a temporary ref for the bundle.
  const tempRefs = A.map(spec.value.stashes, (_, index) => `refs/beep-drain/stash-${index}`);
  const named = yield* Effect.forEach(A.zip(tempRefs, spec.value.stashes), ([ref, sha]) =>
    gitStdout(layout.real, ["update-ref", ref, sha])
  );
  const release = Effect.forEach(tempRefs, (ref) => gitStdout(layout.real, ["update-ref", "-d", ref]), {
    discard: true,
  });
  if (!A.every(named, O.isSome)) {
    yield* release;
    return Result.fail("could not name the stash entries for the bundle");
  }
  return yield* writeBundle(layout, { ...spec.value, tempRefs }, file).pipe(Effect.ensuring(release));
});

const DRAIN_BUNDLES = "drain-bundles";

// Ignored directories kept whole: secret stores and machine-local config directories. Every other
// ignored directory (`node_modules/`, `dist/`, `.turbo/`, `.beep/`, tool caches) is regenerable.
const PRESERVED_DIRECTORY_NAME = /^(?:\.?secrets|[^/]*\.local(?:\.[^/]*)?)$/u;
const PRESERVED_BYTES_CAP = 512 * 1024 ** 2;

const entryName = (entry: string): string => {
  const trimmed = Str.replace(/\/$/u, "")(entry);
  return O.getOrElse(A.last(Str.split("/")(trimmed)), () => trimmed);
};

// Bytes of one ignored path to preserve, or `None` for a symlink (it points elsewhere and loses
// nothing) or a regenerable directory.
const preservedBytes = Effect.fnUntraced(function* (root: string, entry: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(root, Str.replace(/\/$/u, "")(entry));
  const link = yield* fs.readLink(absolute).pipe(Effect.option);
  if (O.isSome(link)) return O.none<number>();
  if (Str.endsWith("/")(entry)) {
    if (!PRESERVED_DIRECTORY_NAME.test(entryName(entry))) return O.none<number>();
    const capture = yield* runRepoCommandCaptureRaw("du", ["-B1", "--apparent-size", "-s", "--", absolute], root).pipe(
      Effect.option
    );
    return O.some(
      O.getOrElse(
        O.flatMap(capture, (result) => O.flatMap(A.head(Str.split("\t")(Str.trim(result.output))), N.parse)),
        () => PRESERVED_BYTES_CAP + 1
      )
    );
  }
  const info = yield* fs.stat(absolute).pipe(Effect.option);
  return O.some(
    O.getOrElse(
      O.flatMap(info, (value) => O.some(Number(value.size))),
      () => PRESERVED_BYTES_CAP + 1
    )
  );
});

// Copy every gitignored file a checkout holds, and its ignored secret or local-config directories,
// beside its bundle: `git status` never reports them and no bundle carries them. Ignored
// directories are listed collapsed (`--directory`), so `node_modules/` stays one regenerable entry.
const preserveLocalFiles = Effect.fnUntraced(function* (layout: DrainLayout, stateDirectory: string, runId: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const listing = yield* gitStdout(layout.real, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--directory",
    "-z",
  ]);
  if (O.isNone(listing)) return Result.fail("git ls-files could not list the ignored files");
  const entries = A.filter(Str.split("\u0000")(listing.value), Str.isNonEmpty);
  const sized = yield* Effect.forEach(entries, (entry) =>
    Effect.map(
      preservedBytes(layout.real, entry),
      O.map((bytes) => [entry, bytes] as const)
    )
  );
  const present = A.getSomes(sized);
  if (A.isReadonlyArrayEmpty(present)) return Result.succeed(O.none<string>());
  const total = A.reduce(present, 0, (sum, [, bytes]) => sum + bytes);
  if (total > PRESERVED_BYTES_CAP) {
    return Result.fail(
      `ignored local files total ${total} bytes, above the ${PRESERVED_BYTES_CAP}-byte preservation cap: ${A.join(
        A.map(present, ([entry]) => entry),
        ", "
      )}`
    );
  }
  const directory = path.join(stateDirectory, DRAIN_BUNDLES, `${bundleFileName(layout.real, runId)}.local`);
  const copied = yield* Effect.forEach(present, ([entry]) => {
    const relative = Str.replace(/\/$/u, "")(entry);
    const target = path.join(directory, relative);
    return fs
      .makeDirectory(path.dirname(target), { recursive: true })
      .pipe(Effect.andThen(fs.copy(path.join(layout.real, relative), target)), Effect.option);
  });
  return A.every(copied, O.isSome)
    ? Result.succeed(O.some(directory))
    : Result.fail(`could not copy the ignored local files to ${directory}`);
});

// After bundling and copying, the checkout must be exactly what was preserved: same HEAD, still
// clean and dormant, and every local-only commit reachable from a bundled head (or a remote ref).
const settledAfterPreservation = Effect.fnUntraced(function* (
  context: ResidueDrainContext,
  before: DrainLayout,
  heads: ReadonlyArray<string>
) {
  const layout = yield* drainLayout(before.checkout);
  if (O.isNone(layout)) return O.some("git layout unreadable");
  const sameHead = O.exists(layout.value.head, (head) =>
    O.exists(before.head, (recorded) => Str.Equivalence(head, recorded))
  );
  if (!sameHead) return O.some("HEAD moved while its work was being preserved");
  const clean = yield* cleanTreeCheck(layout.value);
  if (clean.outcome !== "pass") return O.some(`tree changed while its work was being preserved: ${clean.detail}`);
  const liveness = yield* livenessCheck(context, layout.value);
  if (liveness.outcome !== "pass") return O.some(`no longer dormant: ${liveness.detail}`);
  const spec = yield* localOnlySpec(layout.value);
  if (O.isNone(spec)) return O.some("git stash list failed");
  const residual = yield* countRevisions(layout.value, [
    ...spec.value.include,
    ...spec.value.stashes,
    "--not",
    ...spec.value.exclude,
    ...heads,
  ]);
  return O.exists(residual, (count) => N.Equivalence(count, 0))
    ? O.none()
    : O.some("local-only commits appeared that the bundle does not hold");
});

/**
 * Re-check one eligible checkout immediately before removal and preserve its
 * local-only work.
 *
 * **Details**
 *
 * Re-runs every drain check with the apply-time facts. The checkout stays
 * only if the predicate still holds at the HEAD the grace window recorded;
 * otherwise the result fails with `drain-blocked` and the fresh assessment.
 * Local-only work is then written to a bundle under the fleet state
 * directory's `drain-bundles/`, which must pass `git bundle verify` and cover
 * every local-only commit, and every gitignored file plus any ignored
 * `secrets/`, `.secrets/` or `*.local` directory is copied to `<bundle>.local/`
 * (other ignored directories are regenerable; more than 512 MiB refuses); either failure
 * fails the result with `drain-bundle-failed`. Last, the checkout is read again:
 * a moved HEAD, a changed tree, a live process or a local-only commit no bundle
 * holds fails it with `drain-blocked`.
 *
 * **Example** (Build the preparation effect)
 *
 * ```ts
 * import { prepareResidueDrainRemoval } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof prepareResidueDrainRemoval) // "function"
 * ```
 *
 * @param context - The apply-time drain context.
 * @param assessed - The discovery-time assessment that found the checkout eligible.
 * @param runId - The reap run id, which names the bundle.
 * @returns The fresh assessment carrying any bundle, or the refusal reason with the fresh assessment.
 * @category workflows
 * @since 0.0.0
 */
export const prepareResidueDrainRemoval = Effect.fnUntraced(function* (
  context: ResidueDrainContext,
  assessed: ResidueDrainAssessment,
  runId: string
): Effect.fn.Return<
  Result.Result<
    ResidueDrainAssessment,
    {
      readonly reason: "drain-blocked" | "drain-bundle-failed";
      readonly assessment: ResidueDrainAssessment;
      readonly detail: string;
    }
  >,
  never,
  DrainRequirements | ResidueDrainProbe
> {
  const layout = yield* drainLayout(assessed.checkout);
  if (O.isNone(layout)) {
    return Result.fail({ reason: "drain-blocked" as const, assessment: assessed, detail: "git layout unreadable" });
  }
  const observation = yield* observe(context, layout.value);
  const recordedHead = O.fromNullishOr(assessed.head);
  const sameHead = O.exists(layout.value.head, (head) =>
    O.exists(recordedHead, (recorded) => Str.Equivalence(head, recorded))
  );
  const fresh = assessmentOf(context, observation, registryRowFor(context.facts, assessed.checkout));
  if (!fresh.eligible || !sameHead) {
    return Result.fail({
      reason: "drain-blocked" as const,
      assessment: fresh,
      detail: sameHead ? "the drain predicate no longer holds" : "HEAD moved since the grace window started",
    });
  }
  const needsBundle = A.some(fresh.checks, (result) => result.outcome === "bundle-required");
  const bundled = needsBundle
    ? yield* Effect.map(bundleLocalOnlyWork(layout.value, context.facts.stateDirectory, runId), Result.map(O.some))
    : Result.succeed(O.none<BundleWritten>());
  if (Result.isFailure(bundled)) {
    return Result.fail({ reason: "drain-bundle-failed" as const, assessment: fresh, detail: bundled.failure });
  }
  const preserved = yield* preserveLocalFiles(layout.value, context.facts.stateDirectory, runId);
  if (Result.isFailure(preserved)) {
    return Result.fail({ reason: "drain-bundle-failed" as const, assessment: fresh, detail: preserved.failure });
  }
  const kept = ResidueDrainAssessment.make({
    ...fresh,
    bundle: O.getOrNull(O.map(bundled.success, (bundle) => bundle.file)),
    preserved: O.getOrNull(preserved.success),
  });
  const heads = O.getOrElse(
    O.map(bundled.success, (bundle) => bundle.heads),
    A.empty<string>
  );
  const unsettled = yield* settledAfterPreservation(context, layout.value, heads);
  return O.match(unsettled, {
    onNone: () => Result.succeed(kept),
    onSome: (detail) => Result.fail({ reason: "drain-blocked" as const, assessment: kept, detail }),
  });
});

/**
 * Journal one applied drain decision and, for a removal, retire its registry row.
 *
 * **Details**
 *
 * Appends one {@link ResidueDrainJournalEntry} line to `drain-journal.jsonl`
 * under the fleet state directory. A removed checkout's registry row becomes
 * `retired` with its grace state cleared. A journal write that fails is
 * returned as a warning; the removal it describes has already happened.
 *
 * **Example** (Build the record effect)
 *
 * ```ts
 * import { recordResidueDrainOutcome } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof recordResidueDrainOutcome) // "function"
 * ```
 *
 * @param input - The context, invoking checkout, run id, assessment, outcome, refusal reason and reclaimed bytes.
 * @returns Warnings for any journal or registry write that failed.
 * @category workflows
 * @since 0.0.0
 */
export const recordResidueDrainOutcome = Effect.fnUntraced(function* (input: {
  readonly context: ResidueDrainContext;
  readonly repoRoot: string;
  readonly runId: string;
  readonly assessment: ResidueDrainAssessment;
  readonly outcome: ResidueDrainJournalOutcome;
  readonly reason: O.Option<string>;
  readonly bytes: O.Option<number>;
}): Effect.fn.Return<ReadonlyArray<string>, never, DrainRequirements | ResidueDrainProbe> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const probe = yield* ResidueDrainProbe;
  const entry = ResidueDrainJournalEntry.make({
    runId: input.runId,
    recordedAt: DateTime.formatIso(DateTime.makeUnsafe(input.context.nowMillis)),
    checkout: input.assessment.checkout,
    kind: input.assessment.kind,
    outcome: input.outcome,
    reason: O.getOrNull(input.reason),
    checks: input.assessment.checks,
    bundle: input.assessment.bundle,
    preserved: input.assessment.preserved,
    bytes: O.getOrNull(input.bytes),
  });
  const file = path.join(input.context.facts.stateDirectory, "drain-journal.jsonl");
  const journaled = yield* encodeJournalEntry(entry).pipe(
    Effect.flatMap((line) =>
      fs
        .makeDirectory(input.context.facts.stateDirectory, { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(file, `${line}\n`, { flag: "a" })))
    ),
    Effect.option
  );
  const retired =
    input.outcome === "removed"
      ? yield* probe.updateRegistry(input.repoRoot, (rows) =>
          A.map(rows, (row) =>
            Str.Equivalence(row.checkout, input.assessment.checkout)
              ? FleetRegistryRow.make({
                  ...row,
                  drainStatus: FleetDrainStatus.Enum.retired,
                  drainingSince: null,
                  drainingHead: null,
                })
              : row
          )
        )
      : O.some(A.empty<FleetRegistryRow>());
  return A.getSomes([
    O.isNone(journaled) ? O.some(`Failed to append ${input.assessment.checkout} to ${file}.`) : O.none(),
    O.isNone(retired) ? O.some(`Failed to retire ${input.assessment.checkout} in the fleet registry.`) : O.none(),
  ]);
});

/**
 * Measure the apparent bytes held by the registered legacy clones.
 *
 * **Details**
 *
 * Reads registry rows with seat role `legacy` and drain status other than
 * `retired`, and sums `du --apparent-size` over each one that still exists.
 * A clone `du` could not measure is listed in `unmeasured`.
 *
 * **Example** (Build the measurement effect)
 *
 * ```ts
 * import { measureLegacyCloneDisk } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(measureLegacyCloneDisk([]))) // true
 * ```
 *
 * @param rows - Fleet registry rows.
 * @returns The legacy clone count, their summed bytes and any unmeasured clones.
 * @category utilities
 * @since 0.0.0
 */
export const measureLegacyCloneDisk = Effect.fnUntraced(function* (
  rows: ReadonlyArray<FleetRegistryRow>
): Effect.fn.Return<ResidueDrainDisk, never, DrainRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const clones = A.filter(
    rows,
    (row) => FleetSeatRole.is.legacy(row.seatRole) && !FleetDrainStatus.is.retired(row.drainStatus)
  );
  const measured = yield* Effect.forEach(
    clones,
    Effect.fnUntraced(function* (row) {
      const exists = yield* fs.exists(row.checkout).pipe(Effect.orElseSucceed(() => false));
      if (!exists) return O.none<readonly [string, O.Option<number>]>();
      const capture = yield* runRepoCommandCaptureRaw(
        "du",
        ["-B1", "--apparent-size", "-s", "--", row.checkout],
        path.dirname(row.checkout)
      ).pipe(Effect.option);
      const bytes = O.flatMap(capture, (result) =>
        N.Equivalence(result.exitCode, 0)
          ? O.flatMap(A.head(Str.split("\t")(Str.trim(result.output))), N.parse)
          : O.none()
      );
      return O.some([row.checkout, bytes] as const);
    }),
    { concurrency: 2 }
  );
  const present = A.getSomes(measured);
  return ResidueDrainDisk.make({
    legacyClones: A.length(present),
    bytes: A.reduce(present, 0, (total, [, bytes]) => total + O.getOrElse(bytes, () => 0)),
    unmeasured: A.map(
      A.filter(present, ([, bytes]) => O.isNone(bytes)),
      ([checkout]) => checkout
    ),
  });
});
