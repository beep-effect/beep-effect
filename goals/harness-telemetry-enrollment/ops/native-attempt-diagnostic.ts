/**
 * Finite durable diagnostics for the fixed native CLI canaries, without dispatch capability.
 * @packageDocumentation
 * @since 0.0.0
 */
import { constants } from "node:fs";
import * as Fs from "node:fs/promises";
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/native-attempt-diagnostic");
/**
 * Fixed failure boundaries; no native error messages or arbitrary labels.
 * **Example** (Inspect phases)
 * ```ts
 * console.log(typeof NativeAttemptPhase.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export const NativeAttemptPhase = S.Literals([
  "admission",
  "attempted-unknown",
  "diagnostic",
  "version-dispatch",
  "version-output",
  "version-exit",
  "version-mismatch",
  "version-timeout",
  "source",
  "source-dispatch",
  "source-output",
  "source-exit",
  "source-protocol",
  "source-identity",
  "source-policy",
  "source-receipt",
  "source-timeout",
  "delivery",
]);
/**
 * Finite protocol refusal categories shared by native print decoders.
 * **Example** (Inspect refusal categories)
 * ```ts
 * console.log(typeof NativeProtocolFailure.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export const NativeProtocolFailure = S.Literals([
  "bounds",
  "envelope",
  "event-kind",
  "order",
  "init",
  "init-cwd",
  "init-inventory",
  "retry",
  "assistant",
  "terminal",
  "usage",
  "missing-terminal",
]);
const count = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
/**
 * Bounded protocol counts and match booleans. No raw kind, source text, ID or error is retained.
 * **Example** (Inspect safe diagnostics)
 * ```ts
 * console.log(typeof NativeProtocolDiagnostics.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NativeProtocolDiagnostics extends S.Opaque<NativeProtocolDiagnostics, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-print-protocol-diagnostics/v1"),
    bytes: count,
    lines: count,
    inspectedLines: count,
    truncated: S.Boolean,
    malformed: count,
    init: count,
    assistant: count,
    result: count,
    uiInvalidate: count,
    trailingUiInvalidate: count,
    apiRetry: count,
    rateLimit: count,
    unknownRoot: count,
    unknownSystem: count,
    assistantError: count,
    terminalError: count,
    initVersionMatches: S.OptionFromOptionalKey(S.Boolean),
    initModelMatches: S.OptionFromOptionalKey(S.Boolean),
    initCwdMatches: S.OptionFromOptionalKey(S.Boolean),
    initAuthMatches: S.OptionFromOptionalKey(S.Boolean),
    initInventoryMatches: S.OptionFromOptionalKey(S.Boolean),
    terminalConstantMatches: S.OptionFromOptionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("NativeProtocolDiagnostics", {
      description: "Finite private failure diagnostics, never source output.",
    })
  )
) {}

/**
 * Immutable dispatch/result metadata. Missing observation means unknown, never zero work.
 * **Example** (Inspect the record constructor)
 * ```ts
 * console.log(typeof NativeAttemptDiagnostic.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NativeAttemptDiagnostic extends S.Opaque<NativeAttemptDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-canary-attempt-diagnostic/v1"),
    requestBinding: Sha256Hex,
    purpose: S.Literals(["version", "source", "lifecycle"]),
    stage: S.Literals(["dispatch-intent", "spawn-observed", "validated", "failed", "pending"]),
    nativeSpawned: S.OptionFromOptionalKey(S.Boolean),
    nativeExitStatus: S.OptionFromOptionalKey(S.Int.check(S.isBetween({ minimum: -255, maximum: 255 }))),
    observedStdoutBytes: S.Natural,
    outputComplete: S.Boolean,
    protocol: S.OptionFromOptionalKey(NativeProtocolDiagnostics),
    failurePhase: S.OptionFromOptionalKey(NativeAttemptPhase),
    protocolFailure: S.OptionFromOptionalKey(NativeProtocolFailure),
    prePolicyDigest: S.OptionFromOptionalKey(Sha256Hex).pipe(S.withConstructorDefault(Effect.succeedNone)),
    postPolicyDigest: S.OptionFromOptionalKey(Sha256Hex).pipe(S.withConstructorDefault(Effect.succeedNone)),
    policyUnchanged: S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    lifecycleOutcome: S.OptionFromOptionalKey(S.Literals(["failed", "cancelled", "unknown"])).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    lifecycleDelivery: S.OptionFromOptionalKey(S.Literals(["pending", "acknowledged"])).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    actualApiRequestCount: S.tag("unknown"),
    rawSourceRetention: S.tag("none"),
  }).pipe(
    $I.annoteSchema("NativeAttemptDiagnostic", {
      description: "Fsynced finite metadata only; no raw source, ID, path, argv or cause.",
    })
  )
) {}
/**
 * Content-free diagnostic persistence refusal.
 * **Example** (Inspect the failure constructor)
 * ```ts
 * console.log(typeof NativeAttemptDiagnosticError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class NativeAttemptDiagnosticError extends S.TaggedError<
  NativeAttemptDiagnosticError,
  { readonly brand: unique symbol }
>($I`NativeAttemptDiagnosticError`)(
  "NativeAttemptDiagnosticError",
  {},
  $I.annote("NativeAttemptDiagnosticError", { description: "Private immutable diagnostic write refused." })
) {}

/**
 * Exclusively create and fsync one finite diagnostic filename under an owned private directory.
 * **Details**
 * No process execution, raw stream, arbitrary filename, overwrite or credential access is provided.
 * **Example** (Inspect the metadata writer)
 * ```ts
 * console.log(typeof writeNativeAttemptDiagnostic)
 * ```
 * @param directory - Existing owner-only attempt directory, with no symlink aliases.
 * @param record - Finite typed metadata; purpose and stage determine the filename.
 * @returns Void only after the file and directory have been fsynced.
 * @category persistence
 * @since 0.0.0
 */
export const writeNativeAttemptDiagnostic = Effect.fn("HarnessEnrollment.writeNativeAttemptDiagnostic")(function* (
  directory: string,
  record: NativeAttemptDiagnostic
) {
  const text = yield* S.encodeEffect(S.fromJsonString(NativeAttemptDiagnostic), { onExcessProperty: "error" })(
    record
  ).pipe(Effect.mapError(() => NativeAttemptDiagnosticError.make({})));
  const checked = record;
  yield* Effect.tryPromise({
    try: async () => {
      const stat = await Fs.lstat(directory);
      if (
        !directory.startsWith("/") ||
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid?.() ||
        (stat.mode & 0o777) !== 0o700 ||
        (await Fs.realpath(directory)) !== directory
      )
        throw new Error("private-directory");
      const filename = `${directory}/diagnostic-${checked.purpose}-${checked.stage}.json`;
      const pending = `${directory}/.diagnostic-${checked.purpose}-${checked.stage}.pending`;
      const file = await Fs.open(
        pending,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600
      );
      let identity: { readonly dev: number; readonly ino: number };
      try {
        await file.writeFile(text, "utf8");
        await file.sync();
        const info = await file.stat();
        identity = { dev: info.dev, ino: info.ino };
      } finally {
        await file.close();
      }
      // link() atomically publishes complete fsynced bytes and refuses an existing final name.
      // On failure, keep this owned pending residue for diagnosis; never treat it as a complete record.
      await Fs.link(pending, filename);
      const parent = await Fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
      try {
        await parent.sync();
        const current = await Fs.lstat(pending);
        if (current.dev !== identity.dev || current.ino !== identity.ino || current.isSymbolicLink())
          throw new Error("pending-identity-changed");
        await Fs.unlink(pending);
        await parent.sync();
      } finally {
        await parent.close();
      }
    },
    catch: () => NativeAttemptDiagnosticError.make({}),
  });
});
