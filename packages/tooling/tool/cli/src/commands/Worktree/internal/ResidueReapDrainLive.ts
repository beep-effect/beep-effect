/**
 * Live drain probe for residue reap: the fleet registry and roots, GitHub's
 * open pull requests, systemd user units, the session ledger, and the fleet
 * mirror's liveness readings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { PullRequest } from "@beep/github/PullRequest";
import { PageOptions } from "@beep/github/Rest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";
import { openSessionRows } from "../../Session/Session.schemas.ts";
import { layerSessionLedgerLive, SessionLedger } from "../../Session/SessionLedger.service.ts";
import { detectPrRepository } from "../../Yeet/internal/ProvenanceFooter.ts";
import { checkoutLivenessReadings, FleetMirrorService, FleetMirrorServiceLive } from "../Fleet.service.ts";
import { FleetScanOptions } from "../Worktree.schemas.ts";
import { layerWorktreeGithub } from "../Worktree.service.ts";
import { FleetRegistryDocument } from "./FleetRegistry.schemas.ts";
import { FleetRegistryStore, FleetRegistryStoreLive } from "./FleetRegistry.ts";
import { fleetStateDirectory } from "./FleetRoots.ts";
import { ResidueDrainFleetFacts, ResidueDrainLivenessReadings } from "./ResidueReapDrain.schemas.ts";
import { ResidueDrainProbe, successfulStdout } from "./ResidueReapDrain.ts";
import type * as Digest from "effect/crypto/Digest";
import type { ResidueDrainProbeShape } from "./ResidueReapDrain.ts";

type LiveRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | Git
  | FleetMirrorService
  | FleetRegistryStore
  | SessionLedger;

const homeDirectory = Config.option(Config.String("HOME")).pipe(
  Effect.map(O.filter(Str.isNonEmpty)),
  Effect.orElseSucceed(() => O.none<string>())
);

// Head branch names of every open pull request; `None` when GitHub cannot answer.
const liveOpenPullRequestHeads = (repoRoot: string) =>
  Layer.build(layerWorktreeGithub(repoRoot)).pipe(
    Effect.flatMap((context) =>
      Effect.provideContext(
        PullRequest.use((pulls) => pulls.list({ state: "open", page: PageOptions.all })),
        context
      )
    ),
    Effect.scoped,
    Effect.map(A.map((pull) => pull.head)),
    Effect.option
  );

// `systemctl --user list-units` output for the active `beep-proof-*` units; `None` when systemd cannot answer.
const liveProofUnitListing = (repoRoot: string) =>
  successfulStdout({
    command: "systemctl",
    args: [
      "--user",
      "list-units",
      "beep-proof-*",
      "--all",
      "--state=active,activating,deactivating,reloading",
      "--no-legend",
      "--plain",
      "--no-pager",
    ],
    cwd: repoRoot,
  });

// The `checkout=` each proof unit's description names.
const proofUnitCheckoutsOf = (listing: string): ReadonlyArray<string> =>
  A.getSomes(A.map(Str.split("\n")(listing), (line) => O.flatMap(Str.match(/checkout=(\S+)/u)(line), A.get(1))));

type OpenPullRequestHeads = (
  repoRoot: string
) => Effect.Effect<O.Option<ReadonlyArray<string>>, never, ChildProcessSpawner.ChildProcessSpawner>;
type UnitPaths = (
  home: string
) => Effect.Effect<
  O.Option<ReadonlyArray<string>>,
  never,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
>;
type ProofUnitListing = (
  repoRoot: string
) => Effect.Effect<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom>;

const WORKING_DIRECTORY_LINE = /^\s*WorkingDirectory\s*=\s*-?(.+?)\s*$/u;

// systemd's user-unit load paths, one per line; `None` when systemd cannot answer.
const liveUnitPaths = (home: string) =>
  successfulStdout({ command: "systemd-analyze", args: ["--user", "unit-paths"], cwd: home }).pipe(
    Effect.map(O.map((text) => A.filter(A.map(Str.split("\n")(text), Str.trim), Str.isNonEmpty)))
  );

// Every `WorkingDirectory=` of the user's systemd units and drop-ins across every load path,
// `%h` and `~` expanded.
const timerDirectories = Effect.fnUntraced(function* (home: string, unitPaths: ReadonlyArray<string>) {
  const perPath = yield* Effect.forEach(unitPaths, (unitDir) => unitDirectoryWorkingDirectories(home, unitDir));
  return A.dedupe(A.flatten(perPath));
});

const unitDirectoryWorkingDirectories = Effect.fnUntraced(function* (home: string, unitDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!(yield* fs.exists(unitDir))) return A.empty<string>();
  const entries = yield* fs.readDirectory(unitDir);
  const units = A.filter(entries, Str.endsWith(".service"));
  const dropIns = yield* Effect.forEach(
    A.filter(entries, Str.endsWith(".service.d")),
    Effect.fnUntraced(function* (dir) {
      const confs = yield* fs.readDirectory(path.join(unitDir, dir));
      return A.map(A.filter(confs, Str.endsWith(".conf")), (conf) => path.join(dir, conf));
    })
  );
  // A dangling unit link names no unit systemd can load; a masked unit links to /dev/null and reads empty.
  const files = yield* Effect.filter(A.appendAll(units, A.flatten(dropIns)), (file) =>
    fs.exists(path.join(unitDir, file))
  );
  const texts = yield* Effect.forEach(files, (file) => fs.readFileString(path.join(unitDir, file)));
  const expand = (dir: string) =>
    Str.startsWith("~/")(dir) ? path.join(home, Str.slice(2)(dir)) : Str.replaceAll("%h", home)(dir);
  return A.dedupe(
    A.getSomes(
      A.flatMap(texts, (text) =>
        A.map(Str.split("\n")(text), (line) =>
          O.map(O.flatMap(Str.match(WORKING_DIRECTORY_LINE)(line), A.get(1)), expand)
        )
      )
    )
  );
});

const liveFacts = Effect.fnUntraced(function* (
  repoRoot: string,
  openPullRequestHeads: OpenPullRequestHeads,
  proofUnitListing: ProofUnitListing,
  unitPaths: UnitPaths
) {
  const mirror = yield* FleetMirrorService;
  const store = yield* FleetRegistryStore;
  const ledger = yield* SessionLedger;
  const repository = yield* detectPrRepository(repoRoot);
  const roots = yield* mirror.roots(FleetScanOptions.make({ startFrom: repoRoot }));
  const registry = yield* store.read(repository);
  const stateDirectory = yield* fleetStateDirectory(repository);
  const home = yield* homeDirectory;
  const timers = yield* O.match(home, {
    onNone: () => Effect.succeedNone,
    onSome: (dir) =>
      Effect.flatMap(unitPaths(dir), (paths) =>
        O.match(paths, {
          onNone: () => Effect.succeedNone,
          onSome: (list) => timerDirectories(dir, list).pipe(Effect.option),
        })
      ),
  });
  const sessions = yield* ledger.list(repository).pipe(Effect.option);
  const heads = yield* openPullRequestHeads(repoRoot);
  const proofs = yield* Effect.map(proofUnitListing(repoRoot), O.map(proofUnitCheckoutsOf));
  return ResidueDrainFleetFacts.make({
    roots,
    registry: registry.rows,
    openPullRequestHeads: O.getOrNull(heads),
    proofUnitCheckouts: O.getOrNull(proofs),
    timerDirectories: O.getOrNull(timers),
    openSessionCheckouts: O.getOrNull(O.map(sessions, (rows) => A.map(openSessionRows(rows), (row) => row.checkout))),
    stateDirectory,
  });
});

const liveUpdateRegistry = Effect.fnUntraced(function* (
  repoRoot: string,
  transform: Parameters<ResidueDrainProbeShape["updateRegistry"]>[1]
) {
  const store = yield* FleetRegistryStore;
  const repository = yield* detectPrRepository(repoRoot);
  const [document] = yield* store.update(repository, (current) => {
    const next = FleetRegistryDocument.make({ schemaVersion: current.schemaVersion, rows: transform(current.rows) });
    return [next, undefined] as const;
  });
  return document.rows;
});

/**
 * Build the live drain probe.
 *
 * **Details**
 *
 * `facts` reads the fleet registry and roots, the open pull request heads
 * (GitHub REST, every page), active `beep-proof-*` units (`systemctl --user`),
 * the `WorkingDirectory=` of every systemd user unit and drop-in, and the open
 * session-ledger rows. A fact that cannot be read is `null`, which refuses
 * every checkout its check reads; an unreadable registry, root list,
 * repository or state directory answers `None`. `livenessReadings` reuses the
 * fleet mirror's transcript, tree-mtime and session-registry readings.
 * `openPullRequestHeads`, `proofUnitListing` and `unitPaths` default to GitHub
 * REST, `systemctl --user list-units` and `systemd-analyze --user unit-paths`
 * (every user-unit load path, not only `~/.config/systemd/user`); tests
 * substitute fixture sources. Unreadable load paths refuse every checkout. The probe
 * runs under the caller's `ConfigProvider`, which supplies `HOME` and the
 * fleet state root.
 *
 * **Example** (Build the probe effect)
 *
 * ```ts
 * import { makeResidueDrainProbe } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeResidueDrainProbe())) // true
 * ```
 *
 * @param openPullRequestHeads - Source of every open pull request's head branch name.
 * @param proofUnitListing - Source of the `systemctl --user list-units` text for active proof units.
 * @param unitPaths - Source of systemd's user-unit load paths for a home directory.
 * @returns The probe service, capturing the services it reads.
 * @category constructors
 * @since 0.0.0
 */
export const makeResidueDrainProbe = Effect.fnUntraced(function* (
  openPullRequestHeads: OpenPullRequestHeads = liveOpenPullRequestHeads,
  proofUnitListing: ProofUnitListing = liveProofUnitListing,
  unitPaths: UnitPaths = liveUnitPaths
): Effect.fn.Return<ResidueDrainProbeShape, never, LiveRequirements> {
  // Only the services the probe reads: the caller's ConfigProvider (HOME, the fleet state root) stays in effect.
  const runtime = yield* Effect.context<LiveRequirements>();
  const context = Context.pick(
    FileSystem.FileSystem,
    Path.Path,
    SecureRandom.SecureRandom,
    ChildProcessSpawner.ChildProcessSpawner,
    Git,
    FleetMirrorService,
    FleetRegistryStore,
    SessionLedger
  )(runtime);
  return ResidueDrainProbe.of({
    facts: Effect.fn("ResidueDrainProbe.facts")((repoRoot: string) =>
      liveFacts(repoRoot, openPullRequestHeads, proofUnitListing, unitPaths).pipe(
        Effect.option,
        Effect.provide(context)
      )
    ),
    livenessReadings: Effect.fn("ResidueDrainProbe.livenessReadings")((checkout: string, nowMillis: number) =>
      homeDirectory.pipe(
        Effect.flatMap((home) => checkoutLivenessReadings(checkout, home, nowMillis)),
        Effect.map(ResidueDrainLivenessReadings.make),
        Effect.provide(context)
      )
    ),
    updateRegistry: Effect.fn("ResidueDrainProbe.updateRegistry")(
      (repoRoot: string, transform: Parameters<ResidueDrainProbeShape["updateRegistry"]>[1]) =>
        liveUpdateRegistry(repoRoot, transform).pipe(Effect.option, Effect.provide(context))
    ),
  });
});

/**
 * Live drain probe layer over the fleet registry, the fleet mirror, GitHub,
 * systemd and the session ledger.
 *
 * **Details**
 *
 * The layer fails with the session ledger's `ConfigError` when the ledger
 * location cannot be resolved, the same configuration residue reap already
 * needs for `HOME`.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { ResidueDrainProbeLive } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof ResidueDrainProbeLive) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ResidueDrainProbeLive: Layer.Layer<
  ResidueDrainProbe,
  Config.ConfigError,
  | Digest.Digest
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | Git
> = Layer.effect(ResidueDrainProbe, makeResidueDrainProbe()).pipe(
  Layer.provide(Layer.mergeAll(FleetMirrorServiceLive, FleetRegistryStoreLive, layerSessionLedgerLive))
);
