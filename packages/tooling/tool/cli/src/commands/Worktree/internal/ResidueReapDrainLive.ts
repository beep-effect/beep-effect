/**
 * Live drain probe for residue reap: the fleet registry and roots, GitHub's
 * open pull requests, systemd user units, the session ledger, and the fleet
 * mirror's liveness readings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PullRequest } from "@beep/github/PullRequest";
import { PageOptions } from "@beep/github/Rest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { runRepoCommandCaptureRaw } from "../../../internal/repo-run/RepoRun.executor.ts";
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
import { ResidueDrainProbe } from "./ResidueReapDrain.ts";
import type { Git } from "@beep/git/Git";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
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
const openPullRequestHeads = (repoRoot: string) =>
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

// The `checkout=` of every active `beep-proof-*` unit; `None` when systemd cannot answer.
const proofUnitCheckouts = (repoRoot: string) =>
  runRepoCommandCaptureRaw(
    "systemctl",
    [
      "--user",
      "list-units",
      "beep-proof-*",
      "--all",
      "--state=active,activating,deactivating,reloading",
      "--no-legend",
      "--plain",
      "--no-pager",
    ],
    repoRoot
  ).pipe(
    Effect.option,
    Effect.map(
      O.flatMap((capture) =>
        N.Equivalence(capture.exitCode, 0)
          ? O.some(
              A.getSomes(
                A.map(Str.split("\n")(capture.output), (line) =>
                  O.flatMap(Str.match(/checkout=(\S+)/u)(line), A.get(1))
                )
              )
            )
          : O.none()
      )
    )
  );

const WORKING_DIRECTORY_LINE = /^\s*WorkingDirectory\s*=\s*-?(.+?)\s*$/u;

// Every `WorkingDirectory=` of the user's systemd units and drop-ins, `%h` and `~` expanded.
const timerDirectories = Effect.fnUntraced(function* (home: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const unitDir = path.join(home, ".config", "systemd", "user");
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

const liveFacts = Effect.fnUntraced(function* (repoRoot: string) {
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
    onSome: (dir) => timerDirectories(dir).pipe(Effect.option),
  });
  const sessions = yield* ledger.list(repository).pipe(Effect.option);
  const heads = yield* openPullRequestHeads(repoRoot);
  const proofs = yield* proofUnitCheckouts(repoRoot);
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
 * @returns The probe service, capturing the services it reads.
 * @category constructors
 * @since 0.0.0
 */
export const makeResidueDrainProbe = Effect.fnUntraced(function* (): Effect.fn.Return<
  ResidueDrainProbeShape,
  never,
  LiveRequirements
> {
  const context = yield* Effect.context<LiveRequirements>();
  return ResidueDrainProbe.of({
    facts: Effect.fn("ResidueDrainProbe.facts")((repoRoot: string) =>
      liveFacts(repoRoot).pipe(Effect.option, Effect.provideContext(context))
    ),
    livenessReadings: Effect.fn("ResidueDrainProbe.livenessReadings")((checkout: string, nowMillis: number) =>
      homeDirectory.pipe(
        Effect.flatMap((home) => checkoutLivenessReadings(checkout, home, nowMillis)),
        Effect.map(ResidueDrainLivenessReadings.make),
        Effect.provideContext(context)
      )
    ),
    updateRegistry: Effect.fn("ResidueDrainProbe.updateRegistry")(
      (repoRoot: string, transform: Parameters<ResidueDrainProbeShape["updateRegistry"]>[1]) =>
        liveUpdateRegistry(repoRoot, transform).pipe(Effect.option, Effect.provideContext(context))
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
