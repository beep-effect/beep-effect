/**
 * Journaled, exchange-qualified publication for the skills projection writer.
 *
 * **Details**
 *
 * `beep skills update` replaces files and skill directories through this
 * writer. It reuses the `beep models` protocol rather than a copy of it: the
 * {@link ModelsAtomicExchange} capability (qualified per target filesystem),
 * the {@link ModelsPublicationState} state machine, the shared ledger
 * primitives in `internal/publication/PublicationLedger.ts`, and the same
 * bytes-decide recovery rule. Backups and journals live under
 * `<root>/.beep/skills-backups`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { asArrayBufferView, concatBytes } from "../../internal/cli/Bytes.ts";
import {
  dropStalePublicationPartials,
  makePublicationLedger,
  publicationSuffix,
  publicationTerminalState,
  readPublicationRecord,
} from "../../internal/publication/PublicationLedger.ts";
import { modelsAtomicExchangeOrLive } from "../Models/Models.apply.service.ts";
import { ModelsPublicationState, modelsExchangeIdentityKey } from "../Models/Models.exchange.schemas.ts";
import { SkillPublicationError } from "./Skills.errors.ts";
import {
  SkillContentDigest,
  SkillPublicationJournal,
  SkillRecoveryReport,
  SkillRecoveryResult,
  SkillTrackedPublication,
  SkillTreeEntry,
} from "./SkillsPublication.schemas.ts";
import type {
  ModelsPublicationStep,
  ModelsRecoveryOutcome,
  ModelsRecoveryRefusal,
} from "../Models/Models.exchange.schemas.ts";
import type {
  SkillPublicationFile,
  SkillPublicationKind,
  SkillPublicationRefusal,
  SkillRecoveryScope,
} from "./SkillsPublication.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/SkillsPublication.service");

const textEncoder = new TextEncoder();
const encodeJournal = S.encodeEffect(S.fromJsonString(SkillPublicationJournal));
const decodeJournal = S.decodeEffect(S.fromJsonString(SkillPublicationJournal));
const isTracked = S.is(SkillTrackedPublication);
const pendingState = ModelsPublicationState.isAnyOf([
  "intent",
  "backed-up",
  "staged",
  "exchanged",
  "verified",
  "recovering",
]);
const isRecoveryState = ModelsPublicationState.isAnyOf(["recovering", "recovered", "refused", "abandoned"]);
// Steps recorded before a publication moves its stage into place.
const premoveStep = (step: ModelsPublicationStep) => A.contains(["intent", "backed-up", "staged"], step);
const fromStep = (state: ModelsPublicationState): ModelsPublicationStep =>
  isRecoveryState(state) ? state.from : state._tag;

// Directory publications write every directory 0755 and every file 0644, so
// the staged tree hash is fixed by the planned files before anything is written.
const plannedDirectoryMode = 0o755;
const plannedFileMode = 0o644;
// Linux reports 0777 for every symlink; its permission bits are never used.
const symlinkMode = 0o777;

// What recovery finds on one recorded path: nothing, an entry it never
// changes, or a file or directory and its fingerprint.
const Observation = S.TaggedUnion({
  absent: {},
  foreign: { detail: S.String },
  present: { digest: SkillContentDigest },
});
type Observation = typeof Observation.Type;

type SkillDirectoryDigest = Extract<SkillContentDigest, { readonly _tag: "directory" }>;

const failure = (message: string, reason: SkillPublicationRefusal | undefined, target: string) =>
  SkillPublicationError.make({
    message,
    ...(reason === undefined ? {} : { reason }),
    target,
  });

const sameDigest = (left: SkillContentDigest, right: SkillContentDigest) =>
  left._tag === right._tag && left.hash === right.hash;

const entryKey = (entry: SkillTreeEntry) => `${entry.kind}\0${entry.mode}\0${entry.digest}`;

/**
 * Relative paths at which two tree entry lists differ, sorted.
 *
 * **Details**
 *
 * A path differs when it is present in only one list, or present in both with
 * a different kind, mode or digest. Recovery names these paths when a
 * directory matches neither recorded tree.
 *
 * **Example** (Compare two trees)
 *
 * ```ts
 * import { skillTreeDifferences } from "@beep/repo-cli/commands/Skills/SkillsPublication.service"
 * import { SkillTreeEntry } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * const root = SkillTreeEntry.make({ path: ".", kind: "directory", mode: 0o755, digest: "" })
 * const left = [root, SkillTreeEntry.make({ path: "SKILL.md", kind: "file", mode: 0o644, digest: "aa" })]
 * const right = [root, SkillTreeEntry.make({ path: "SKILL.md", kind: "file", mode: 0o644, digest: "bb" })]
 * console.log(skillTreeDifferences(left, right)) // ["SKILL.md"]
 * ```
 *
 * @param observed - The entries found on disk.
 * @param expected - The entries a recorded fingerprint lists.
 * @returns The sorted paths whose entries differ.
 * @category utilities
 * @since 0.0.0
 */
export const skillTreeDifferences: {
  (expected: ReadonlyArray<SkillTreeEntry>): (observed: ReadonlyArray<SkillTreeEntry>) => ReadonlyArray<string>;
  (observed: ReadonlyArray<SkillTreeEntry>, expected: ReadonlyArray<SkillTreeEntry>): ReadonlyArray<string>;
} = dual(2, (observed: ReadonlyArray<SkillTreeEntry>, expected: ReadonlyArray<SkillTreeEntry>) => {
  const index = (entries: ReadonlyArray<SkillTreeEntry>) =>
    HashMap.fromIterable(A.map(entries, (entry) => [entry.path, entryKey(entry)] as const));
  const left = index(observed);
  const right = index(expected);
  const paths = A.sort(A.dedupe(A.map(A.appendAll(observed, expected), (entry) => entry.path)), Order.String);
  return A.filter(
    paths,
    (entry) => O.getOrElse(HashMap.get(left, entry), () => "") !== O.getOrElse(HashMap.get(right, entry), () => "")
  );
});

const treeLine = (entry: SkillTreeEntry) =>
  textEncoder.encode(`${entry.kind}\0${entry.mode.toString(8)}\0${entry.path}\0${entry.digest}\n`);

// The planned entries of a directory publication: the root, every parent
// directory of a planned file, and the files themselves.
const plannedEntries = (files: ReadonlyArray<SkillPublicationFile>, digests: ReadonlyArray<string>) => {
  const directories = A.dedupe(
    A.flatMap(files, (file) => {
      const segments = Str.split(file.path, "/");
      return A.map(A.dropRight(segments, 1), (_, depth) => A.join(A.take(segments, depth + 1), "/"));
    })
  );
  return A.appendAll(
    A.map(A.prepend(directories, "."), (path) =>
      SkillTreeEntry.make({ path, kind: "directory", mode: plannedDirectoryMode, digest: "" })
    ),
    A.zipWith(files, digests, (file, digest) =>
      SkillTreeEntry.make({ path: file.path, kind: "file", mode: plannedFileMode, digest })
    )
  );
};

// Fingerprints of files and trees, shared by the writer and its tree-hash utility.
const makeSkillFingerprints = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;
  const io = (message: string, target?: string) => SkillPublicationError.mapError(message, target);
  const sha256 = (bytes: Uint8Array) =>
    crypto
      .digest("SHA-256", asArrayBufferView(bytes))
      .pipe(Effect.map(Hex.encode), io("Cannot fingerprint skill content."));

  const treeDigest = Effect.fnUntraced(function* (
    entries: ReadonlyArray<SkillTreeEntry>
  ): Effect.fn.Return<SkillDirectoryDigest, SkillPublicationError> {
    const sorted = A.sort(
      entries,
      Order.mapInput(Order.String, (entry: SkillTreeEntry) => entry.path)
    );
    return SkillContentDigest.cases.directory.make({
      hash: yield* sha256(concatBytes(A.map(sorted, treeLine))),
      entries: sorted,
    });
  });

  // Walk a tree without following symlinks. None when it holds an entry that
  // is neither a directory, a regular file nor a symlink.
  const walk = Effect.fnUntraced(function* (root: string) {
    const entries: Array<SkillTreeEntry> = [];
    // One entry: a symlink or file is recorded whole; a directory is recorded
    // and its children listed. None for any other kind of entry.
    const describe = Effect.fnUntraced(function* (relative: string, absolute: string) {
      const link = yield* fs.readLink(absolute).pipe(Effect.option);
      if (O.isSome(link))
        return O.some({
          entry: SkillTreeEntry.make({
            path: relative,
            kind: "symlink",
            mode: symlinkMode,
            digest: yield* sha256(textEncoder.encode(link.value)),
          }),
          children: A.empty<string>(),
        });
      const info = yield* fs.stat(absolute).pipe(io("Cannot inspect a skill tree entry.", absolute));
      const mode = info.mode & 0o7777;
      if (info.type === "File") {
        const bytes = yield* fs.readFile(absolute).pipe(io("Cannot read a skill tree file.", absolute));
        const entry = SkillTreeEntry.make({ path: relative, kind: "file", mode, digest: yield* sha256(bytes) });
        return O.some({ entry, children: A.empty<string>() });
      }
      if (info.type !== "Directory") return O.none();
      const children = yield* fs.readDirectory(absolute).pipe(io("Cannot list a skill tree directory.", absolute));
      const entry = SkillTreeEntry.make({ path: relative, kind: "directory", mode, digest: "" });
      return O.some({ entry, children: A.sort(children, Order.String) });
    });
    const visit = Effect.fnUntraced(function* (relative: string): Effect.fn.Return<boolean, SkillPublicationError> {
      const described = yield* describe(relative, relative === "." ? root : path.join(root, relative));
      if (O.isNone(described)) return false;
      entries.push(described.value.entry);
      for (const child of described.value.children) {
        if (!(yield* visit(relative === "." ? child : `${relative}/${child}`))) return false;
      }
      return true;
    });
    return (yield* visit(".")) ? O.some(yield* treeDigest(entries)) : O.none<SkillDirectoryDigest>();
  });

  const observe = Effect.fnUntraced(function* (entry: string, kind: SkillPublicationKind) {
    if (O.isSome(yield* fs.readLink(entry).pipe(Effect.option)))
      return Observation.cases.foreign.make({ detail: "is a symbolic link" });
    const info = yield* fs.stat(entry).pipe(Effect.option);
    if (O.isNone(info)) return Observation.cases.absent.make({});
    if (kind === "file") {
      if (info.value.type !== "File") return Observation.cases.foreign.make({ detail: "is not a regular file" });
      const bytes = yield* fs.readFile(entry).pipe(io("Cannot read a skill projection file.", entry));
      return Observation.cases.present.make({
        digest: SkillContentDigest.cases.file.make({ hash: yield* sha256(bytes) }),
      });
    }
    if (info.value.type !== "Directory") return Observation.cases.foreign.make({ detail: "is not a directory" });
    return O.match(yield* walk(entry), {
      onNone: () => Observation.cases.foreign.make({ detail: "holds an entry that is not a file, directory or link" }),
      onSome: (digest) => Observation.cases.present.make({ digest }),
    });
  });

  return { observe, sha256, treeDigest, walk };
});

/**
 * Publishes skill projection files and directories and recovers interrupted ones.
 *
 * **Details**
 *
 * `publishFile` and `publishDirectory` take the repository root and a
 * canonical target inside it. A target that exists is replaced only through a
 * qualified atomic exchange; a target that does not exist yet is created with
 * an exclusive link (a file) or a rename (a directory), so neither path ever
 * overwrites another writer's entry. `recover` reconciles the journals under
 * `<root>/.beep/skills-backups/journals`.
 *
 * **Example** (Describe the operations)
 *
 * ```ts
 * import type { SkillPublisherShape } from "@beep/repo-cli/commands/Skills/SkillsPublication.service"
 *
 * const operations: ReadonlyArray<keyof SkillPublisherShape> = ["publishFile", "publishDirectory", "recover"]
 * console.log(operations.length) // 3
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SkillPublisherShape {
  readonly publishDirectory: (
    root: string,
    target: string,
    files: ReadonlyArray<SkillPublicationFile>
  ) => Effect.Effect<void, SkillPublicationError>;
  readonly publishFile: (root: string, target: string, content: string) => Effect.Effect<void, SkillPublicationError>;
  readonly recover: (
    root: string,
    scope: SkillRecoveryScope
  ) => Effect.Effect<ReadonlyArray<SkillRecoveryReport>, SkillPublicationError>;
}

/**
 * The skills projection writer.
 *
 * **Details**
 *
 * Each publication records `intent`, `backed-up` (when the target existed),
 * `staged`, `exchanged`, `verified` and `completed` with an fsynced journal
 * write before the step each one guards. An existing target whose filesystem
 * cannot exchange atomically is refused before any backup or journal.
 *
 * Recovery never runs while the owning process is alive, and decides from the
 * bytes on disk: a target that holds the preimage drops the stage, a target
 * that holds the staged content finishes by dropping the stage, and a foreign
 * entry displaced into the stage is exchanged back to the live path. Any other
 * target, or an artifact holding foreign content, is refused with a typed
 * reason and every artifact is kept. Backups are always kept. Automatic
 * recovery (`pending`) runs before `skills update` writes, and
 * `skills recover` (`retry`) also revisits earlier refusals. Each journal is
 * reconciled under the shared exclusive `<id>.recovering` lock, so a second
 * recoverer reports `lock-held` or `settled`. A publication that fails before
 * its move into place drops its own stage and records the terminal
 * `abandoned` state.
 *
 * **Gotchas**
 *
 * A directory created where none existed is renamed into place. A rename
 * cannot replace a non-empty directory or a file, but it can replace an empty
 * directory another writer created after planning.
 *
 * **Example** (Access the writer)
 *
 * ```ts
 * import { SkillPublisher } from "@beep/repo-cli/commands/Skills/SkillsPublication.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(SkillPublisher.use((publisher) => publisher.recover("/repo", "pending")))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SkillPublisher extends Context.Service<SkillPublisher, SkillPublisherShape>()($I`SkillPublisher`) {}

/**
 * Build the skills projection writer over the services in context.
 *
 * **Details**
 *
 * The atomic-exchange capability is the {@link ModelsAtomicExchange} in
 * context, or the live one, through {@link modelsAtomicExchangeOrLive}.
 *
 * **Example** (Build the writer)
 *
 * ```ts
 * import { makeSkillPublisher } from "@beep/repo-cli/commands/Skills/SkillsPublication.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeSkillPublisher())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSkillPublisher = Effect.fn("SkillPublisher.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ledger = yield* makePublicationLedger();
  const { exchange, qualify } = yield* modelsAtomicExchangeOrLive;
  const io = (message: string, target?: string) => SkillPublicationError.mapError(message, target);
  const withPlatform = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
    effect.pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
  const backupsOf = (root: string) => path.join(root, ".beep", "skills-backups");
  const journalsOf = (root: string) => path.join(backupsOf(root), "journals");

  const { observe, sha256, treeDigest } = yield* makeSkillFingerprints();

  const discard = (entry: string) =>
    ledger.discard(entry, { recursive: true }).pipe(io("Cannot remove a skill publication artifact.", entry));

  // The retained fail-closed boundary: an existing target is qualified on its
  // actual filesystem before any backup, journal or stage.
  const requireExchange = Effect.fnUntraced(function* (target: string) {
    const qualification = yield* qualify(target).pipe(
      Effect.mapError((error) =>
        failure(
          `Atomic exchange capability unknown; refusing skill publication before backup: ${error.message}`,
          "exchange-probe-failed",
          target
        )
      )
    );
    const { capability } = qualification;
    if (capability._tag === "unsupported")
      return yield* failure(
        `Atomic exchange unsupported on the target filesystem (${capability.reason}: ${capability.detail}); refusing skill publication before backup.`,
        "exchange-unsupported",
        target
      );
    return modelsExchangeIdentityKey(qualification.identity);
  });

  const exchangeEntries = (left: string, right: string) =>
    exchange(left, right).pipe(Effect.mapError((error) => failure(error.message, undefined, right)));

  const publishJournal = Effect.fnUntraced(function* (
    root: string,
    journal: SkillPublicationJournal,
    exclusive: boolean
  ) {
    const encoded = yield* encodeJournal(journal).pipe(io("Cannot encode a skill publication journal."));
    yield* ledger
      .publishRecord(journalsOf(root), `${journal.id}.json`, textEncoder.encode(encoded), exclusive)
      .pipe(io("Cannot write a skill publication journal."));
  });

  // The ledger owns the latest journal of one publication and durably writes
  // each next state before the caller performs the step it guards.
  const makeLedger = (root: string, journal: SkillPublicationJournal, publication: SkillTrackedPublication) => {
    let current = publication;
    const advance = (state: ModelsPublicationState) =>
      Effect.suspend(() => {
        current = SkillTrackedPublication.make({ ...current, state });
        return publishJournal(root, SkillPublicationJournal.make({ id: journal.id, publication: current }), false);
      });
    return { advance };
  };

  const refuse = (reason: ModelsRecoveryRefusal, detail: string) =>
    SkillRecoveryResult.cases.refused.make({ reason, detail });

  // Recorded paths must be this journal's own artifacts beside a target inside
  // the repository, so a tampered journal never steers a removal elsewhere.
  const ownsArtifacts = Effect.fnUntraced(function* (root: string, publication: SkillTrackedPublication) {
    const artifacts = [
      publication.target,
      publication.staging,
      ...O.toArray(publication.partial),
      ...O.toArray(publication.backup),
    ];
    const canonical = yield* Effect.forEach(artifacts, (candidate) =>
      resolvePathWithinRoot({ root, candidate }).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.option
      )
    );
    if (A.some(canonical, O.isNone)) return false;
    const resolved = (directory: string) => fs.realPath(directory).pipe(Effect.option);
    const realRoot = yield* resolved(root);
    const relative = O.map(realRoot, (actual) => path.relative(actual, publication.target));
    const contained = O.exists(
      relative,
      (value) => Str.isNonEmpty(value) && !path.isAbsolute(value) && value !== ".." && !Str.startsWith("../")(value)
    );
    const base = path.basename(publication.target);
    const stagePrefix = publication.kind === "file" ? `${base}.tmp-` : `.${base}.stage-`;
    const besideTarget =
      path.dirname(publication.staging) === path.dirname(publication.target) &&
      Str.startsWith(stagePrefix)(path.basename(publication.staging));
    const partialOwned = !O.exists(publication.partial, (partial) => partial !== `${publication.staging}.partial`);
    const backupOwned = yield* O.match(publication.backup, {
      onNone: () => Effect.succeed(true),
      onSome: (backup) =>
        Effect.zipWith(
          resolved(path.dirname(backup)),
          resolved(backupsOf(root)),
          (recorded, actual) => O.isSome(recorded) && O.contains(actual, recorded.value)
        ).pipe(Effect.map((same) => same && Str.startsWith(`${base}.`)(path.basename(backup)))),
    });
    return contained && besideTarget && partialOwned && backupOwned;
  });

  // A foreign entry the exchange displaced into the stage goes back to the
  // live path through another qualified exchange; the publication is refused.
  const returnDisplaced = Effect.fnUntraced(function* (publication: SkillTrackedPublication, foreign: string) {
    if (O.isNone(publication.filesystem))
      return refuse(
        "competing-writer",
        "A competing writer holds the stage; no exchange was recorded, so none is made."
      );
    if ((yield* requireExchange(publication.target)) !== publication.filesystem.value)
      return refuse("filesystem-changed", "Target filesystem identity changed since intent; no exchange attempted.");
    yield* exchangeEntries(publication.staging, publication.target);
    const returned = yield* observe(publication.target, publication.kind);
    return refuse(
      "competing-writer",
      returned._tag === "present" && returned.digest.hash === foreign
        ? "A displaced writer was returned to the live path; the stage keeps the staged content."
        : "A displaced writer could not be confirmed on the live path; every artifact is kept."
    );
  });

  const mismatchDetail = (publication: SkillTrackedPublication, observed: SkillContentDigest) =>
    observed._tag === "directory" && publication.staged._tag === "directory"
      ? `Target tree matches neither the preimage nor the staged tree; it differs from the staged tree at ${A.join(
          A.take(skillTreeDifferences(observed.entries, publication.staged.entries), 5),
          ", "
        )}.`
      : "Target bytes match neither the preimage nor the staged content.";

  // Which recorded content the live target holds, or why recovery must refuse.
  const liveOutcome = (publication: SkillTrackedPublication, target: Observation) =>
    Match.value(target).pipe(
      Match.tagsExhaustive({
        absent: () =>
          O.isNone(publication.preimage)
            ? Result.succeed<ModelsRecoveryOutcome>("preimage")
            : Result.fail(refuse("target-missing", "The skill target is missing; nothing was moved.")),
        foreign: ({ detail }) => Result.fail(refuse("competing-writer", `The skill target ${detail}.`)),
        present: ({ digest }) =>
          O.exists(publication.preimage, (preimage) => sameDigest(preimage, digest))
            ? Result.succeed<ModelsRecoveryOutcome>("preimage")
            : sameDigest(publication.staged, digest)
              ? Result.succeed<ModelsRecoveryOutcome>("intended")
              : Result.fail(refuse("competing-writer", mismatchDetail(publication, digest))),
      })
    );

  // A create (no preimage) that never moved its stage into place, whose target
  // another writer has since created: the stage still holds only the planned
  // content (or is gone), and the live entry is not the planned content.
  const createLost = Effect.fnUntraced(function* (publication: SkillTrackedPublication, target: Observation) {
    if (O.isSome(publication.preimage) || !premoveStep(fromStep(publication.state))) return false;
    if (target._tag === "absent" || (target._tag === "present" && sameDigest(target.digest, publication.staged)))
      return false;
    const staging = yield* observe(publication.staging, publication.kind);
    return staging._tag === "absent" || (staging._tag === "present" && sameDigest(staging.digest, publication.staged));
  });

  // Decide from the content on disk, never from the recorded step alone: the
  // step only says which artifacts may exist.
  const settle = Effect.fnUntraced(function* (root: string, publication: SkillTrackedPublication) {
    if (!(yield* ownsArtifacts(root, publication)))
      return refuse("foreign-artifact", "Recorded recovery paths are not this journal's own artifacts.");
    const target = yield* observe(publication.target, publication.kind);
    if (yield* createLost(publication, target)) {
      yield* Effect.forEach([publication.staging, ...O.toArray(publication.partial)], discard, { discard: true });
      return SkillRecoveryResult.cases.abandoned.make({
        detail: "Another writer created the target before this publication moved its stage into place.",
      });
    }
    const live = liveOutcome(publication, target);
    if (Result.isFailure(live)) return live.failure;
    const known = (observation: Observation) =>
      observation._tag === "absent" ||
      (observation._tag === "present" &&
        (sameDigest(observation.digest, publication.staged) ||
          O.exists(publication.preimage, (preimage) => sameDigest(preimage, observation.digest))));
    const staging = yield* observe(publication.staging, publication.kind);
    if (live.success === "intended" && staging._tag === "present" && !known(staging))
      return yield* returnDisplaced(publication, staging.digest.hash);
    if (!known(staging)) return refuse("foreign-artifact", "The stage holds foreign content.");
    yield* discard(publication.staging);
    yield* Effect.forEach(O.toArray(publication.partial), discard, { discard: true });
    return SkillRecoveryResult.cases.recovered.make({ outcome: live.success });
  });

  // Settle one publication from `from` and record the terminal result. Both
  // recovery and a publication that failed before its move into place close
  // out this way, so a pre-exchange failure leaves a terminal journal.
  const closeOut = Effect.fnUntraced(function* (
    root: string,
    id: string,
    publication: SkillTrackedPublication,
    from: ModelsPublicationStep
  ) {
    const journal = SkillPublicationJournal.make({ id, publication });
    const { advance } = makeLedger(
      root,
      journal,
      SkillTrackedPublication.make({ ...publication, owner: yield* ledger.currentOwner })
    );
    yield* advance(ModelsPublicationState.cases.recovering.make({ from }));
    const result = yield* settle(root, publication);
    yield* advance(
      result._tag === "abandoned"
        ? ModelsPublicationState.cases.abandoned.make({ from, detail: result.detail })
        : publicationTerminalState(from, result)
    );
    yield* withPlatform(dropStalePublicationPartials(journalsOf(root), id)).pipe(
      io("Cannot list skill publication journals.")
    );
    return result;
  });

  // The shared exclusive per-journal recovery lock (`<id>.recovering`).
  const recoveryLock = (root: string, id: string) =>
    ledger.recoveryLock(journalsOf(root), id).pipe(
      Effect.catchTags({
        PublicationLockUnavailable: (error) => failure(error.message, "lock-unavailable", error.path),
        PlatformError: (error) => Effect.fail(error).pipe(io("Cannot reclaim a skill recovery lock.")),
      })
    );

  // The one reconciliation path behind automatic and explicit recovery. The
  // lock is taken before the owner check and the journal is re-read under it,
  // so two recoverers never settle one publication twice; the loser reports
  // `lock-held` or `settled`.
  const reconcile = (root: string, id: string, eligible: (state: ModelsPublicationState) => boolean) =>
    Effect.scoped(
      Effect.gen(function* () {
        if (!(yield* recoveryLock(root, id))) return SkillRecoveryResult.cases.skipped.make({ reason: "lock-held" });
        const fresh = O.filter(
          O.flatMap(yield* readJournal(root, `${id}.json`), (journal) =>
            O.liftPredicate(journal.publication, isTracked)
          ),
          (publication) => eligible(publication.state)
        );
        if (O.isNone(fresh)) return SkillRecoveryResult.cases.skipped.make({ reason: "settled" });
        const publication = fresh.value;
        if (pendingState(publication.state) && (yield* ledger.ownerAlive(publication.owner)))
          return SkillRecoveryResult.cases.skipped.make({ reason: "owner-alive" });
        return yield* closeOut(root, id, publication, fromStep(publication.state));
      })
    );

  const readJournal = (root: string, entry: string) =>
    withPlatform(readPublicationRecord(journalsOf(root), entry, decodeJournal));

  const recoverJournal = Effect.fnUntraced(function* (
    root: string,
    journal: SkillPublicationJournal,
    scope: SkillRecoveryScope
  ) {
    const { publication } = journal;
    if (!isTracked(publication))
      return O.some(
        SkillRecoveryReport.make({
          journal: journal.id,
          result: SkillRecoveryResult.cases.skipped.make({ reason: "legacy" }),
        })
      );
    const eligible = (state: ModelsPublicationState) =>
      pendingState(state) || (scope === "retry" && state._tag === "refused");
    if (!eligible(publication.state)) return O.none<SkillRecoveryReport>();
    return O.some(
      SkillRecoveryReport.make({ journal: journal.id, result: yield* reconcile(root, journal.id, eligible) })
    );
  });

  const recover: SkillPublisherShape["recover"] = Effect.fn("SkillPublisher.recover")(function* (root, scope) {
    const journals = journalsOf(root);
    if (!(yield* fs.exists(journals).pipe(io("Cannot inspect skill publication journals.", journals))))
      return A.empty<SkillRecoveryReport>();
    const entries = A.sort(
      A.filter(
        yield* fs.readDirectory(journals).pipe(io("Cannot list skill publication journals.", journals)),
        Str.endsWith(".json")
      ),
      Order.String
    );
    const decoded = A.getSomes(yield* Effect.forEach(entries, (entry) => readJournal(root, entry)));
    return A.getSomes(yield* Effect.forEach(decoded, (journal) => recoverJournal(root, journal, scope)));
  });

  const assertNoDrift = Effect.fnUntraced(function* (
    target: string,
    kind: SkillPublicationKind,
    preimage: O.Option<SkillContentDigest>
  ) {
    const current = yield* observe(target, kind);
    const unchanged =
      current._tag === "present"
        ? O.exists(preimage, (digest) => sameDigest(digest, current.digest))
        : current._tag === "absent" && O.isNone(preimage);
    if (!unchanged) return yield* failure("Skill projection drifted after planning.", "drift", target);
  });

  // A publication that fails before its move into place never touched the
  // target: drop its own stage and partial stage, then record the terminal
  // `abandoned` state. Skill backups are always kept. A failure to record keeps
  // the original error and the pending journal for recovery.
  const abandon = (
    publication: SkillTrackedPublication,
    advance: (state: ModelsPublicationState) => Effect.Effect<void, SkillPublicationError>,
    from: ModelsPublicationStep,
    error: SkillPublicationError
  ) =>
    Effect.forEach([publication.staging, ...O.toArray(publication.partial)], discard, { discard: true }).pipe(
      Effect.andThen(advance(ModelsPublicationState.cases.abandoned.make({ from, detail: error.message }))),
      Effect.ignore
    );

  // Move a stage onto a target that did not exist. Only EEXIST, or an entry
  // actually found at the target afterwards, is a competing writer; any other
  // failure is a typed error carrying its platform cause.
  const createTarget = (staging: string, target: string, kind: SkillPublicationKind) =>
    (kind === "file" ? fs.link(staging, target) : fs.rename(staging, target)).pipe(
      Effect.catchTag(
        "PlatformError",
        Effect.fnUntraced(function* (error) {
          const occupied = error.reason._tag === "AlreadyExists" || (yield* observe(target, kind))._tag !== "absent";
          if (occupied)
            return yield* failure(
              "A competing writer created the skill target; nothing was replaced.",
              "competing-writer",
              target
            );
          return yield* SkillPublicationError.make({
            message: `Cannot create the skill target (${error.reason._tag}): ${error.message}`,
            target,
            cause: error,
          });
        })
      )
    );

  // Run one publication through its journal: intent, backup, stage, the move
  // into place, verification and cleanup. Every failure after intent names the
  // journal and keeps the artifacts for recovery.
  const publish = Effect.fnUntraced(function* (
    root: string,
    request: {
      readonly kind: SkillPublicationKind;
      readonly target: string;
      readonly preimage: O.Option<SkillContentDigest>;
      readonly staged: SkillContentDigest;
      readonly staging: (suffix: string) => string;
      readonly partial: boolean;
      readonly backup: (backup: string) => Effect.Effect<void, SkillPublicationError>;
      readonly stage: (publication: SkillTrackedPublication) => Effect.Effect<void, SkillPublicationError>;
    }
  ) {
    const { kind, preimage, staged, target } = request;
    const filesystem = O.isSome(preimage) ? O.some(yield* requireExchange(target)) : O.none<string>();
    const backups = backupsOf(root);
    yield* fs
      .makeDirectory(journalsOf(root), { recursive: true, mode: 0o700 })
      .pipe(io("Cannot create skill backup directory.", backups));
    const unique = yield* publicationSuffix;
    const id = `skills-${unique}`;
    const staging = request.staging(unique);
    const publication = SkillTrackedPublication.make({
      kind,
      state: ModelsPublicationState.cases.intent.make({}),
      owner: yield* ledger.currentOwner,
      target,
      staging,
      partial: request.partial ? O.some(`${staging}.partial`) : O.none(),
      backup: O.map(preimage, () => path.join(backups, `${path.basename(target)}.${unique}`)),
      preimage,
      staged,
      filesystem,
    });
    yield* publishJournal(root, SkillPublicationJournal.make({ id, publication }), true);
    const ledgerOf = makeLedger(root, SkillPublicationJournal.make({ id, publication }), publication);
    let reached: ModelsPublicationStep = "intent";
    const advance = (state: ModelsPublicationState) =>
      ledgerOf.advance(state).pipe(Effect.tap(() => Effect.sync(() => (reached = fromStep(state)))));
    // A failure before the move into place closes the journal out through the
    // recovery decision, so it ends terminal instead of pending.
    const prepare = Effect.gen(function* () {
      if (O.isSome(publication.backup)) {
        yield* request.backup(publication.backup.value);
        yield* advance(ModelsPublicationState.cases["backed-up"].make({}));
      }
      yield* request.stage(publication);
      yield* assertNoDrift(target, kind, preimage);
      yield* advance(ModelsPublicationState.cases.staged.make({}));
    }).pipe(Effect.tapError((error) => Effect.suspend(() => abandon(publication, advance, reached, error))));
    yield* Effect.gen(function* () {
      yield* prepare;
      yield* Effect.uninterruptible(
        Effect.gen(function* () {
          yield* O.match(filesystem, {
            onNone: () =>
              createTarget(staging, target, kind).pipe(
                Effect.tapError((error) => abandon(publication, advance, "staged", error))
              ),
            onSome: () => exchangeEntries(staging, target),
          });
          yield* advance(ModelsPublicationState.cases.exchanged.make({}));
          const displaced = yield* observe(staging, kind);
          const displacedPreimage = O.match(preimage, {
            onNone: () =>
              displaced._tag === "absent" || (displaced._tag === "present" && sameDigest(displaced.digest, staged)),
            onSome: (digest) => displaced._tag === "present" && sameDigest(displaced.digest, digest),
          });
          if (!displacedPreimage) {
            const settled = yield* closeOut(root, id, publication, "exchanged");
            return yield* failure(
              `Concurrent skill write detected during publication; ${settled._tag === "refused" ? settled.detail : "recovery state retained."}`,
              "competing-writer",
              target
            );
          }
          const live = yield* observe(target, kind);
          if (live._tag !== "present" || !sameDigest(live.digest, staged))
            return yield* failure(
              "Skill target changed after replacement; recovery state retained.",
              undefined,
              target
            );
          yield* advance(ModelsPublicationState.cases.verified.make({}));
        })
      );
      yield* discard(staging);
      yield* advance(ModelsPublicationState.cases.completed.make({}));
    }).pipe(
      Effect.mapError((error) =>
        SkillPublicationError.make({
          ...O.getSomesStruct({
            reason: O.fromUndefinedOr(error.reason),
            target: O.fromUndefinedOr(error.target),
            cause: O.fromUndefinedOr(error.cause),
          }),
          message: `${error.message} Journal: ${id}`,
          journal: id,
        })
      )
    );
  });

  // Write each planned file 0644 inside the partial stage, refusing a path
  // that would land outside it, and fsync it.
  const writeStagedFiles = Effect.fnUntraced(function* (
    target: string,
    partial: string,
    files: ReadonlyArray<SkillPublicationFile>
  ) {
    const stageError = io("Cannot stage remote skill.", target);
    for (const file of files) {
      const destination = path.resolve(partial, file.path);
      const relative = path.relative(partial, destination);
      if (Str.isEmpty(relative) || path.isAbsolute(relative) || Str.startsWith("..")(relative))
        return yield* failure("Refusing a remote skill file outside its staged tree.", undefined, target);
      yield* fs.makeDirectory(path.dirname(destination), { recursive: true }).pipe(stageError);
      yield* fs.writeFile(destination, asArrayBufferView(file.bytes), { flag: "wx" }).pipe(stageError);
      yield* fs.chmod(destination, plannedFileMode).pipe(stageError);
      yield* ledger.syncFile(destination).pipe(stageError);
    }
  });

  // Give every planned directory 0755 and fsync it.
  const settleStagedDirectories = Effect.fnUntraced(function* (
    target: string,
    partial: string,
    staged: SkillDirectoryDigest
  ) {
    const directories = A.filter(staged.entries, (entry) => entry.kind === "directory");
    for (const entry of directories) {
      const directory = entry.path === "." ? partial : path.join(partial, entry.path);
      yield* fs.chmod(directory, plannedDirectoryMode).pipe(io("Cannot stage remote skill.", target));
      yield* ledger.syncDirectory(directory);
    }
  });

  const stagedTreeMismatch = (written: Observation, staged: SkillDirectoryDigest) =>
    written._tag === "present" && written.digest._tag === "directory"
      ? ` at ${A.join(skillTreeDifferences(written.digest.entries, staged.entries), ", ")}`
      : "";

  // Assemble the tree under `<stage>.partial`, then rename it to its stage
  // name, so a stage at its recorded name is always complete.
  const stageTree = Effect.fnUntraced(function* (
    target: string,
    staging: string,
    files: ReadonlyArray<SkillPublicationFile>,
    staged: SkillDirectoryDigest
  ) {
    const partial = `${staging}.partial`;
    yield* fs.makeDirectory(partial).pipe(io("Cannot stage remote skill.", target));
    yield* writeStagedFiles(target, partial, files);
    yield* settleStagedDirectories(target, partial, staged);
    yield* fs.rename(partial, staging).pipe(io("Cannot publish staged remote skill.", target));
    yield* ledger.syncDirectory(path.dirname(target));
    const written = yield* observe(staging, "directory");
    if (written._tag !== "present" || !sameDigest(written.digest, staged))
      return yield* failure(
        `Staged skill tree differs from the planned tree${stagedTreeMismatch(written, staged)}.`,
        undefined,
        target
      );
  });

  // What a publication replaces: none when the target already holds the
  // planned content, otherwise the preimage (none for an absent target).
  const planPreimage = Effect.fnUntraced(function* (
    target: string,
    kind: SkillPublicationKind,
    staged: SkillContentDigest
  ) {
    const current = yield* observe(target, kind);
    if (current._tag === "foreign")
      return yield* failure(`Refusing a skill ${kind} target that ${current.detail}.`, undefined, target);
    if (current._tag === "absent") return O.some(O.none<SkillContentDigest>());
    return sameDigest(current.digest, staged) ? O.none() : O.some(O.some(current.digest));
  });

  const publishFile: SkillPublisherShape["publishFile"] = Effect.fn("SkillPublisher.publishFile")(
    function* (root, target, content) {
      const bytes = textEncoder.encode(content);
      const staged = SkillContentDigest.cases.file.make({ hash: yield* sha256(bytes) });
      const planned = yield* planPreimage(target, "file", staged);
      if (O.isNone(planned)) return;
      const preimage = planned.value;
      yield* publish(root, {
        kind: "file",
        target,
        preimage,
        staged,
        staging: (unique) => `${target}.tmp-${unique}`,
        partial: false,
        backup: (backup) =>
          fs.readFile(target).pipe(
            Effect.flatMap((previous) => ledger.writeDurable(backup, previous)),
            io("Cannot back up skill projection.", target)
          ),
        stage: Effect.fnUntraced(function* (publication) {
          const { staging } = publication;
          yield* fs
            .writeFileString(staging, content, { flag: "wx", mode: 0o600 })
            .pipe(io("Cannot stage skill projection.", target));
          yield* ledger.syncFile(staging).pipe(io("Cannot stage skill projection.", target));
          const mode = O.isSome(preimage)
            ? (yield* fs.stat(target).pipe(io("Cannot read projection permissions.", target))).mode
            : plannedFileMode;
          yield* fs.chmod(staging, mode & 0o7777).pipe(io("Cannot preserve projection permissions.", target));
          const written = yield* observe(staging, "file");
          if (written._tag !== "present" || !sameDigest(written.digest, staged))
            return yield* failure("Staged skill projection differs from the planned content.", undefined, target);
        }),
      });
    }
  );

  const publishDirectory: SkillPublisherShape["publishDirectory"] = Effect.fn("SkillPublisher.publishDirectory")(
    function* (root, target, files) {
      const digests = yield* Effect.forEach(files, (file) => sha256(file.bytes));
      const staged = yield* treeDigest(plannedEntries(files, digests));
      const planned = yield* planPreimage(target, "directory", staged);
      if (O.isNone(planned)) return;
      const preimage = planned.value;
      yield* fs
        .makeDirectory(path.dirname(target), { recursive: true })
        .pipe(io("Cannot create the skill directory parent.", target));
      yield* publish(root, {
        kind: "directory",
        target,
        preimage,
        staged,
        staging: (unique) => path.join(path.dirname(target), `.${path.basename(target)}.stage-${unique}`),
        partial: true,
        backup: (backup) =>
          fs
            .copy(target, backup, { overwrite: false, preserveTimestamps: true })
            .pipe(io("Cannot back up remote skill.", target)),
        stage: (publication) => stageTree(target, publication.staging, files, staged),
      });
    }
  );

  return SkillPublisher.of({ publishDirectory, publishFile, recover });
});

/**
 * The skills projection writer over the platform services.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { SkillPublisherLive } from "@beep/repo-cli/commands/Skills/SkillsPublication.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(SkillPublisherLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillPublisherLive = Layer.effect(SkillPublisher, makeSkillPublisher());

/**
 * The skills projection writer in context, or a live one when none is provided.
 *
 * **Example** (Resolve the writer)
 *
 * ```ts
 * import { skillPublisherOrLive } from "@beep/repo-cli/commands/Skills/SkillsPublication.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(skillPublisherOrLive)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const skillPublisherOrLive = Effect.serviceOption(SkillPublisher).pipe(
  Effect.flatMap(O.match({ onNone: makeSkillPublisher, onSome: Effect.succeed }))
);

/**
 * Fingerprint a skill directory tree as recovery and publication do.
 *
 * **Details**
 *
 * The digest is the tree hash defined on {@link SkillTreeEntry}, with the
 * sorted entries. A tree holding an entry that is not a directory, regular
 * file or symlink, or a root that is not a directory, has no fingerprint.
 *
 * **Example** (Fingerprint a tree)
 *
 * ```ts
 * import { skillTreeDigest } from "@beep/repo-cli/commands/Skills/SkillsPublication.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(skillTreeDigest("/repo/.claude/skills/grill-me"))) // true
 * ```
 *
 * @param directory - The tree root.
 * @returns The directory fingerprint, or none.
 * @category utilities
 * @since 0.0.0
 */
export const skillTreeDigest = Effect.fn("SkillPublisher.treeDigest")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const { walk } = yield* makeSkillFingerprints();
  const info = yield* fs.stat(directory).pipe(Effect.option);
  const isTree =
    O.exists(info, (entry) => entry.type === "Directory") &&
    O.isNone(yield* fs.readLink(directory).pipe(Effect.option));
  return isTree ? yield* walk(directory) : O.none<SkillDirectoryDigest>();
});
