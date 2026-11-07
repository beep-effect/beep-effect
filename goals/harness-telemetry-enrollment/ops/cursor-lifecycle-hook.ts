/**
 * Inert-until-enrolled, stdin-only Cursor callback command. No native launch or backend delivery.
 * The installed command accepts no config arguments or environment-selected policy path.
 * @packageDocumentation
 * @since 0.0.0
 */
import { constants } from "node:fs";
import * as Fs from "node:fs/promises";
import { userInfo } from "node:os";
import { basename, dirname, isAbsolute } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { $RepoCliId } from "@beep/identity/packages";
import {
  CursorLifecyclePolicy,
  CursorLifecycleRuntime,
  forwardCursorLifecycleHook,
  makeCursorLifecycleReceiver,
  projectCursorLifecycleHookInput,
} from "@beep/repo-ai-metrics/cursor-lifecycle";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Fiber from "effect/Fiber";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import type { BigIntStats } from "node:fs";
import type { FileHandle } from "node:fs/promises";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/cursor-lifecycle-hook");
const EnrolledReceiver = S.Struct(Struct.omit(CursorLifecyclePolicy.fields, ["hashSalt"])).pipe(
  $I.annoteSchema("EnrolledReceiver", { description: "Persisted public receiver policy, excluding credential bytes." })
);
/**
 * Receiver-owned enrollment, stored only in the fixed private state root. Callback fields cannot supply it.
 * **Example** (Inspect the enrollment codec)
 * ```ts
 * console.log(typeof CursorCallbackEnrollment.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CursorCallbackEnrollment extends S.Opaque<CursorCallbackEnrollment, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("cursor-callback-enrollment/v2"),
    state: S.Literals(["paused", "active"]),
    expiresAtMillis: S.Natural,
    receiver: EnrolledReceiver,
    saltCredentialFile: S.NonEmptyString.check(S.isMaxLength(4096)),
    intake: TranscriptIntakeConfig,
    callbackExecutable: S.NonEmptyString.check(S.isMaxLength(4096)),
    callbackSha256: CursorLifecyclePolicy.fields.runtimeSha256,
    leaseDevice: S.String.check(S.isPattern(/^[0-9]+$/)),
    leaseInode: S.String.check(S.isPattern(/^[0-9]+$/)),
  }).pipe(
    $I.annoteSchema("CursorCallbackEnrollment", {
      description: "Owner policy and expiry, never callback JSON or an inferred native identity.",
    })
  )
) {}
/**
 * Finite silent command refusal, with no callback body, policy, paths or exception text.
 * **Example** (Inspect a refusal)
 * ```ts
 * console.log(CursorCallbackError.make({ reason: "paused" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CursorCallbackError extends S.TaggedError<CursorCallbackError, { readonly brand: unique symbol }>(
  $I`CursorCallbackError`
)(
  "CursorCallbackError",
  { reason: S.Literals(["input", "enrollment", "expired", "paused", "busy", "storage", "callback", "cleanup"]) },
  $I.annote("CursorCallbackError", { description: "Payload-free callback boundary failure." })
) {}
const failure = (reason: CursorCallbackError["reason"]) => CursorCallbackError.make({ reason });
const io = <A>(run: () => Promise<A>, reason: CursorCallbackError["reason"] = "enrollment") =>
  Effect.tryPromise({ try: run, catch: () => failure(reason) });
const decodeEnrollment = S.decodeEffect(S.fromJsonString(CursorCallbackEnrollment), { onExcessProperty: "error" });
const sqliteBusy = S.is(S.Struct({ errcode: S.tag(5) }));
const decodeHash = S.decodeUnknownEffect(Sha256Hex);
const hashBytes = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  return yield* digest.digest(Digest.sha256, bytes).pipe(Effect.map(Hex.encode), Effect.flatMap(decodeHash));
});
const controlPolicy = ObservationControlPolicy.make({ maxActive: 1, drainTimeoutMillis: 1000 });
const platforms = Layer.merge(
  NodeCrypto.layer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(Layer.merge(NodeFileSystem.layer, NodePath.layer)))
);
const sameFile = (a: BigIntStats, b: BigIntStats) =>
  A.every(
    [
      a.dev === b.dev,
      a.ino === b.ino,
      a.uid === b.uid,
      a.mode === b.mode,
      a.size === b.size,
      a.mtimeNs === b.mtimeNs,
      a.ctimeNs === b.ctimeNs,
    ],
    identity
  );
const sameDirectory = (a: BigIntStats, b: BigIntStats) =>
  A.every([a.dev === b.dev, a.ino === b.ino, a.uid === b.uid, a.mode === b.mode], identity);
const ownedFile = (s: BigIntStats, uid: number, maximum: number) =>
  A.every(
    [s.isFile(), s.uid === BigInt(uid), (s.mode & 0o777n) === 0o600n, s.nlink === 1n, s.size <= BigInt(maximum)],
    identity
  );
const readBoundedFile = Effect.fnUntraced(function* (file: FileHandle, maximum: number) {
  const bytes = Buffer.alloc(maximum + 1);
  let offset = 0;
  while (offset <= maximum) {
    const result = yield* io(() => file.read(bytes, offset, bytes.length - offset, null));
    if (result.bytesRead === 0) return bytes.subarray(0, offset);
    offset += result.bytesRead;
  }
  return yield* failure("enrollment");
});
const rootAnchor = Effect.fnUntraced(function* (root: string, uid: number) {
  if ((yield* io(() => Fs.realpath(root))) !== root) return yield* failure("enrollment");
  const before = yield* io(() => Fs.lstat(root, { bigint: true }));
  if (!before.isDirectory() || before.uid !== BigInt(uid) || (before.mode & 0o777n) !== 0o700n)
    return yield* failure("enrollment");
  const handle = yield* io(() => Fs.open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW));
  return { root, uid, before, handle, path: `/proc/self/fd/${handle.fd}` };
});
const requireRoot = Effect.fnUntraced(function* (root: Effect.Success<ReturnType<typeof rootAnchor>>) {
  const current = yield* io(() => Fs.lstat(root.root, { bigint: true }));
  const descriptor = yield* io(() => root.handle.stat({ bigint: true }));
  if (!sameDirectory(root.before, current) || !sameDirectory(root.before, descriptor))
    return yield* failure("enrollment");
});
const readEnrollment = Effect.fnUntraced(function* (root: Effect.Success<ReturnType<typeof rootAnchor>>) {
  return yield* Effect.acquireUseRelease(
    io(() => Fs.open(`${root.path}/enrollment.json`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)),
    Effect.fnUntraced(function* (file) {
      const before = yield* io(() => file.stat({ bigint: true }));
      if (!ownedFile(before, root.uid, 32768) || before.size === 0n) return yield* failure("enrollment");
      const bytes = yield* readBoundedFile(file, 32768);
      const after = yield* io(() => file.stat({ bigint: true }));
      const path = yield* io(() => Fs.lstat(`${root.path}/enrollment.json`, { bigint: true }));
      if (!sameFile(before, after) || !sameFile(before, path)) return yield* failure("enrollment");
      yield* requireRoot(root);
      const text = yield* Effect.try({
        try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        catch: () => failure("enrollment"),
      });
      return yield* decodeEnrollment(text).pipe(Effect.mapError(() => failure("enrollment")));
    }),
    (file) => io(() => file.close(), "cleanup")
  );
});
const readSaltCredential = Effect.fnUntraced(function* (filename: string) {
  const uid = process.getuid?.();
  if (uid === undefined || !isAbsolute(filename) || !Str.endsWith(".credential")(filename))
    return yield* failure("enrollment");
  return yield* Effect.acquireUseRelease(
    rootAnchor(dirname(filename), uid),
    (parent) =>
      Effect.acquireUseRelease(
        io(() =>
          Fs.open(
            `${parent.path}/${basename(filename)}`,
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
          )
        ),
        Effect.fnUntraced(function* (file) {
          const before = yield* io(() => file.stat({ bigint: true }));
          if (!ownedFile(before, uid, 4096) || before.size === 0n) return yield* failure("enrollment");
          const bytes = yield* readBoundedFile(file, 4096);
          const after = yield* io(() => file.stat({ bigint: true }));
          const current = yield* io(() => Fs.lstat(`${parent.path}/${basename(filename)}`, { bigint: true }));
          if (!sameFile(before, after) || !sameFile(before, current)) return yield* failure("enrollment");
          yield* requireRoot(parent);
          const text = yield* Effect.try({
            try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
            catch: () => failure("enrollment"),
          });
          const value = Str.trim(text);
          if (value.length < 16) return yield* failure("enrollment");
          return Redacted.make(value);
        }),
        (file) => io(() => file.close(), "cleanup")
      ),
    (parent) => io(() => parent.handle.close(), "cleanup")
  );
});
const qualifyEnrollment = Effect.fnUntraced(function* (e: CursorCallbackEnrollment) {
  if (e.state !== "active") return yield* failure("paused");
  const now = yield* Clock.currentTimeMillis;
  if (now >= e.expiresAtMillis || e.expiresAtMillis - now > 900000) return yield* failure("expired");
  const executable = yield* io(() => Fs.realpath(process.execPath));
  if (
    !process.versions.bun ||
    executable !== e.callbackExecutable ||
    executable === e.receiver.runtimeExecutable ||
    e.intake.hostId !== e.receiver.hostId ||
    (yield* io(() => Fs.realpath(process.cwd()))) !== e.receiver.workspace
  )
    return yield* failure("enrollment");
  const hashSalt = yield* readSaltCredential(e.saltCredentialFile);
  const namespace = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(Redacted.value(hashSalt)));
  if (namespace !== e.intake.namespaceId) return yield* failure("enrollment");
  yield* Effect.acquireUseRelease(
    io(() => Fs.open(executable, constants.O_RDONLY | constants.O_NOFOLLOW)),
    Effect.fnUntraced(function* (file) {
      const before = yield* io(() => file.stat({ bigint: true }));
      if (!before.isFile() || (before.mode & 0o022n) !== 0n || before.size > 268435456n)
        return yield* failure("enrollment");
      const bytes = yield* readBoundedFile(file, Number(before.size));
      const after = yield* io(() => file.stat({ bigint: true }));
      if ((yield* hashBytes(bytes)) !== e.callbackSha256 || !sameFile(before, after))
        return yield* failure("enrollment");
    }),
    (file) => io(() => file.close(), "cleanup")
  );
  return CursorLifecyclePolicy.make({ ...e.receiver, hashSalt });
});
const closeLeaseDatabase = (database: DatabaseSync) =>
  Effect.try({
    try: () => database.close(),
    catch: () => failure("cleanup"),
  }).pipe(Effect.orDie);
const acquireLease = Effect.fnUntraced(function* (
  root: Effect.Success<ReturnType<typeof rootAnchor>>,
  enrollment: CursorCallbackEnrollment
) {
  yield* requireRoot(root);
  const path = `${root.path}/callback.lock`;
  const file = yield* io(() => Fs.open(path, constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK));
  const stat = yield* io(() => file.stat({ bigint: true })).pipe(
    Effect.onError(() => io(() => file.close(), "cleanup").pipe(Effect.orDie))
  );
  if (
    !ownedFile(stat, root.uid, 0) ||
    stat.dev.toString() !== enrollment.leaseDevice ||
    stat.ino.toString() !== enrollment.leaseInode
  ) {
    yield* io(() => file.close(), "cleanup");
    return yield* failure("enrollment");
  }
  // The persistent empty inode carries only SQLite's kernel lock, never callback data.
  // Pin the already-open no-follow descriptor; a crash releases the OS lock automatically.
  const database = yield* Effect.try({
    try: () => new DatabaseSync(`/proc/self/fd/${file.fd}`, { allowExtension: false }),
    catch: () => failure("enrollment"),
  }).pipe(Effect.onError(() => io(() => file.close(), "cleanup").pipe(Effect.orDie)));
  const lease = { path, file, stat, database };
  return yield* Effect.gen(function* () {
    yield* requireLease(root, lease);
    yield* Effect.try({
      try: () => database.exec("PRAGMA busy_timeout=0;BEGIN IMMEDIATE"),
      catch: (error) => failure(sqliteBusy(error) ? "busy" : "enrollment"),
    });
    yield* requireLease(root, lease);
    return lease;
  }).pipe(
    Effect.onError(() =>
      closeLeaseDatabase(database).pipe(Effect.ensuring(io(() => file.close(), "cleanup").pipe(Effect.orDie)))
    )
  );
});
const requireLease = Effect.fnUntraced(function* (
  root: Effect.Success<ReturnType<typeof rootAnchor>>,
  lease: { readonly path: string; readonly file: FileHandle; readonly stat: BigIntStats }
) {
  yield* requireRoot(root);
  const current = yield* io(() => Fs.lstat(lease.path, { bigint: true }));
  const descriptor = yield* io(() => lease.file.stat({ bigint: true }));
  if (!sameFile(lease.stat, current) || !sameFile(lease.stat, descriptor)) return yield* failure("enrollment");
});
const releaseLease = Effect.fnUntraced(function* (lease: Effect.Success<ReturnType<typeof acquireLease>>) {
  const current = yield* io(() => Fs.lstat(lease.path, { bigint: true }), "cleanup").pipe(Effect.result);
  yield* Effect.try({ try: () => lease.database.exec("ROLLBACK"), catch: () => failure("cleanup") }).pipe(
    Effect.ensuring(
      closeLeaseDatabase(lease.database).pipe(
        Effect.ensuring(io(() => lease.file.close(), "cleanup").pipe(Effect.orDie))
      )
    )
  );
  if (Result.isFailure(current) || !sameFile(lease.stat, current.success)) return yield* failure("cleanup");
});
const projectInput = Effect.fnUntraced(function* (input: Stream.Stream<Uint8Array, unknown>) {
  const body = yield* input.pipe(
    Stream.runFoldEffect(
      () => new Uint8Array(0),
      (before, chunk) => {
        if (before.byteLength + chunk.byteLength > 8192) return Effect.fail(failure("input"));
        const next = new Uint8Array(before.byteLength + chunk.byteLength);
        next.set(before);
        next.set(chunk, before.byteLength);
        return Effect.succeed(next);
      }
    ),
    Effect.mapError(() => failure("input")),
    Effect.timeoutOrElse({ duration: "2 seconds", orElse: () => Effect.fail(failure("input")) })
  );
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(body),
    catch: () => failure("input"),
  });
  return yield* projectCursorLifecycleHookInput(text).pipe(Effect.mapError(() => failure("input")));
});
const callbackAt = Effect.fn("CursorCallback.consume")(function* (
  rootPath: string,
  input: Stream.Stream<Uint8Array, unknown>,
  receiver: typeof makeCursorLifecycleReceiver
) {
  // Projection happens before a lease, journal initialization, or any other disk write.
  const projected = yield* projectInput(input);
  const uid = process.getuid?.();
  if (uid === undefined || process.platform !== "linux") return yield* failure("enrollment");
  return yield* Effect.acquireUseRelease(
    rootAnchor(rootPath, uid),
    Effect.fnUntraced(function* (root) {
      yield* requireRoot(root);
      const enrollment = yield* readEnrollment(root);
      const policy = yield* qualifyEnrollment(enrollment);
      return yield* Effect.acquireUseRelease(
        acquireLease(root, enrollment),
        Effect.fnUntraced(function* (lease) {
          yield* requireLease(root, lease);
          const journalPath = `${root.path}/journal.sqlite`;
          const before = yield* io(() => Fs.lstat(journalPath, { bigint: true }));
          if (!ownedFile(before, root.uid, enrollment.intake.maxDatabasePages * 4096))
            return yield* failure("enrollment");
          const work = Effect.scoped(
            Effect.gen(function* () {
              const journal = yield* makeNativeIntakeJournal(enrollment.intake);
              const control = yield* makeObservationControl(controlPolicy);
              // Only the fixed owner enrollment, never the callback, opens admission.
              yield* control.resume;
              const bridge = yield* receiver(policy).pipe(
                Effect.provideService(CursorLifecycleRuntime, { journal, control })
              );
              yield* requireLease(root, lease);
              const listener = yield* bridge.open();
              const forwarding = yield* Effect.forkChild(forwardCursorLifecycleHook(listener.socketPath, projected));
              const receipt = yield* listener.accept;
              yield* Fiber.join(forwarding);
              yield* control.pause;
              return receipt;
            })
          ).pipe(Effect.provide(SqliteClient.layer({ filename: journalPath, disableWAL: true, busyTimeout: 0 })));
          const receipt = yield* work.pipe(Effect.mapError(() => failure("callback")));
          yield* requireLease(root, lease);
          const after = yield* io(() => Fs.lstat(journalPath, { bigint: true }));
          if (
            !ownedFile(after, root.uid, enrollment.intake.maxDatabasePages * 4096) ||
            before.dev !== after.dev ||
            before.ino !== after.ino
          )
            return yield* failure("storage");
          return receipt;
        }),
        releaseLease
      );
    }),
    (root) => io(() => root.handle.close(), "cleanup")
  );
});
/**
 * Source-only test port. The installed command has no corresponding argument or environment override.
 * **Example** (Inspect the offline port)
 * ```ts
 * console.log(typeof cursorCallbackFixture.consume)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const cursorCallbackFixture = { consume: callbackAt, projectInput };

if (import.meta.main) {
  // OS account metadata supplies the fixed owner location; HOME/XDG/argv/callback cannot choose a policy.
  const input = Stream.fromAsyncIterable(process.stdin, () => failure("input"));
  const program = Effect.gen(function* () {
    if (process.argv.length !== 2) return yield* failure("enrollment");
    const account = yield* Effect.try({ try: userInfo, catch: () => failure("enrollment") });
    return yield* callbackAt(
      `${account.homedir}/.local/state/beep/cursor-lifecycle-hook`,
      input,
      makeCursorLifecycleReceiver
    );
  });
  BunRuntime.runMain(
    program.pipe(
      Effect.provide(platforms),
      Effect.timeoutOrElse({ duration: "15 seconds", orElse: () => Effect.fail(failure("callback")) })
    ),
    { disableErrorReporting: true }
  );
  // Runtime teardown owns the exit; no callback or enrollment error is printed.
}
