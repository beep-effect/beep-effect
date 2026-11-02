/**
 * Backup-first native configuration writes and drift-fenced recovery.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { asArrayBufferView } from "../../internal/cli/Bytes.ts";
import { collectText } from "../../internal/process/StepExec.ts";
import { makePublicationLedger, publicationSuffix } from "../../internal/publication/PublicationLedger.ts";
import {
  ModelsExchangeFault,
  ModelsExchangeLaunchError,
  ModelsExchangeProbeError,
  ModelsLocatorError,
} from "./Models.errors.ts";
import {
  ModelsExchangeCapability,
  ModelsExchangeFilesystemIdentity,
  ModelsExchangeMount,
  ModelsExchangeQualification,
  ModelsPublicationRole,
  ModelsPublicationState,
  ModelsRecoveryReport,
  ModelsRecoveryResult,
  ModelsTrackedPublication,
  modelsExchangeIdentityKey,
} from "./Models.exchange.schemas.ts";
import { modelsReadLocator } from "./Models.locator.service.ts";
import { ModelsApplyJournal, ModelsEligibilityResult, ModelsWriteSpan } from "./Models.manifest.schemas.ts";
import { ModelsTargetFile } from "./Models.paths.ts";
import {
  modelsApplySpans,
  modelsCheckOnlyFormat,
  modelsEligibility,
  modelsNativeText,
  modelsParseJson,
  modelsParseToml,
  modelsWritePreflight,
  modelsWriteSpans,
} from "./Models.spans.ts";
import type {
  ModelsExchangeUnsupportedReason,
  ModelsPublicationStep,
  ModelsRecoveryOutcome,
  ModelsRecoveryRefusal,
} from "./Models.exchange.schemas.ts";
import type { ModelsApplyMode, ModelsLocatorWrite } from "./Models.manifest.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.apply.service");
const encodeJournal = S.encodeEffect(S.fromJsonString(ModelsApplyJournal));
const isTrackedPublication = S.is(ModelsTrackedPublication);
// A pending publication may still be mid-step; terminal states are completed,
// recovered and refused.
const pendingState = ModelsPublicationState.isAnyOf([
  "intent",
  "backed-up",
  "staged",
  "exchanged",
  "verified",
  "recovering",
]);
const isRecoveryState = ModelsPublicationState.isAnyOf(["recovering", "recovered", "refused", "abandoned"]);
// Explicit restore also retries a publication automatic recovery refused.
const retryableState = ModelsPublicationState.isAnyOf([
  "intent",
  "backed-up",
  "staged",
  "exchanged",
  "verified",
  "recovering",
  "refused",
]);
const textBytes = (text: string) => new TextEncoder().encode(text);
// What recovery finds on one recorded path: nothing, a symlink or non-regular
// entry it never removes, or a regular file and the SHA-256 of its bytes.
const Observation = S.TaggedUnion({ absent: {}, foreign: {}, file: { hash: S.String } });
type Observation = typeof Observation.Type;
const decodeJournal = S.decodeEffect(S.fromJsonString(ModelsApplyJournal));
const failure = (message: string) => ModelsLocatorError.make({ message });
const nativeFields = S.Record(S.String, S.Unknown);
const encodeValue = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeJsonText = (text: string) => modelsParseJson(text).pipe(Effect.map((tree) => tree.toValue()));

// Mask exactly the owned leaves in parsed native data. This assertion is
// independent of the stronger byte-preservation assertion below.
const maskOwned = (value: unknown, paths: ReadonlyArray<ReadonlyArray<string>>): unknown => {
  if (A.some(paths, A.isReadonlyArrayEmpty)) return "owned-model-leaf";
  const childPaths = (key: string) =>
    A.map(
      A.filter(paths, (segments) => O.contains(A.head(segments), key)),
      A.drop(1)
    );
  if (A.isArray(value)) return A.map(value, (child, index) => maskOwned(child, childPaths(`${index}`)));
  if (S.is(nativeFields)(value))
    return R.map(
      R.filter(value, (_, key) => !A.some(childPaths(key), A.isReadonlyArrayEmpty)),
      (child, key) => maskOwned(child, childPaths(key))
    );
  return value;
};

const assertNativeFields = Effect.fnUntraced(function* (
  before: string,
  after: string,
  writes: ReadonlyArray<ModelsLocatorWrite>
) {
  const tomlPaths = A.flatMap(writes, ({ locator }) =>
    locator._tag === "toml-top-level-key"
      ? [[locator.key]]
      : locator._tag === "toml-table-key"
        ? [[...Str.split(locator.table, "."), locator.key]]
        : []
  );
  const jsonPaths = A.flatMap(writes, ({ locator }) => (locator._tag === "json-key" ? [locator.pointer] : []));
  const compare = Effect.fnUntraced(function* (
    left: unknown,
    right: unknown,
    owned: ReadonlyArray<ReadonlyArray<string>>
  ) {
    const beforeNative = yield* encodeValue(maskOwned(left, owned)).pipe(
      Effect.mapError(() => failure("Cannot compare native fields."))
    );
    const afterNative = yield* encodeValue(maskOwned(right, owned)).pipe(
      Effect.mapError(() => failure("Cannot compare native fields."))
    );
    if (beforeNative !== afterNative) return yield* failure("Non-owned native keys changed.");
  });
  if (A.isReadonlyArrayNonEmpty(tomlPaths)) {
    const decode = modelsParseToml;
    yield* compare(
      yield* decode(before).pipe(Effect.mapError(() => failure("Invalid native TOML."))),
      yield* decode(after).pipe(Effect.mapError(() => failure("Invalid native TOML."))),
      tomlPaths
    );
  }
  if (A.isReadonlyArrayNonEmpty(jsonPaths)) {
    yield* compare(
      yield* decodeJsonText(before).pipe(Effect.mapError(() => failure("Invalid native JSON."))),
      yield* decodeJsonText(after).pipe(Effect.mapError(() => failure("Invalid native JSON."))),
      jsonPaths
    );
  }
});

const assertParsedProjection = Effect.fnUntraced(function* (after: string, writes: ReadonlyArray<ModelsLocatorWrite>) {
  for (const write of writes) {
    if (write.remove !== true) {
      const projected = yield* modelsReadLocator(
        ModelsTargetFile.make({ root: "home", absolutePath: "projected", content: after }),
        write.locator
      );
      if (!O.contains(projected, write.expected))
        return yield* failure("Owned projection does not match its parsed expected value.");
    }
  }
});

const assertOwnedBytes = Effect.fnUntraced(function* (
  before: string,
  after: string,
  writes: ReadonlyArray<ModelsLocatorWrite>,
  spans: ReadonlyArray<ModelsWriteSpan>
) {
  const previousByOrder = A.sort(
    spans,
    Order.mapInput(Order.Number, (entry: ModelsWriteSpan) => entry.start)
  );
  let shift = 0;
  const reversed = A.map(previousByOrder, (previous) => {
    const start = previous.start + shift;
    shift += Str.length(previous.after) - Str.length(previous.before);
    return ModelsWriteSpan.make({
      start,
      end: start + Str.length(previous.after),
      before: previous.after,
      after: previous.before,
    });
  });
  yield* assertParsedProjection(after, writes);
  // Re-resolve all owned locators, including absent-key removal assertions.
  for (const write of writes) {
    const resolved = yield* modelsWriteSpans(after, write);
    if (write.remove === true && A.isReadonlyArrayNonEmpty(resolved))
      return yield* failure("Removed native key returned during projection.");
    if ((yield* modelsApplySpans(after, resolved)) !== after)
      return yield* failure("Owned projection is not stable after re-resolving its addresses.");
  }
  if ((yield* modelsApplySpans(after, reversed)) !== before) return yield* failure("Non-owned native bytes changed.");
});

/**
 * The writer accepts only explicit locator ownership, never a full replacement file.
 *
 * **Details**
 *
 * `apply` and `restore` publish through a journaled state machine. `recover`
 * reconciles every interrupted publication in a backup directory whose owning
 * process has died, and reports what it did. `apply --write` runs the same
 * reconciliation for its own target first, and `restore` runs it for its
 * journal, so manual and automatic recovery share one code path.
 *
 * **Example** (Describe the owned operations)
 *
 * ```ts
 * import type { ModelsApplyShape } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * const operations: ReadonlyArray<keyof ModelsApplyShape> = ["apply", "restore", "recover"]
 * console.log(operations.length) // 3
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsApplyShape {
  readonly apply: (
    file: string,
    writes: ReadonlyArray<ModelsLocatorWrite>,
    mode: ModelsApplyMode,
    backupDirectory: string
  ) => Effect.Effect<O.Option<ModelsApplyJournal>, ModelsLocatorError>;
  readonly recover: (backupDirectory: string) => Effect.Effect<ReadonlyArray<ModelsRecoveryReport>, ModelsLocatorError>;
  readonly restore: (journalFile: string, backupDirectory: string) => Effect.Effect<void, ModelsLocatorError>;
}

/**
 * Key-scoped native-file writer with exclusive backups and journaled rollback.
 *
 * **Details**
 *
 * A same-directory exclusive hard link retains the planned inode. Publication
 * uses GNU mv --exchange (renameat2 RENAME_EXCHANGE), then verifies the actual
 * displaced inode and bytes. Apply, restore and recovery exchange rather than
 * overwriting a pathname. A competing replacement is returned to the live path;
 * every detected race fails with a journal id and retains recovery artifacts.
 * Capability is qualified per target mount (parent-directory mount id, device id
 * and reported filesystem type) and cached per identity. An unsupported or unknown
 * capability fails closed for every write and restore, including home writes,
 * before any backup, journal or publication. There is no unverified fallback.
 * Writers holding an inode can still mutate it after its final observation;
 * strict exclusion of such writers requires an external maintenance boundary.
 *
 * Each publication records `intent`, `backed-up`, `staged`, `exchanged`,
 * `verified` and `completed` in its journal with an fsynced write-and-rename
 * before the step each one guards. Recovery never runs while the owning
 * process is alive. It compares the live bytes with the recorded preimage and
 * staged hashes: a preimage target drops the stage, the preimage link and the
 * stale backup; a staged target finishes by dropping the stage and link. A
 * foreign file displaced into the stage is exchanged back to the live path. Any
 * other target, or any artifact holding foreign bytes, is refused with a typed
 * reason and every artifact is kept.
 *
 * **Example** (Access the writer)
 *
 * ```ts
 * import { ModelsApply } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(ModelsApply.use((writer) => Effect.succeed(writer))))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsApply extends Context.Service<ModelsApply, ModelsApplyShape>()($I`ModelsApply`) {}

const validateSyntax = Effect.fn("ModelsApply.validate")((text: string, writes: ReadonlyArray<ModelsLocatorWrite>) =>
  Effect.forEach(
    writes,
    ({ locator }) =>
      Match.value(locator).pipe(
        Match.tag("toml-top-level-key", "toml-table-key", () =>
          modelsParseToml(text).pipe(
            Effect.mapError(() => failure("Invalid TOML target.")),
            Effect.asVoid
          )
        ),
        Match.tag("json-key", () =>
          decodeJsonText(text).pipe(
            Effect.mapError(() => failure("Invalid JSON target.")),
            Effect.asVoid
          )
        ),
        Match.orElse(() => Effect.void)
      ),
    { concurrency: 1, discard: true }
  )
);

const checkReadOnlyDrift = Effect.fnUntraced(function* (text: string, writes: ReadonlyArray<ModelsLocatorWrite>) {
  for (const { locator, expected } of writes) {
    const format = modelsCheckOnlyFormat(locator);
    if (O.isNone(format)) continue;
    const current = yield* modelsReadLocator(
      ModelsTargetFile.make({ root: "home", absolutePath: "check-only", content: text }),
      locator
    );
    if (O.exists(current, (value) => /^Unsupported (?:shell|YAML|XML|JSON) form/.test(value)))
      return yield* failure(
        `${O.getOrThrow(current)}: owned configuration drift detected (${Str.toLowerCase(format.value)} target is check-only; edit by hand).`
      );
    if (!O.contains(current, expected))
      return yield* failure(
        `Owned configuration drift detected (${Str.toLowerCase(format.value)} target is check-only; edit by hand).`
      );
  }
});

/**
 * Host primitives the atomic-exchange capability is built from.
 *
 * **Details**
 *
 * `identify` names the mount and filesystem that hold a directory, and
 * `mount` names the mount that contains any path, including a path that is
 * itself a mount point. `exchange` swaps two pathnames atomically. It fails
 * with {@link ModelsExchangeFault} when the host refuses, or with
 * {@link ModelsExchangeLaunchError} when it could not be run at all. The live
 * primitives are `/proc/self/mountinfo`, GNU `stat --file-system` and
 * `mv --exchange` (renameat2 `RENAME_EXCHANGE`). Tests supply their own to
 * simulate a refusing filesystem, a bind mount or a changed identity.
 *
 * **Example** (Describe the primitives)
 *
 * ```ts
 * import type { ModelsExchangeSystemShape } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * const primitives: ReadonlyArray<keyof ModelsExchangeSystemShape> = ["identify", "mount", "exchange"]
 * console.log(primitives.length) // 3
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsExchangeSystemShape {
  readonly exchange: (
    left: string,
    right: string
  ) => Effect.Effect<void, ModelsExchangeFault | ModelsExchangeLaunchError>;
  readonly identify: (directory: string) => Effect.Effect<ModelsExchangeFilesystemIdentity, ModelsExchangeProbeError>;
  readonly mount: (path: string) => Effect.Effect<ModelsExchangeMount, ModelsExchangeProbeError>;
}

/**
 * Atomic exchange plus the per-target-filesystem capability that gates it.
 *
 * **Example** (Describe the capability operations)
 *
 * ```ts
 * import type { ModelsAtomicExchangeShape } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * const operations: ReadonlyArray<keyof ModelsAtomicExchangeShape> = ["exchange", "qualify"]
 * console.log(operations.length) // 2
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsAtomicExchangeShape {
  readonly exchange: (left: string, right: string) => Effect.Effect<void, ModelsLocatorError>;
  readonly qualify: (target: string) => Effect.Effect<ModelsExchangeQualification, ModelsExchangeProbeError>;
}

/**
 * Atomic pathname exchange capability shared by publication and recovery.
 *
 * **Details**
 *
 * `qualify` answers for the filesystem of one existing target. It identifies
 * the target's parent directory, then probes by exchanging two disposable
 * files in a temporary directory it creates inside that parent and removes
 * afterwards; native content is never touched. Results are cached per
 * {@link ModelsExchangeFilesystemIdentity}, so a target whose mount, device or
 * filesystem type changes is probed again. A target on a different mount than
 * its parent (a mount point or a bind mount, even one with the same device
 * id) is unsupported (`exdev`) without probing. A probe that cannot run fails
 * with {@link ModelsExchangeProbeError} and is not cached.
 *
 * **Example** (Inspect the capability)
 *
 * ```ts
 * import { ModelsAtomicExchange } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(ModelsAtomicExchange.use((service) => service.qualify("/srv/config/app.toml"))))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsAtomicExchange extends Context.Service<ModelsAtomicExchange, ModelsAtomicExchangeShape>()(
  $I`ModelsAtomicExchange`
) {}

const errnoMessages: ReadonlyArray<readonly [RegExp, ModelsExchangeUnsupportedReason]> = [
  [/Invalid cross-device link/i, "exdev"],
  [/Invalid argument/i, "einval"],
  [/Operation not permitted/i, "eperm"],
  [/Function not implemented/i, "enosys"],
];

/**
 * Map the C-locale strerror text a failed exchange printed onto its reason.
 *
 * **Details**
 *
 * The live primitive runs `mv` with `LC_ALL=C`, so the errno text is stable.
 * Text that names none of the four errno values, such as an `mv` that does not
 * know `--exchange`, maps to `unknown`.
 *
 * **Example** (Classify a cross-device refusal)
 *
 * ```ts
 * import { modelsExchangeErrnoFromStderr } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * console.log(modelsExchangeErrnoFromStderr("mv: cannot exchange 'a' and 'b': Invalid cross-device link")) // "exdev"
 * ```
 *
 * @param stderr - C-locale stderr emitted by the failed exchange primitive.
 * @returns The recognized refusal reason, or `unknown` when no supported errno text matches.
 * @category utilities
 * @since 0.0.0
 */
export const modelsExchangeErrnoFromStderr = (stderr: string): ModelsExchangeUnsupportedReason =>
  O.match(
    A.findFirst(errnoMessages, ([pattern]) => pattern.test(stderr)),
    {
      onNone: (): ModelsExchangeUnsupportedReason => "unknown",
      onSome: ([, reason]) => reason,
    }
  );

/**
 * Classify a failed `mv --exchange` run as a host refusal, or as no verdict.
 *
 * **Details**
 *
 * A host refusal is a non-zero exit below 128 that printed error text; its
 * reason comes from {@link modelsExchangeErrnoFromStderr}. A run killed by a
 * signal (exit 128 or above) or one that printed nothing gave no host verdict,
 * so it returns `None` and the caller reports a launch failure that is never
 * cached.
 *
 * **Example** (Separate a refusal from a killed run)
 *
 * ```ts
 * import { modelsExchangeHostRefusal } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(modelsExchangeHostRefusal(1, "mv: cannot exchange 'a' and 'b': Invalid argument"))) // "einval"
 * console.log(O.isNone(modelsExchangeHostRefusal(137, ""))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modelsExchangeHostRefusal: {
  (stderr: string): (code: number) => O.Option<ModelsExchangeUnsupportedReason>;
  (code: number, stderr: string): O.Option<ModelsExchangeUnsupportedReason>;
} = dual(
  2,
  (code: number, stderr: string): O.Option<ModelsExchangeUnsupportedReason> =>
    code > 0 && code < 128 && Str.isNonEmpty(Str.trim(stderr))
      ? O.some(modelsExchangeErrnoFromStderr(stderr))
      : O.none()
);

// mountinfo octal-escapes space, tab, newline and backslash in mount points.
const decodeMountPoint = (field: string): string =>
  Str.replaceWith(field, /\\([0-7]{3})/g, (_match: string, octal: unknown) =>
    String.fromCharCode(Number.parseInt(String(octal), 8))
  );

const containsPath = (point: string, path: string) =>
  point === "/" || path === point || Str.startsWith(`${point}/`)(path);

/**
 * Find the mount that contains an absolute, symlink-free path in a Linux mount table.
 *
 * **Details**
 *
 * Reads `/proc/self/mountinfo` text: field 1 is the mount id and field 5 the
 * octal-escaped mount point. The deepest mount point that contains the path
 * wins, and among mounts stacked on the same point the last line (the visible
 * one) wins. A file that is itself bind-mounted therefore resolves to its own
 * mount, not its parent's. Malformed lines are skipped.
 *
 * **Example** (Resolve a bind-mounted file)
 *
 * ```ts
 * import { modelsExchangeMountOf } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import * as O from "effect/Option"
 *
 * const table = [
 *   "1 0 8:1 / / rw - ext4 /dev/sda1 rw",
 *   "40 1 8:1 /srv/a.toml /etc/app.toml rw - ext4 /dev/sda1 rw"
 * ].join("\n")
 * console.log(O.getOrThrow(modelsExchangeMountOf(table, "/etc/app.toml")).id) // 40n
 * console.log(O.getOrThrow(modelsExchangeMountOf(table, "/etc")).id) // 1n
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modelsExchangeMountOf: {
  (path: string): (mountinfo: string) => O.Option<ModelsExchangeMount>;
  (mountinfo: string, path: string): O.Option<ModelsExchangeMount>;
} = dual(
  2,
  (mountinfo: string, path: string): O.Option<ModelsExchangeMount> =>
    A.reduce(Str.split(mountinfo, "\n"), O.none<ModelsExchangeMount>(), (best, line) => {
      const fields = Str.split(line, " ");
      const id = fields[0];
      const raw = fields[4];
      if (id === undefined || raw === undefined || !/^[0-9]+$/.test(id)) return best;
      const point = decodeMountPoint(raw);
      if (!Str.startsWith("/")(point) || !containsPath(point, path)) return best;
      return O.isSome(best) && Str.length(best.value.point) > Str.length(point)
        ? best
        : O.some(ModelsExchangeMount.make({ id: BigInt(id), point }));
    })
);

const unsupported = (reason: ModelsExchangeUnsupportedReason, detail: string) =>
  ModelsExchangeCapability.cases.unsupported.make({ reason, detail });

/**
 * Build the cached, per-target-filesystem exchange capability from host primitives.
 *
 * **Details**
 *
 * Probes are serialized, so concurrent writers to one new filesystem probe it
 * once. Only host verdicts are cached for the identity: supported, or
 * unsupported because the host refused the exchange. A probe that could not
 * run, including a launch failure of the exchange primitive, is a typed
 * {@link ModelsExchangeProbeError} and is not cached.
 *
 * **Example** (Build the capability from primitives)
 *
 * ```ts
 * import { makeModelsAtomicExchange } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import { ModelsExchangeFault } from "@beep/repo-cli/commands/Models/Models.errors"
 * import {
 *   ModelsExchangeFilesystemIdentity,
 *   ModelsExchangeMount
 * } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const capability = makeModelsAtomicExchange({
 *   identify: () =>
 *     Effect.succeed(ModelsExchangeFilesystemIdentity.make({ mount: 1n, device: 1n, filesystemType: O.none() })),
 *   mount: () => Effect.succeed(ModelsExchangeMount.make({ id: 1n, point: "/" })),
 *   exchange: () => Effect.fail(ModelsExchangeFault.make({ reason: "einval", message: "Invalid argument" }))
 * })
 * console.log(Effect.isEffect(capability))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeModelsAtomicExchange = Effect.fn("ModelsAtomicExchange.make")(function* (
  system: ModelsExchangeSystemShape
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cache = MutableHashMap.empty<string, ModelsExchangeCapability>();
  const lock = yield* Semaphore.make(1);
  const exchange: ModelsAtomicExchangeShape["exchange"] = (left, right) =>
    system
      .exchange(left, right)
      .pipe(
        Effect.mapError((error) =>
          failure(
            `Atomic exchange failed; retain recovery artifacts. (${error._tag === "ModelsExchangeFault" ? error.reason : "launch"}: ${error.message})`
          )
        )
      );
  // The disposable pair lives in a fresh directory inside the target's parent,
  // on the same mount, and the scope removes it whatever the outcome.
  const probe = Effect.fnUntraced(function* (directory: string, device: bigint, mount: bigint) {
    const probeError = ModelsExchangeProbeError.mapError("Cannot run the atomic exchange probe.", directory);
    const root = yield* fs
      .makeTempDirectoryScoped({ directory, prefix: ".beep-models-exchange-probe-" })
      .pipe(probeError);
    if ((yield* fs.stat(root).pipe(probeError)).dev !== device || (yield* system.mount(root)).id !== mount)
      return yield* ModelsExchangeProbeError.make({
        message: "Atomic exchange probe directory is not on the target filesystem.",
        path: directory,
      });
    const left = path.join(root, "left");
    const right = path.join(root, "right");
    yield* fs.writeFileString(left, "left", { flag: "wx", mode: 0o600 }).pipe(probeError);
    yield* fs.writeFileString(right, "right", { flag: "wx", mode: 0o600 }).pipe(probeError);
    const refused = yield* system.exchange(left, right).pipe(
      Effect.as(O.none<ModelsExchangeCapability>()),
      Effect.catchTags({
        ModelsExchangeFault: (fault) => Effect.succeedSome(unsupported(fault.reason, fault.message)),
        ModelsExchangeLaunchError: (error) =>
          ModelsExchangeProbeError.make({
            message: `Atomic exchange probe could not run; no host verdict: ${error.message}`,
            path: directory,
          }),
      })
    );
    if (O.isSome(refused)) return refused.value;
    const swapped =
      (yield* fs.readFileString(left).pipe(probeError)) === "right" &&
      (yield* fs.readFileString(right).pipe(probeError)) === "left";
    return swapped
      ? ModelsExchangeCapability.cases.supported.make({})
      : unsupported("unknown", "Atomic exchange probe files were not exchanged.");
  }, Effect.scoped);
  const qualify: ModelsAtomicExchangeShape["qualify"] = Effect.fn("ModelsAtomicExchange.qualify")(function* (target) {
    const directory = path.dirname(target);
    const statError = ModelsExchangeProbeError.mapError("Cannot identify the target filesystem.", directory);
    const parent = yield* fs.stat(directory).pipe(statError);
    const own = yield* fs.stat(target).pipe(statError);
    const identity = yield* system.identify(directory);
    const qualification = (capability: ModelsExchangeCapability) =>
      ModelsExchangeQualification.make({ directory, identity, capability });
    if (own.dev !== parent.dev)
      return qualification(unsupported("exdev", "Target is a mount point separate from its parent directory."));
    // An equal device id does not prove an equal mount: a bind mount of a file
    // or directory from the same filesystem keeps st_dev, but rename across it
    // fails with EXDEV. Compare real mount ids before any probe or backup.
    const targetMount = yield* system.mount(target);
    if (targetMount.id !== identity.mount)
      return qualification(
        unsupported(
          "exdev",
          `Target is on mount ${targetMount.id} (${targetMount.point}), not its parent directory's mount ${identity.mount}; bind-mounted or mount-point targets cannot be exchanged.`
        )
      );
    const key = modelsExchangeIdentityKey(identity);
    return qualification(
      yield* lock.withPermits(1)(
        Effect.gen(function* () {
          const cached = MutableHashMap.get(cache, key);
          if (O.isSome(cached)) return cached.value;
          const probed = yield* probe(directory, parent.dev, identity.mount);
          MutableHashMap.set(cache, key, probed);
          return probed;
        })
      )
    );
  });
  return ModelsAtomicExchange.of({ exchange, qualify });
});

// renameat2(AT_FDCWD, left, AT_FDCWD, right, RENAME_EXCHANGE) through glibc. A
// refusal prints the C strerror text, which classifies like mv's own refusals.
const renameExchangeScript = A.join(
  [
    "import ctypes, os, sys",
    "libc = ctypes.CDLL(None, use_errno=True)",
    "if libc.renameat2(-100, os.fsencode(sys.argv[1]), -100, os.fsencode(sys.argv[2]), 2) != 0:",
    "    sys.stderr.write('renameat2: cannot exchange: ' + os.strerror(ctypes.get_errno()) + '\\n')",
    "    sys.exit(1)",
  ],
  "\n"
);

/**
 * Whether a failed `mv --exchange` run means the option itself is missing.
 *
 * **Details**
 *
 * GNU coreutils before 9.5 (and other `mv` implementations) reject the option
 * as unrecognized. That says nothing about the target filesystem, so the live
 * exchange primitive retries through the glibc `renameat2` wrapper instead of
 * reporting an `unknown` refusal. Any other failure is the host's answer.
 *
 * **Example** (Recognize a missing option)
 *
 * ```ts
 * import { modelsExchangeOptionMissing } from "@beep/repo-cli/commands/Models/Models.apply.service"
 *
 * console.log(modelsExchangeOptionMissing(1, "mv: unrecognized option '--exchange'")) // true
 * console.log(modelsExchangeOptionMissing(1, "mv: cannot exchange 'a' and 'b': Invalid argument")) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modelsExchangeOptionMissing: {
  (stderr: string): (code: number) => boolean;
  (code: number, stderr: string): boolean;
} = dual(
  2,
  (code: number, stderr: string): boolean => code !== 0 && /(?:unrecognized|unknown|invalid) option/i.test(stderr)
);

const makeExchangeSystemLive = Effect.fn("ModelsExchangeSystem.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const cLocale = { env: { LC_ALL: "C" }, extendEnv: true, stdin: "ignore" } as const;
  const mount: ModelsExchangeSystemShape["mount"] = Effect.fnUntraced(function* (target) {
    const mountError = ModelsExchangeProbeError.mapError("Cannot read the mount table for the target.", target);
    const actual = yield* fs.realPath(target).pipe(mountError);
    const table = yield* fs.readFileString("/proc/self/mountinfo").pipe(mountError);
    return yield* O.match(modelsExchangeMountOf(table, actual), {
      onNone: () =>
        ModelsExchangeProbeError.make({ message: "No mount table entry contains the target.", path: target }),
      onSome: Effect.succeed,
    });
  });
  const identify: ModelsExchangeSystemShape["identify"] = Effect.fnUntraced(function* (directory) {
    const info = yield* fs
      .stat(directory)
      .pipe(ModelsExchangeProbeError.mapError("Cannot identify the target filesystem.", directory));
    const reported = yield* spawner
      .string(
        ChildProcess.make("stat", ["--file-system", "--format=%T", "--", directory], { ...cLocale, stderr: "ignore" })
      )
      .pipe(Effect.map(Str.trim), Effect.option);
    return ModelsExchangeFilesystemIdentity.make({
      mount: (yield* mount(directory)).id,
      device: info.dev,
      filesystemType: O.filter(reported, Str.isNonEmpty),
    });
  });
  const run = (command: string, args: ReadonlyArray<string>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(command, args, { ...cLocale, stdout: "ignore", stderr: "pipe" })
        );
        return yield* Effect.all([collectText(handle.stderr), handle.exitCode], { concurrency: "unbounded" });
      })
    ).pipe(
      Effect.mapError((error) =>
        ModelsExchangeLaunchError.make({ message: `Cannot run ${command}: ${error.message}`, cause: error })
      )
    );
  const exchange: ModelsExchangeSystemShape["exchange"] = Effect.fnUntraced(function* (left, right) {
    // `--no-target-directory` keeps a directory operand from being read as a
    // destination folder, so two directories are exchanged rather than nested.
    const mv = yield* run("mv", ["--exchange", "--no-copy", "--no-target-directory", "--", left, right]);
    // An mv that predates `--exchange` gives no verdict about the filesystem;
    // the glibc renameat2 wrapper answers the same question when python3 exists.
    const [stderr, code] = modelsExchangeOptionMissing(mv[1], mv[0])
      ? yield* run("python3", ["-I", "-S", "-c", renameExchangeScript, left, right]).pipe(
          Effect.orElseSucceed(() => mv)
        )
      : mv;
    if (code === 0) return;
    return yield* O.match(modelsExchangeHostRefusal(code, stderr), {
      onNone: () =>
        ModelsExchangeLaunchError.make({
          message: `mv --exchange exited ${code} without a host refusal${Str.isNonEmpty(Str.trim(stderr)) ? `: ${Str.trim(stderr)}` : "."}`,
        }),
      onSome: (reason) => ModelsExchangeFault.make({ reason, message: Str.trim(stderr) }),
    });
  });
  return { identify, mount, exchange } satisfies ModelsExchangeSystemShape;
});

const makeAtomicExchangeLive = () => makeExchangeSystemLive().pipe(Effect.flatMap(makeModelsAtomicExchange));

/**
 * GNU mv exchange with a cached, fail-closed, per-target-filesystem capability probe.
 *
 * **Example** (Inspect the live capability layer)
 *
 * ```ts
 * import { ModelsAtomicExchangeLive } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ModelsAtomicExchangeLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsAtomicExchangeLive = Layer.effect(ModelsAtomicExchange, makeAtomicExchangeLive());

/**
 * The atomic-exchange capability in context, or the live one when none is provided.
 *
 * **Details**
 *
 * Every journaled writer (the `beep models` writer and the skills projection
 * writer) takes its capability this way, so a test or a fixture that provides
 * {@link ModelsAtomicExchange} replaces the host primitives for all of them,
 * and {@link ModelsAtomicExchange.qualify} stays the only capability gate.
 *
 * **Example** (Resolve the capability)
 *
 * ```ts
 * import { modelsAtomicExchangeOrLive } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(modelsAtomicExchangeOrLive)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const modelsAtomicExchangeOrLive = Effect.serviceOption(ModelsAtomicExchange).pipe(
  Effect.flatMap(O.match({ onNone: makeAtomicExchangeLive, onSome: Effect.succeed }))
);

const makeApply = Effect.fn("ModelsApply.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Digest.Digest;
  const validate = validateSyntax;
  const eligibility = (
    file: string,
    writes: ReadonlyArray<ModelsLocatorWrite>,
    sourceFile = file,
    operation: "apply" | "restore" = "apply"
  ) =>
    modelsEligibility(file, writes, sourceFile, operation).pipe(
      Effect.filterOrFail(ModelsEligibilityResult.guards.eligible, (result) =>
        ModelsLocatorError.make({
          reason: "ineligible",
          path: file,
          message: `Ineligible native target: ${result._tag === "eligible" ? "Unexpected eligible refusal." : result.message}`,
        })
      ),
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path)
    );
  const hashBytes = Effect.fnUntraced(function* (bytes: Uint8Array) {
    return Hex.encode(
      yield* crypto
        .digest(Digest.sha256, asArrayBufferView(bytes))
        .pipe(ModelsLocatorError.mapError("Cannot fingerprint configuration."))
    );
  });
  const hash = (text: string) => hashBytes(textBytes(text));
  const io = ModelsLocatorError.mapError("Native configuration I/O failed.");
  // Durable writes, journal records and owner liveness are the shared ledger
  // primitives, built over this writer's FileSystem.
  const ledger = yield* makePublicationLedger();
  const writeDurable = (file: string, bytes: Uint8Array) => ledger.writeDurable(file, bytes).pipe(io);
  const readNative = Effect.fnUntraced(function* (file: string) {
    const bytes = yield* fs.readFile(file).pipe(io);
    return yield* modelsNativeText(bytes);
  });
  const suffix = Effect.map(publicationSuffix, (unique) => `models-${unique}`);

  const { exchange, qualify } = yield* modelsAtomicExchangeOrLive;
  // The retained fail-closed boundary: every write and restore qualifies its
  // actual target filesystem before any backup, journal, staging or exchange.
  const requireExchange = Effect.fnUntraced(function* (target: string) {
    const qualification = yield* qualify(target).pipe(
      Effect.mapError((error) =>
        ModelsLocatorError.make({
          reason: "exchange-probe-failed",
          path: target,
          message: `Atomic exchange capability unknown; refusing native write before backup or publication: ${error.message}`,
        })
      )
    );
    const { capability } = qualification;
    if (capability._tag === "unsupported")
      return yield* ModelsLocatorError.make({
        reason: "exchange-unsupported",
        path: target,
        message: `Atomic exchange unsupported on the target filesystem (${capability.reason}: ${capability.detail}); refusing native write before backup or publication.`,
      });
    return qualification;
  });
  const sameInode = (left: FileSystem.File.Info, right: FileSystem.File.Info) =>
    O.isSome(left.ino) && O.isSome(right.ino) && left.dev === right.dev && left.ino.value === right.ino.value;

  const matches = Effect.fnUntraced(function* (file: string, info: FileSystem.File.Info, expectedHash: string) {
    // stat follows a link, while exchange moves the link itself. Never accept a
    // displaced symlink merely because its target has the planned inode/hash.
    if (O.isSome(yield* fs.readLink(file).pipe(Effect.option))) return false;
    return sameInode(info, yield* fs.stat(file).pipe(io)) && (yield* hash(yield* readNative(file))) === expectedHash;
  });

  const recoverSymlink = Effect.fnUntraced(function* (
    file: string,
    temporary: string,
    info: FileSystem.File.Info,
    expectedHash: string
  ) {
    yield* exchange(temporary, file);
    if (!(yield* matches(temporary, info, expectedHash)))
      return yield* failure("Concurrent recovery changed during symlink exchange.");
  });

  // Recovery returns each actual displaced pathname occupant through another
  // verified exchange, preserving both files if contention continues.
  const recover = Effect.fnUntraced(function* (
    file: string,
    temporary: string,
    initialInfo: FileSystem.File.Info,
    initialHash: string
  ) {
    let expectedInfo = initialInfo;
    let expectedHash = initialHash;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (!(yield* matches(file, expectedInfo, expectedHash))) break;
      if (O.isSome(yield* fs.readLink(temporary).pipe(Effect.option))) {
        yield* recoverSymlink(file, temporary, expectedInfo, expectedHash);
        break;
      }
      const returningInfo = yield* fs.stat(temporary).pipe(io);
      const returningHash = yield* hash(yield* readNative(temporary));
      yield* exchange(temporary, file);
      if (yield* matches(temporary, expectedInfo, expectedHash)) break;
      expectedInfo = returningInfo;
      expectedHash = returningHash;
    }
  });

  const assertDestination = Effect.fnUntraced(function* (journal: ModelsApplyJournal) {
    const actual = yield* fs.realPath(journal.file).pipe(io);
    const link = yield* fs.readLink(journal.file).pipe(Effect.option);
    const info = yield* fs.stat(journal.file).pipe(io);
    if (actual !== journal.file || O.isSome(link) || info.type !== "File")
      return yield* failure("Canonical native destination changed; refusing replacement.");
    if (O.isNone(journal.requestedFile))
      return yield* failure("Recovery journal lacks destination identity; refusing replacement.");
    const requested = yield* fs.realPath(journal.requestedFile.value).pipe(io);
    const requestedLink = yield* fs.readLink(journal.requestedFile.value).pipe(Effect.option);
    if (
      requested !== journal.file ||
      !O.makeEquivalence<string>((left, right) => left === right)(requestedLink, journal.requestedLink)
    )
      return yield* failure("Requested native entry or link target changed; refusing replacement.");
  });

  // Journal publication: an fsynced sibling file, then an exclusive link for the
  // first state or a rename for every later one, then a directory fsync.
  const publishJournal = Effect.fnUntraced(function* (
    backupDirectory: string,
    journal: ModelsApplyJournal,
    exclusive: boolean
  ) {
    const encoded = yield* encodeJournal(journal).pipe(ModelsLocatorError.mapError("Cannot encode recovery journal."));
    yield* ledger.publishRecord(backupDirectory, `${journal.id}.json`, textBytes(encoded), exclusive).pipe(io);
  });

  const publicationOf = (journal: ModelsApplyJournal, role: ModelsPublicationRole) =>
    role === "publication" ? O.liftPredicate(journal.publication, isTrackedPublication) : journal.restoration;

  const withPublication = (
    journal: ModelsApplyJournal,
    role: ModelsPublicationRole,
    publication: ModelsTrackedPublication
  ) =>
    ModelsApplyJournal.make(
      role === "publication" ? { ...journal, publication } : { ...journal, restoration: O.some(publication) }
    );

  // The ledger owns the latest journal for one publication and durably writes
  // each next state before the caller performs the step it guards.
  const makeLedger = (
    backupDirectory: string,
    journal: ModelsApplyJournal,
    role: ModelsPublicationRole,
    publication: ModelsTrackedPublication
  ) => {
    let current = { journal, publication };
    const advance = (state: ModelsPublicationState) =>
      Effect.suspend(() => {
        const next = ModelsTrackedPublication.make({ ...current.publication, state });
        current = { journal: withPublication(current.journal, role, next), publication: next };
        return publishJournal(backupDirectory, current.journal, false);
      });
    return { advance, journal: () => current.journal, state: () => current.publication.state };
  };

  const artifactNames = (file: string, operation: string) => ({
    operation,
    staging: `${file}.${operation}.tmp`,
    retained: `${file}.${operation}.preimage`,
  });

  const { currentOwner, ownerAlive } = ledger;

  const observe = Effect.fnUntraced(function* (file: string) {
    if (O.isSome(yield* fs.readLink(file).pipe(Effect.option))) return Observation.cases.foreign.make({});
    const info = yield* fs.stat(file).pipe(Effect.option);
    if (O.isNone(info)) return Observation.cases.absent.make({});
    if (info.value.type !== "File") return Observation.cases.foreign.make({});
    return Observation.cases.file.make({ hash: yield* hashBytes(yield* fs.readFile(file).pipe(io)) });
  });
  // Removal tolerates an artifact another recoverer or a cleanup already removed.
  const discard = (file: string) => ledger.discard(file).pipe(io);

  // The exclusive per-journal recovery lock `<id>.recovering` is the shared
  // ledger's: a fsynced owner stamp published with `link`, where only EEXIST
  // means "held" and every other failure is a typed `lock-unavailable` refusal.
  const recoveryLock = (backupDirectory: string, id: string) =>
    ledger.recoveryLock(backupDirectory, id).pipe(
      Effect.catchTags({
        PublicationLockUnavailable: (error) =>
          ModelsLocatorError.make({ reason: "lock-unavailable", path: error.path, message: error.message }),
        PlatformError: (error) => Effect.fail(error).pipe(io),
      })
    );

  // Recorded paths must be this journal's own artifacts beside its own target,
  // so a tampered journal can never steer a removal or an exchange elsewhere.
  const ownsArtifacts = Effect.fnUntraced(function* (
    backupDirectory: string,
    journal: ModelsApplyJournal,
    role: ModelsPublicationRole,
    publication: ModelsTrackedPublication
  ) {
    const prefix = `${path.basename(journal.file)}.${journal.id}-`;
    const beside = (file: string, extension: string) =>
      path.dirname(file) === path.dirname(journal.file) &&
      Str.startsWith(prefix)(path.basename(file)) &&
      Str.endsWith(extension)(file);
    // The backup directory may be named through a symlink by one caller and
    // resolved by another, so compare resolved directories.
    const resolved = (directory: string) => fs.realPath(directory).pipe(Effect.option);
    const ownBackup = (backup: string) =>
      Effect.zipWith(
        resolved(path.dirname(backup)),
        resolved(backupDirectory),
        (recorded, actual) => O.isSome(recorded) && O.contains(actual, recorded.value)
      ).pipe(Effect.map((same) => same && role === "publication" && path.basename(backup) === `${journal.id}.backup`));
    const backupOwned = yield* O.match(publication.backup, { onNone: () => Effect.succeed(true), onSome: ownBackup });
    return (
      backupOwned &&
      publication.target === journal.file &&
      beside(publication.staging, ".tmp") &&
      beside(publication.retained, ".preimage")
    );
  });

  const refuse = (reason: ModelsRecoveryRefusal, detail: string) =>
    ModelsRecoveryResult.cases.refused.make({ reason, detail });

  // A foreign file the exchange displaced into the stage goes back to the live
  // path through another qualified exchange; the publication is then refused.
  const returnDisplaced = Effect.fnUntraced(function* (publication: ModelsTrackedPublication, foreign: string) {
    const qualification = yield* requireExchange(publication.target);
    if (modelsExchangeIdentityKey(qualification.identity) !== publication.filesystem)
      return refuse("filesystem-changed", "Target filesystem identity changed since intent; no exchange attempted.");
    yield* exchange(publication.staging, publication.target);
    const returned = yield* observe(publication.target);
    return refuse(
      "competing-writer",
      returned._tag === "file" && returned.hash === foreign
        ? "A displaced native writer was returned to the live path; the stage keeps the staged content."
        : "A displaced native writer could not be confirmed on the live path; every artifact is kept."
    );
  });

  // Which recorded content the live target holds, or why recovery must refuse.
  const liveOutcome = (publication: ModelsTrackedPublication, target: Observation) =>
    Match.value(target).pipe(
      Match.tagsExhaustive({
        absent: () => Result.fail(refuse("target-missing", "The native target is missing; nothing was moved.")),
        foreign: () => Result.fail(refuse("competing-writer", "The native target is no longer a regular file.")),
        file: ({ hash: live }) =>
          live === publication.preimageHash
            ? Result.succeed<ModelsRecoveryOutcome>("preimage")
            : live === publication.stagedHash
              ? Result.succeed<ModelsRecoveryOutcome>("intended")
              : Result.fail(
                  refuse("competing-writer", "Target bytes match neither the preimage nor the staged content.")
                ),
      })
    );

  // Drop the stage and preimage link; a publication that never landed also
  // drops its backup, which only copies the unchanged target.
  const finish = Effect.fnUntraced(function* (publication: ModelsTrackedPublication, outcome: ModelsRecoveryOutcome) {
    yield* discard(publication.staging);
    yield* discard(publication.retained);
    if (outcome === "preimage") yield* Effect.forEach(O.toArray(publication.backup), discard, { discard: true });
    return ModelsRecoveryResult.cases.recovered.make({ outcome });
  });

  // Decide from the bytes on disk, never from the recorded step alone: the step
  // only says which artifacts may exist.
  const settle = Effect.fnUntraced(function* (
    backupDirectory: string,
    journal: ModelsApplyJournal,
    role: ModelsPublicationRole,
    publication: ModelsTrackedPublication
  ) {
    if (!(yield* ownsArtifacts(backupDirectory, journal, role, publication)))
      return refuse("foreign-artifact", "Recorded recovery paths are not this journal's own artifacts.");
    const known = (observation: Observation) =>
      observation._tag === "absent" ||
      (observation._tag === "file" && A.contains([publication.preimageHash, publication.stagedHash], observation.hash));
    const live = liveOutcome(publication, yield* observe(publication.target));
    if (Result.isFailure(live)) return live.failure;
    if (!known(yield* observe(publication.retained)))
      return refuse("foreign-artifact", "The retained preimage link holds foreign bytes.");
    const staging = yield* observe(publication.staging);
    if (live.success === "intended" && staging._tag === "file" && !known(staging))
      return yield* returnDisplaced(publication, staging.hash);
    if (!known(staging)) return refuse("foreign-artifact", "The stage holds foreign bytes.");
    return yield* finish(publication, live.success);
  });

  const fromStep = (state: ModelsPublicationState): ModelsPublicationStep =>
    isRecoveryState(state) ? state.from : state._tag;

  // Reconcile one publication the caller holds the recovery lock for. It
  // records `recovering` before changing anything, so a crash during recovery is
  // reconciled again from the bytes on disk.
  const reconcileLocked = Effect.fnUntraced(function* (
    backupDirectory: string,
    journal: ModelsApplyJournal,
    role: ModelsPublicationRole,
    publication: ModelsTrackedPublication
  ) {
    // Only a pending publication can still be in its owner's hands; a refusal
    // is terminal whoever wrote it.
    if (pendingState(publication.state) && (yield* ownerAlive(publication.owner)))
      return { journal, result: ModelsRecoveryResult.cases.skipped.make({ reason: "owner-alive" }) };
    const from = fromStep(publication.state);
    const ledger = makeLedger(
      backupDirectory,
      journal,
      role,
      ModelsTrackedPublication.make({ ...publication, owner: yield* currentOwner })
    );
    yield* ledger.advance(ModelsPublicationState.cases.recovering.make({ from }));
    const result = yield* settle(backupDirectory, journal, role, publication);
    yield* ledger.advance(
      result._tag === "recovered"
        ? ModelsPublicationState.cases.recovered.make({ from, outcome: result.outcome })
        : ModelsPublicationState.cases.refused.make({ from, reason: result.reason, detail: result.detail })
    );
    const stale = A.filter(
      yield* fs.readDirectory(backupDirectory).pipe(io),
      (entry) => Str.startsWith(`${journal.id}.json.`)(entry) && Str.endsWith(".partial")(entry)
    );
    yield* Effect.forEach(stale, (entry) => discard(path.join(backupDirectory, entry)), { discard: true });
    return { journal: ledger.journal(), result };
  });

  // The one reconciliation path behind automatic recovery, `recover` and
  // `restore`. The exclusive recovery lock is taken before the owner check and
  // the journal is re-read under it, so two recoverers never settle one
  // publication twice; the loser reports `lock-held` or `settled`.
  const reconcile = (
    backupDirectory: string,
    journal: ModelsApplyJournal,
    role: ModelsPublicationRole,
    eligible: (state: ModelsPublicationState) => boolean
  ) =>
    Effect.scoped(
      Effect.gen(function* () {
        if (!(yield* recoveryLock(backupDirectory, journal.id)))
          return { journal, result: ModelsRecoveryResult.cases.skipped.make({ reason: "lock-held" }) };
        const fresh = O.getOrElse(yield* readJournalEntry(backupDirectory, `${journal.id}.json`), () => journal);
        const publication = O.filter(publicationOf(fresh, role), (entry) => eligible(entry.state));
        if (O.isNone(publication))
          return { journal: fresh, result: ModelsRecoveryResult.cases.skipped.make({ reason: "settled" }) };
        return yield* reconcileLocked(backupDirectory, fresh, role, publication.value);
      })
    );

  // Undecodable or misnamed journals are not this writer's to judge.
  const readJournalEntry = (backupDirectory: string, entry: string) =>
    fs
      .readFileString(path.join(backupDirectory, entry))
      .pipe(
        Effect.flatMap(decodeJournal),
        Effect.option,
        Effect.map(O.filter((journal) => entry === `${journal.id}.json`))
      );

  // Reconcile each pending publication of one journal, threading the journal
  // each reconciliation rewrote into the next.
  const reconcileJournal = Effect.fnUntraced(function* (backupDirectory: string, initial: ModelsApplyJournal) {
    if (!isTrackedPublication(initial.publication))
      return [
        ModelsRecoveryReport.make({
          journal: initial.id,
          role: "publication",
          result: ModelsRecoveryResult.cases.skipped.make({ reason: "legacy" }),
        }),
      ];
    // An abandoned publication's backup copies an untouched target; a writer that
    // died between recording `abandoned` and dropping it leaves it for here.
    if (initial.publication.state._tag === "abandoned") {
      if (!(yield* ownsArtifacts(backupDirectory, initial, "publication", initial.publication)))
        return [
          ModelsRecoveryReport.make({
            journal: initial.id,
            role: "publication",
            result: refuse(
              "foreign-artifact",
              "Abandoned publication contains a foreign artifact; nothing was removed."
            ),
          }),
        ];
      yield* Effect.forEach(O.toArray(initial.publication.backup), discard, { discard: true });
    }
    let journal = initial;
    const reports: Array<ModelsRecoveryReport> = [];
    for (const role of ModelsPublicationRole.literals) {
      if (!O.exists(publicationOf(journal, role), (publication) => pendingState(publication.state))) continue;
      const settled = yield* reconcile(backupDirectory, journal, role, pendingState);
      journal = settled.journal;
      reports.push(ModelsRecoveryReport.make({ journal: journal.id, role, result: settled.result }));
    }
    return reports;
  });

  const sweep = Effect.fnUntraced(function* (backupDirectory: string, target: O.Option<string>) {
    if (!(yield* fs.exists(backupDirectory).pipe(io))) return A.empty<ModelsRecoveryReport>();
    const entries = A.sort(
      A.filter(yield* fs.readDirectory(backupDirectory).pipe(io), Str.endsWith(".json")),
      Order.String
    );
    const journals = A.filter(
      A.getSomes(yield* Effect.forEach(entries, (entry) => readJournalEntry(backupDirectory, entry))),
      (journal) => O.isNone(target) || journal.file === target.value
    );
    return A.flatten(yield* Effect.forEach(journals, (journal) => reconcileJournal(backupDirectory, journal)));
  });

  const atomic = Effect.fnUntraced(function* (
    names: { readonly operation: string; readonly staging: string; readonly retained: string },
    beforeHash: string,
    after: string,
    mode: number,
    journal: ModelsApplyJournal,
    backupDirectory: string,
    writes: ReadonlyArray<ModelsLocatorWrite>,
    advance: (state: ModelsPublicationState) => Effect.Effect<void, ModelsLocatorError>,
    progress: { exchanged: boolean }
  ) {
    const file = journal.file;
    const { operation, staging: temporary, retained } = names;
    let exchanged = false;
    let completed = false;
    yield* Effect.acquireUseRelease(
      assertDestination(journal).pipe(Effect.andThen(fs.link(file, retained).pipe(io))),
      Effect.fnUntraced(function* () {
        const plannedInfo = yield* fs.stat(retained).pipe(io);
        return yield* Effect.acquireUseRelease(
          writeDurable(temporary, textBytes(after)),
          Effect.fnUntraced(function* () {
            const staged = yield* readNative(temporary);
            if (staged !== after) return yield* failure("Staged configuration differs from the validated candidate.");
            yield* validate(staged, writes);
            yield* assertDestination(journal);
            yield* fs.chmod(temporary, mode).pipe(io);
            const stagedInfo = yield* fs.stat(temporary).pipe(io);
            if (
              (yield* hash(yield* readNative(file))) !== beforeHash ||
              (yield* hash(yield* readNative(retained))) !== beforeHash
            )
              return yield* failure("Native file drifted after planning; refusing replacement.");
            yield* advance(ModelsPublicationState.cases.staged.make({}));
            yield* Effect.uninterruptible(
              Effect.gen(function* () {
                // Once publication starts, a failed process observation is uncertain:
                // retain both occupants even if mv cannot report its final status.
                exchanged = true;
                progress.exchanged = true;
                yield* exchange(temporary, file);
                yield* advance(ModelsPublicationState.cases.exchanged.make({}));
                if (!(yield* matches(temporary, plannedInfo, beforeHash))) {
                  yield* fs
                    .writeFileString(
                      path.join(backupDirectory, `${operation}.concurrent`),
                      `journal=${journal.id}\nretained=${retained}\ndisplaced=${temporary}\nevent=concurrent-native-write\n`,
                      { flag: "wx", mode: 0o600 }
                    )
                    .pipe(io);
                  yield* recover(file, temporary, stagedInfo, yield* hash(after));
                  return yield* failure("Concurrent native write detected; recovery event retained.");
                }
                if (!(yield* matches(file, stagedInfo, yield* hash(after))))
                  return yield* failure("Native file changed after replacement; preserve journal for recovery.");
                yield* advance(ModelsPublicationState.cases.verified.make({}));
                completed = true;
              })
            );
          }),
          () => (!exchanged || completed ? Effect.ignore(fs.remove(temporary)) : Effect.void)
        );
      }),
      () => (!exchanged || completed ? Effect.ignore(fs.remove(retained)) : Effect.void)
    ).pipe(
      Effect.andThen(advance(ModelsPublicationState.cases.completed.make({}))),
      Effect.mapError((error) => failure(`${error.message} Journal: ${journal.id}`))
    );
  });

  // A publication that fails before its exchange never touched the target, and
  // atomic's releases already dropped its stage and preimage link: record the
  // terminal `abandoned` state, then drop the backup of the unchanged target. A
  // failure to record keeps the original error and the pending journal.
  const abandonUnexchanged =
    (ledger: ReturnType<typeof makeLedger>, progress: { readonly exchanged: boolean }, backup: O.Option<string>) =>
    (error: ModelsLocatorError) =>
      progress.exchanged
        ? Effect.void
        : ledger
            .advance(
              ModelsPublicationState.cases.abandoned.make({ from: fromStep(ledger.state()), detail: error.message })
            )
            .pipe(Effect.andThen(Effect.forEach(O.toArray(backup), discard, { discard: true })), Effect.ignore);

  // Automatic recovery: reconcile this target's interrupted publications before
  // reading the bytes a write is planned from. A refusal keeps its artifacts and
  // does not block the write, which edits only owned fields of the live bytes.
  const recoverTarget = Effect.fnUntraced(function* (file: string, backupDirectory: string) {
    const reports = yield* fs.realPath(file).pipe(
      Effect.option,
      Effect.flatMap((resolved) => (O.isSome(resolved) ? sweep(backupDirectory, resolved) : Effect.succeed([])))
    );
    yield* Effect.forEach(
      A.filter(reports, (entry) => entry.result._tag === "refused"),
      (entry) => Effect.logWarning(`models: recovery refused ${entry.journal} (${entry.role}); artifacts kept`),
      { discard: true }
    );
  });

  // Record intent, take the durable backup, then publish through the ledger.
  const publishApply = Effect.fnUntraced(function* (
    file: string,
    actual: string,
    before: string,
    after: string,
    writes: A.NonEmptyReadonlyArray<ModelsLocatorWrite>,
    backupDirectory: string
  ) {
    const qualification = yield* requireExchange(actual);
    const info = yield* fs.stat(actual).pipe(io);
    const id = yield* suffix;
    yield* fs.makeDirectory(backupDirectory, { recursive: true, mode: 0o700 }).pipe(io);
    const backup = path.join(backupDirectory, `${id}.backup`);
    const names = artifactNames(actual, `${id}-${yield* suffix}`);
    const beforeHash = yield* hash(before);
    const publication = ModelsTrackedPublication.make({
      state: ModelsPublicationState.cases.intent.make({}),
      owner: yield* currentOwner,
      target: actual,
      staging: names.staging,
      retained: names.retained,
      backup: O.some(backup),
      preimageHash: beforeHash,
      stagedHash: yield* hash(after),
      targetAtIntentHash: yield* hashBytes(yield* fs.readFile(actual).pipe(io)),
      filesystem: modelsExchangeIdentityKey(qualification.identity),
    });
    const journal = ModelsApplyJournal.make({
      id,
      file: actual,
      backup,
      beforeHash,
      afterHash: publication.stagedHash,
      mode: info.mode,
      writes: O.some(writes),
      requestedFile: O.some(path.resolve(file)),
      requestedLink: yield* fs.readLink(file).pipe(Effect.option),
      publication,
      restoration: O.none(),
    });
    const ledger = makeLedger(backupDirectory, journal, "publication", publication);
    const progress = { exchanged: false };
    yield* publishJournal(backupDirectory, journal, true);
    yield* writeDurable(backup, textBytes(before)).pipe(
      Effect.andThen(ledger.advance(ModelsPublicationState.cases["backed-up"].make({}))),
      Effect.mapError((error) => failure(`${error.message} Journal: ${id}`)),
      Effect.andThen(
        atomic(names, beforeHash, after, info.mode, journal, backupDirectory, writes, ledger.advance, progress)
      ),
      Effect.tapError(abandonUnexchanged(ledger, progress, O.some(backup)))
    );
    return ledger.journal();
  });

  const apply: ModelsApplyShape["apply"] = Effect.fn("ModelsApply.apply")(
    function* (file, writes, mode, backupDirectory) {
      if (mode === "write")
        yield* modelsWritePreflight(
          file,
          A.map(writes, (write) => write.locator)
        ).pipe(Effect.provideService(Path.Path, path), Effect.andThen(recoverTarget(file, backupDirectory)));
      const nativeWrites = A.filter(writes, ({ locator }) => O.isNone(modelsCheckOnlyFormat(locator)));
      const eligible = A.isReadonlyArrayNonEmpty(nativeWrites)
        ? yield* eligibility(file, nativeWrites)
        : { actual: yield* fs.realPath(file).pipe(io), content: yield* readNative(file), removalsPresent: false };
      const { actual, content: before } = eligible;
      if (mode === "check") {
        yield* checkReadOnlyDrift(before, writes);
        if (eligible.removalsPresent) return yield* failure("Owned configuration drift detected.");
        yield* assertParsedProjection(before, nativeWrites).pipe(
          Effect.mapError(() => failure("Owned configuration drift detected."))
        );
        return O.none();
      }
      const spans = yield* Effect.forEach(nativeWrites, (write) => modelsWriteSpans(before, write), {
        concurrency: 1,
      }).pipe(Effect.map(A.flatten));
      const after = yield* modelsApplySpans(before, spans);
      yield* validate(after, writes);
      yield* assertNativeFields(before, after, writes);
      // Re-resolve every address in the candidate. Replacing only those spans with
      // the old scalar bytes must reconstruct the complete original native file.
      yield* assertOwnedBytes(before, after, nativeWrites, spans);
      if (after === before) return O.none();
      if (mode === "dry-run") return O.none();
      if (!A.isReadonlyArrayNonEmpty(writes)) return yield* failure("Locator ownership must be non-empty.");
      return O.some(yield* publishApply(file, actual, before, after, writes, backupDirectory));
    }
  );

  const recoveryWrites = Effect.fnUntraced(function* (journal: ModelsApplyJournal) {
    if (O.isNone(journal.writes))
      return yield* failure("Legacy journal lacks locator ownership; shell targets are check-only; edit by hand.");
    if (A.isReadonlyArrayEmpty(journal.writes.value)) return yield* failure("Locator ownership must be non-empty.");
    yield* modelsWritePreflight(
      journal.file,
      A.map(journal.writes.value, (write) => write.locator)
    ).pipe(Effect.provideService(Path.Path, path));
    if (O.isSome(journal.requestedFile))
      yield* modelsWritePreflight(
        journal.requestedFile.value,
        A.map(journal.writes.value, (write) => write.locator)
      ).pipe(Effect.provideService(Path.Path, path));
    return journal.writes.value;
  });

  const recoveryRefusal = (result: ModelsRecoveryResult) =>
    Match.value(result).pipe(
      Match.tagsExhaustive({
        recovered: () => Effect.void,
        skipped: ({ reason }) =>
          reason === "settled"
            ? Effect.void
            : ModelsLocatorError.make({
                reason: reason === "lock-held" ? "lock-held" : "owner-alive",
                message:
                  reason === "lock-held"
                    ? "Another live process holds this journal's recovery lock; refusing recovery."
                    : "The publication's owning process is still running; refusing recovery.",
              }),
        refused: ({ detail, reason }) =>
          ModelsLocatorError.make({
            reason,
            message: `Recovery refused (${reason}): ${detail} Every artifact is kept.`,
          }),
      })
    );

  // Manual recovery takes the same reconciliation path as automatic recovery,
  // and also retries a publication automatic recovery refused.
  const reconcileForRestore = Effect.fnUntraced(function* (root: string, initial: ModelsApplyJournal) {
    let journal = initial;
    let restored = false;
    for (const role of ModelsPublicationRole.literals) {
      if (!O.exists(publicationOf(journal, role), (publication) => retryableState(publication.state))) continue;
      const settled = yield* reconcile(root, journal, role, retryableState);
      yield* recoveryRefusal(settled.result);
      journal = settled.journal;
      restored = role === "restoration" && settled.result._tag === "recovered" && settled.result.outcome === "intended";
    }
    return { journal, restored };
  });

  // A publication recovered to its preimage, or abandoned before its exchange,
  // never landed: nothing to restore.
  const neverLanded = (journal: ModelsApplyJournal) =>
    isTrackedPublication(journal.publication) &&
    ((journal.publication.state._tag === "recovered" && journal.publication.state.outcome === "preimage") ||
      journal.publication.state._tag === "abandoned");

  // The fingerprint-fenced undo, published as the journal's restoration.
  const undo = Effect.fnUntraced(function* (root: string, journal: ModelsApplyJournal) {
    const writes = yield* recoveryWrites(journal);
    yield* assertDestination(journal);
    const backup = yield* fs.realPath(journal.backup).pipe(io);
    if (path.dirname(backup) !== root || path.basename(backup) !== `${journal.id}.backup`)
      return yield* failure("Recovery backup is outside its journal directory.");
    const { content: current } = yield* eligibility(journal.file, writes, journal.file, "restore");
    const currentHash = yield* hash(current);
    if (currentHash !== journal.afterHash)
      return yield* failure("Native file changed since apply; restore would overwrite new state.");
    const { content: original } = yield* eligibility(journal.file, writes, backup, "restore");
    if ((yield* hash(original)) !== journal.beforeHash) return yield* failure("Recovery backup hash does not match.");
    const qualification = yield* requireExchange(journal.file);
    const names = artifactNames(journal.file, `${journal.id}-${yield* suffix}`);
    const restoration = ModelsTrackedPublication.make({
      state: ModelsPublicationState.cases.intent.make({}),
      owner: yield* currentOwner,
      target: journal.file,
      staging: names.staging,
      retained: names.retained,
      backup: O.none(),
      preimageHash: journal.afterHash,
      stagedHash: journal.beforeHash,
      targetAtIntentHash: currentHash,
      filesystem: modelsExchangeIdentityKey(qualification.identity),
    });
    const restoring = withPublication(journal, "restoration", restoration);
    const ledger = makeLedger(root, restoring, "restoration", restoration);
    const progress = { exchanged: false };
    const mode = (yield* fs.stat(journal.file).pipe(io)).mode;
    yield* publishJournal(root, restoring, false);
    yield* atomic(names, journal.afterHash, original, mode, restoring, root, [], ledger.advance, progress).pipe(
      Effect.tapError(abandonUnexchanged(ledger, progress, O.none()))
    );
  });

  const restore: ModelsApplyShape["restore"] = Effect.fn("ModelsApply.restore")(
    function* (journalFile, backupDirectory) {
      const root = yield* fs.realPath(backupDirectory).pipe(io);
      const actualJournal = yield* fs.realPath(journalFile).pipe(io);
      if (path.dirname(actualJournal) !== root) return yield* failure("Journal must belong to the backup directory.");
      const decoded = yield* fs.readFileString(actualJournal).pipe(
        io,
        Effect.flatMap(decodeJournal),
        Effect.mapError(() => failure("Invalid recovery journal."))
      );
      yield* Effect.gen(function* () {
        const { journal, restored } = yield* reconcileForRestore(root, decoded);
        if (!restored && !neverLanded(journal)) yield* undo(root, journal);
      }).pipe(
        Effect.mapError((error) =>
          ModelsLocatorError.make({
            ...O.getSomesStruct({ reason: O.fromUndefinedOr(error.reason) }),
            message: Str.includes("Journal:")(error.message)
              ? error.message
              : `${error.message} Journal: ${decoded.id}`,
          })
        )
      );
    }
  );
  const recoverJournals: ModelsApplyShape["recover"] = Effect.fn("ModelsApply.recover")(function* (backupDirectory) {
    return yield* sweep(backupDirectory, O.none());
  });
  return ModelsApply.of({ apply, restore, recover: recoverJournals });
});

/**
 * Platform-backed owned-field writer.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { ModelsApplyLive } from "@beep/repo-cli/commands/Models/Models.apply.service"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ModelsApplyLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsApplyLive = Layer.effect(ModelsApply, makeApply());
