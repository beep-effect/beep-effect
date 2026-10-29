/**
 * Durable local forwarder for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbError } from "@beep/duckdb";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { SchemaUtils, Sha256Hex } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, identity, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { AiMetricsRawArchiveKey, writeEncryptedRawArchiveObject } from "./archive.ts";
import {
  AiMetricsConfigSnapshotInput,
  makeAiMetricsConfigSnapshot,
  writeAiMetricsConfigSnapshotArtifacts,
} from "./config-snapshot.ts";
import { AiMetricsStateHomeInput, aiMetricsStateHome } from "./data-root.ts";
import {
  AiMetricsDerivedStorageWriteInput,
  AiMetricsDerivedTranscriptRecord,
  AiMetricsParquetExportMode,
  AiMetricsSessionStampJoin,
  aiMetricsSessionStampCompletenessFor,
  aiMetricsSessionStampQualificationFor,
  writeAiMetricsDerivedStorage,
} from "./derived-storage.ts";
import { HarnessHash } from "./harness-ledger.ts";
import {
  agentEvidenceRoot,
  HookPulseAgentKind,
  HookPulseDisarmSentinel,
  HookPulseDisarmWindow,
  HookPulseRefusal,
  HookPulseRefusalReason,
  HookPulseV1,
  hookPulseDisarmSentinelPath,
  hookPulseDisarmWindowsPath,
  hookPulseHashSalt,
  hookPulseLedgerDir,
} from "./hook-pulse.ts";
import { AiMetricsIdentityRegistryUpsertInput, upsertAiMetricsIdentityRegistry } from "./identity-registry.ts";
import { AiMetricsTranscriptTextSummaryInput, summarizeTranscriptText } from "./ingest.ts";
import { AiMetricsInstallInput, makeAiMetricsInstallSpec } from "./install.ts";
import { fileSizeBytes, modifiedAtMillis } from "./internal/file-info.ts";
import { collectJsonlFiles, statOption } from "./internal/jsonl-discovery.ts";
import { normalizedRelativePath, resolveTranscriptSourceRoots } from "./internal/transcript-utils.ts";
import { AiMetricsDeployTarget, AiMetricsTranscriptSource } from "./models.ts";
import { hashPrivateIdentifier, makeAiMetricsPrivacyCheckResult } from "./privacy.ts";
import { shellQuote } from "./shell.ts";

const $I = $RepoAiMetricsId.create("forwarder");
const DEFAULT_MAX_FILES = 200;
const absoluteExecutablePathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/u;
const isAbsoluteExecutablePath = (value: string): boolean => absoluteExecutablePathPattern.test(value);
const AiMetricsForwarderTimerCommandBase = S.NonEmptyArray(S.String);
const AiMetricsForwarderTimerCommand = AiMetricsForwarderTimerCommandBase.pipe(
  S.check(
    S.makeFilter<typeof AiMetricsForwarderTimerCommandBase.Type>(
      (command) =>
        isAbsoluteExecutablePath(command[0])
          ? true
          : {
              path: [0],
              issue: "Forwarder timer command[0] must be an absolute executable path.",
            },
      $I.annote("AiMetricsForwarderTimerCommandAbsoluteExecutableCheck", {
        title: "AI Metrics Forwarder Timer Command Absolute Executable",
        description: "A forwarder timer command whose executable is pinned to an absolute path.",
        message: "Forwarder timer command[0] must be an absolute executable path.",
      })
    )
  ),
  $I.annoteSchema("AiMetricsForwarderTimerCommand", {
    description: "Forwarder timer command argv with an absolute executable path.",
  })
);

class ProcessedForwarderSource extends S.Opaque<ProcessedForwarderSource, { readonly brand: unique symbol }>()(
  S.Struct({
    record: AiMetricsDerivedTranscriptRecord,
    hookPathHash: Sha256Hex.pipe(S.toEncoded),
    sessionIdentityHash: S.OptionFromOptionalKey(Sha256Hex.pipe(S.toEncoded)),
  }).pipe(
    $I.annoteSchema("ProcessedForwarderSource", {
      description: "Processed transcript source and its hook-namespace attribution keys.",
    })
  )
) {}

const SessionIdentityRow = S.fromJsonString(
  S.Struct({
    type: S.optionalKey(S.String),
    sessionId: S.optionalKey(S.NonEmptyString),
    payload: S.optionalKey(S.Struct({ id: S.optionalKey(S.NonEmptyString) })),
  })
);
const decodeSessionIdentityRow = S.decodeResult(SessionIdentityRow);
const readSessionIdentityHash = Effect.fnUntraced(function* (
  content: string,
  sourceKind: AiMetricsTranscriptSource,
  hashSalt: O.Option<string>
) {
  let identities = HashSet.empty<string>();
  let complete = true;
  for (const line of A.filter(Str.split(content, "\n"), Str.isNonEmpty)) {
    Result.match(decodeSessionIdentityRow(line), {
      onFailure: () => {
        complete = false;
      },
      onSuccess: (row) => {
        const identity =
          sourceKind === "claude"
            ? O.fromUndefinedOr(row.sessionId)
            : row.type === "session_meta"
              ? O.fromUndefinedOr(row.payload?.id)
              : O.none<string>();
        O.match(identity, {
          onNone: () => {},
          onSome: (value) => {
            identities = HashSet.add(identities, value);
          },
        });
      },
    });
  }
  const identity = complete && HashSet.size(identities) === 1 ? A.head(A.fromIterable(identities)) : O.none<string>();
  return yield* O.match(identity, {
    onNone: () => Effect.succeedNone,
    onSome: (value) => hashPrivateIdentifier(value, hashSalt).pipe(Effect.asSome),
  });
});

class SessionStampGap extends S.Opaque<SessionStampGap, { readonly brand: unique symbol }>()(
  S.Struct({
    start: S.OptionFromOptionalKey(S.Finite),
    end: S.OptionFromOptionalKey(S.Finite),
    client: S.OptionFromOptionalKey(HookPulseAgentKind),
    eventLoss: S.Boolean,
  }).pipe(
    $I.annoteSchema("SessionStampGap", {
      description: "Closed collection gap used to exclude uncertain forwarder session stamps.",
    })
  )
) {}
const timestampEpoch = flow(S.decodeOption(S.DateTimeUtcFromString), O.map(DateTime.toEpochMillis));
const readOptionalEvidence = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(file).pipe(
    Effect.catchIf(
      (cause) => cause.reason._tag === "NotFound",
      () => Effect.succeed("")
    )
  );
});
const readRefusalStampGaps = Effect.fnUntraced(function* (evidenceRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const gaps = A.empty<SessionStampGap>();
  let rejectedRecords = 0;
  const files = yield* fs.readDirectory(evidenceRoot).pipe(
    Effect.catchIf(
      (cause) => cause.reason._tag === "NotFound",
      () => Effect.succeed(A.empty<string>())
    )
  );
  for (const name of A.filter(files, Str.startsWith("hook-pulse-refusals-"))) {
    const text = yield* fs.readFileString(path.join(evidenceRoot, name));
    const refusals = A.filterMap(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) => {
      const decoded = HookPulseRefusal.decodeJsonResult(line);
      if (Result.isFailure(decoded)) rejectedRecords += 1;
      return decoded;
    });
    for (const refusal of A.filter(refusals, (row) => row.reason !== HookPulseRefusalReason.Enum["stamp-failed"])) {
      const at = O.some(refusal.ts.pipe(DateTime.toEpochMillis));
      gaps.push(
        SessionStampGap.make({
          start: at,
          end: O.map(at, (value) => value + 999),
          client: refusal.agentKind === "unknown" ? O.none() : O.some(refusal.agentKind),
          eventLoss: true,
        })
      );
    }
  }
  return { gaps, rejectedRecords };
});
const readStampGaps = Effect.fnUntraced(function* (evidenceRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const gaps = A.empty<SessionStampGap>();
  const defaultSentinel = hookPulseDisarmSentinelPath(evidenceRoot);
  const sentinelPath = yield* Config.String("BEEP_HOOK_PULSE_DISARM_SENTINEL").pipe(
    Config.withDefault(defaultSentinel),
    Effect.map((value) => (value === "" ? defaultSentinel : value))
  );
  const sentinelExists = yield* fs.exists(sentinelPath);
  if (sentinelExists) {
    const sentinel = yield* HookPulseDisarmSentinel.decodeJsonEffect(yield* fs.readFileString(sentinelPath));
    const observedNow = yield* Clock.currentTimeMillis;
    gaps.push(
      SessionStampGap.make({
        start: O.filter(timestampEpoch(sentinel.disarmedAt), (start) => start <= observedNow),
        end: O.none(),
        client: O.none(),
        eventLoss: false,
      })
    );
  }
  const windows = yield* readOptionalEvidence(hookPulseDisarmWindowsPath(evidenceRoot));
  for (const line of A.filter(Str.split(windows, "\n"), Str.isNonEmpty)) {
    const window = yield* HookPulseDisarmWindow.decodeJsonEffect(line);
    gaps.push(
      SessionStampGap.make({
        start: O.flatMap(window.disarmedAt, timestampEpoch),
        end: timestampEpoch(window.rearmedAt),
        client: O.none(),
        eventLoss: false,
      })
    );
  }
  const refusals = yield* readRefusalStampGaps(evidenceRoot);
  gaps.push(...refusals.gaps);
  return { gaps, rejectedRecords: refusals.rejectedRecords };
});
const recordAvoidsStampGaps = (
  record: AiMetricsDerivedTranscriptRecord,
  client: HookPulseAgentKind,
  gaps: O.Option<ReadonlyArray<SessionStampGap>>,
  closedAt: O.Option<number>,
  openingAt: O.Option<number>,
  observedThrough: O.Option<number>
): boolean =>
  O.exists(gaps, (known) => {
    const relevant = A.filter(known, (gap) => O.isNone(gap.client) || O.contains(gap.client, client));
    const sanitized = record.privacy.sanitized;
    const start = O.flatMap(sanitized.firstTimestamp, timestampEpoch);
    const last = O.flatMap(sanitized.lastTimestamp, timestampEpoch);
    if (O.isNone(start) || O.isNone(last) || last.value < start.value) return false;
    if (O.isNone(openingAt) || openingAt.value > start.value) return false;
    const beginning = openingAt.value;
    const end = Math.max(
      last.value,
      O.getOrElse(observedThrough, () => last.value),
      O.getOrElse(closedAt, () => last.value)
    );
    return A.every(
      relevant,
      (gap) =>
        O.exists(gap.end, (last) => last < beginning) ||
        (gap.eventLoss
          ? O.exists(closedAt, (closed) => O.exists(gap.start, (first) => first > closed))
          : O.exists(gap.start, (first) => first > end))
    );
  });

// A contradiction is drawn from this session's own evidence and cannot be undone by evidence
// a run failed to read: extra stamps or identities only accumulate, and a gap that starts
// inside the transcript's own span intersects whatever else is found.
const sessionStampContradicted = (input: {
  readonly agentKind: HookPulseAgentKind;
  readonly gaps: O.Option<ReadonlyArray<SessionStampGap>>;
  readonly index: Pick<SessionStampIndex, "sessions" | "stamps">;
  readonly pathHash: string;
  readonly record: AiMetricsDerivedTranscriptRecord;
  readonly sessionIdentityHash: O.Option<string>;
}): boolean => {
  const key = `${input.agentKind}:${input.pathHash}`;
  const sanitized = input.record.privacy.sanitized;
  const start = O.flatMap(sanitized.firstTimestamp, timestampEpoch);
  const last = O.flatMap(sanitized.lastTimestamp, timestampEpoch);
  const insideTranscript = (first: number): boolean =>
    O.exists(start, (beginning) => first >= beginning) && O.exists(last, (end) => first <= end);
  const mixedStamps = O.exists(
    MutableHashMap.get(input.index.stamps, key),
    (values) => HashSet.size(values) > 1 || HashSet.has(values, "unknown")
  );
  const foreignIdentity = O.exists(
    MutableHashMap.get(input.index.sessions, key),
    (identities) =>
      HashSet.size(identities) > 1 ||
      O.exists(input.sessionIdentityHash, (identity) => !HashSet.has(identities, identity))
  );
  const gapInside = O.exists(input.gaps, (known) =>
    A.some(
      known,
      (gap) =>
        (O.isNone(gap.client) || O.contains(gap.client, input.agentKind)) && O.exists(gap.start, insideTranscript)
    )
  );
  return mixedStamps || foreignIdentity || gapInside;
};

const sessionStampJoinFor = (input: {
  readonly gaps: O.Option<ReadonlyArray<SessionStampGap>>;
  readonly index: Pick<SessionStampIndex, "sessions" | "stamps">;
  readonly kind: O.Option<HookPulseAgentKind>;
  readonly pathHash: string;
  readonly record: AiMetricsDerivedTranscriptRecord;
  readonly retained: boolean;
  readonly sessionIdentityHash: O.Option<string>;
}): AiMetricsSessionStampJoin =>
  O.match(input.kind, {
    onNone: () => AiMetricsSessionStampJoin.Enum.unsupported,
    onSome: (agentKind) => {
      if (input.retained) return AiMetricsSessionStampJoin.Enum.retained;
      return sessionStampContradicted({ ...input, agentKind })
        ? AiMetricsSessionStampJoin.Enum.contradicted
        : AiMetricsSessionStampJoin.Enum.unresolved;
    },
  });

type SessionStampIndex = {
  readonly stamps: MutableHashMap.MutableHashMap<string, HashSet.HashSet<string>>;
  readonly sessions: MutableHashMap.MutableHashMap<string, HashSet.HashSet<string>>;
  readonly freshStarts: MutableHashMap.MutableHashMap<string, HashSet.HashSet<number>>;
  readonly firstObserved: MutableHashMap.MutableHashMap<string, number>;
  readonly lastObserved: MutableHashMap.MutableHashMap<string, number>;
  readonly endings: MutableHashMap.MutableHashMap<string, number>;
  readonly sessionLastObserved: MutableHashMap.MutableHashMap<string, number>;
};

const collectSessionStamp = (index: SessionStampIndex, pulse: HookPulseV1): void => {
  if (pulse.instrumentClass !== "production" || O.isNone(pulse.transcriptPath)) return;
  const { stamps, sessions, freshStarts, firstObserved, lastObserved, endings, sessionLastObserved } = index;
  const key = `${pulse.agentKind}:${pulse.transcriptPath.value}`;
  const observedAt = DateTime.toEpochMillis(pulse.ts);
  const sessionKey = `${pulse.agentKind}:${pulse.sessionId}`;
  MutableHashMap.set(
    sessionLastObserved,
    sessionKey,
    Math.max(
      O.getOrElse(MutableHashMap.get(sessionLastObserved, sessionKey), () => observedAt),
      observedAt
    )
  );
  MutableHashMap.set(
    lastObserved,
    key,
    Math.max(
      O.getOrElse(MutableHashMap.get(lastObserved, key), () => observedAt),
      observedAt
    )
  );
  if (pulse.hookEvent === "SessionEnd")
    MutableHashMap.set(
      endings,
      key,
      Math.max(
        O.getOrElse(MutableHashMap.get(endings, key), () => observedAt),
        observedAt
      )
    );
  MutableHashMap.set(
    firstObserved,
    key,
    Math.min(
      O.getOrElse(MutableHashMap.get(firstObserved, key), () => observedAt),
      observedAt
    )
  );
  MutableHashMap.set(
    sessions,
    key,
    HashSet.add(O.getOrElse(MutableHashMap.get(sessions, key), HashSet.empty<string>), pulse.sessionId)
  );
  if (pulse.hookEvent !== "SessionStart") return;
  if (O.contains(pulse.sessionStartSource, "startup"))
    MutableHashMap.set(
      freshStarts,
      key,
      HashSet.add(O.getOrElse(MutableHashMap.get(freshStarts, key), HashSet.empty<number>), observedAt)
    );
  MutableHashMap.set(
    stamps,
    key,
    HashSet.add(
      O.getOrElse(MutableHashMap.get(stamps, key), HashSet.empty<string>),
      O.getOrElse(pulse.harnessHash, () => "unknown")
    )
  );
};

/**
 * Typed failure raised anywhere inside one durable forwarder run.
 *
 * **Details**
 *
 * Every stage of the run — discovery, ingest, archive, derived storage, OTLP
 * export — maps its own failure into this single error so the caller has one
 * tag to handle. The originating failure is preserved in `cause`, and `message`
 * names the stage that failed.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { AiMetricsForwarderError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsForwarderError.make({
 *   cause: "boom",
 *   message: "Failed to upsert the AI metrics identity registry."
 * })
 *
 * console.log(error._tag) // "AiMetricsForwarderError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsForwarderError extends S.TaggedError<AiMetricsForwarderError, { readonly brand: unique symbol }>(
  $I`AiMetricsForwarderError`
)(
  "AiMetricsForwarderError",
  {
    cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
    message: S.String,
  },
  $I.annoteError<AiMetricsForwarderError>("AiMetricsForwarderError", {
    description: "Typed failure raised by the durable AI metrics forwarder.",
  })
) {}

/**
 * Roots, budgets, and secrets that define one durable forwarder run.
 *
 * **Details**
 *
 * `dataRoot` is optional here but is not defaulted downstream: a `local` run
 * that supplies neither `dataRoot` nor `homeDir` fails rather than writing into
 * whichever clone happens to be the working directory. `maxFiles` and
 * `maxFileBytes` bound one pass, and files they exclude are reported through
 * {@link AiMetricsForwarderSourceCoverage} instead of being dropped silently.
 *
 * **Example** (Configuring a local run)
 *
 * ```ts
 * import { AiMetricsForwarderInput } from "@beep/repo-ai-metrics"
 * import * as Option from "effect/Option";
 * import * as Redacted from "effect/Redacted";
 * const input = AiMetricsForwarderInput.make({
 *   dataRoot: Option.some("/home/dev/.local/state/beep/ai-metrics"),
 *   hashSalt: Option.some("salt"),
 *   homeDir: "/home/dev",
 *   rawArchiveKey: Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
 *   repoRoot: "/repo"
 * })
 *
 * console.log(input.parquetExportMode) // "snapshot"
 * console.log(input.target) // "local"
 * ```
 *
 * @see {@link runAiMetricsForwarder} for the run this input drives.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderInput extends S.Opaque<AiMetricsForwarderInput, { readonly brand: unique symbol }>()(
  S.Struct({
    claudeProjectsRoot: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    codexSessionsRoot: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    dataRoot: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    hashSalt: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    hashSaltSecretRef: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    homeDir: S.String,
    includeAll: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    maxFiles: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_MAX_FILES)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_MAX_FILES))
    ),
    maxFileBytes: S.OptionFromOptionalKey(S.Natural).pipe(S.withConstructorDefault(Effect.succeedNone)),
    openClawUnitPath: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    parquetExportMode: AiMetricsParquetExportMode.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsParquetExportMode.Enum.snapshot)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsParquetExportMode.Enum.snapshot))
    ),
    rawArchiveKey: AiMetricsRawArchiveKey,
    rawArchiveKeySecretRef: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    repoRoot: S.String,
    sinceEpochMillis: S.OptionFromOptionalKey(S.Natural).pipe(S.withConstructorDefault(Effect.succeedNone)),
    target: AiMetricsDeployTarget.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsDeployTarget.Enum.local)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsDeployTarget.Enum.local))
    ),
  }).pipe(
    $I.annoteSchema("AiMetricsForwarderInput", {
      description: "Configurable roots, target, and archive key for one durable AI metrics forwarder run.",
    })
  )
) {}

/**
 * How much of one agent brand's transcript backlog a single run actually covered.
 *
 * **Details**
 *
 * The counts exist to make starvation visible. A shared `maxFiles` budget spent
 * mostly on one brand leaves the other permanently behind, and without
 * `candidateFileCount` beside `includedFileCount` that shows up only as a
 * quietly stale dataset. `limitedByMaxFiles` and `sizeExcludedFileCount`
 * attribute the shortfall to the budget that caused it.
 *
 * **Example** (Detecting a starved source)
 *
 * ```ts
 * import { AiMetricsForwarderSourceCoverage } from "@beep/repo-ai-metrics"
 *
 * const coverage = AiMetricsForwarderSourceCoverage.make({
 *   candidateFileCount: 12,
 *   includedFileCount: 10,
 *   limitedByMaxFiles: true,
 *   sourceKind: "codex"
 * })
 *
 * console.log(coverage.candidateFileCount - coverage.includedFileCount) // 2
 * console.log(coverage.limitedByMaxFiles) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderSourceCoverage extends S.Opaque<
  AiMetricsForwarderSourceCoverage,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    candidateFileCount: S.Natural,
    includedFileCount: S.Natural,
    limitedByMaxFiles: S.Boolean,
    sizeExcludedFileCount: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    sourceKind: AiMetricsTranscriptSource,
  }).pipe(
    $I.annoteSchema("AiMetricsForwarderSourceCoverage", {
      description: "Source-aware file selection counts used to detect maxFiles and maxFileBytes starvation.",
    })
  )
) {}

/**
 * Successful derived OTLP export recorded against a forwarder run.
 *
 * **Details**
 *
 * `spanCount` is the total shipped; `sessionSpanCount` and `turnSpanCount`
 * break it down by span kind, so a run that produced sessions but no turns is
 * distinguishable from one that shipped nothing. Only allowlisted, hashed
 * attributes leave the machine, which is why these counts — not sample payloads
 * — are the export's evidence.
 *
 * **Example** (Reading an export's span breakdown)
 *
 * ```ts
 * import { AiMetricsForwarderOtlpExported } from "@beep/repo-ai-metrics"
 *
 * const exported = AiMetricsForwarderOtlpExported.make({
 *   endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *   ingestRunId: "forwarder-1",
 *   sessionSpanCount: 2,
 *   spanCount: 12,
 *   status: "exported",
 *   target: "local",
 *   turnSpanCount: 10
 * })
 *
 * console.log(exported.sessionSpanCount + exported.turnSpanCount) // 12
 * ```
 *
 * @see {@link AiMetricsForwarderOtlpExport} for the tagged union that carries this member.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderOtlpExported extends S.Opaque<
  AiMetricsForwarderOtlpExported,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    endpointTraceUrl: S.String,
    ingestRunId: S.String,
    sessionSpanCount: S.Natural,
    spanCount: S.Natural,
    status: S.tag("exported"),
    target: AiMetricsDeployTarget,
    turnSpanCount: S.Natural,
  }).pipe(
    $I.annoteSchema("AiMetricsForwarderOtlpExported", {
      description: "Safe counts recorded when a forwarder run also exports derived AI metrics spans through OTLP.",
    })
  )
) {}

/**
 * Failed derived OTLP export recorded against a forwarder run.
 *
 * **Details**
 *
 * Export failure does not fail the run: the transcripts are already ingested and
 * durable, and an unreachable collector is a transient condition the next run
 * retries. Recording the failure against the same `ingestRunId` is what keeps
 * "ingested but never exported" from looking identical to "never ingested".
 *
 * **Gotchas**
 *
 * `message` is sanitized for storage. Do not put a raw exporter error into it —
 * endpoint errors can carry request bodies.
 *
 * **Example** (Recording an unreachable collector)
 *
 * ```ts
 * import { AiMetricsForwarderOtlpExportFailed } from "@beep/repo-ai-metrics"
 *
 * const failed = AiMetricsForwarderOtlpExportFailed.make({
 *   endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *   ingestRunId: "forwarder-1",
 *   message: "Phoenix was unavailable.",
 *   status: "failed",
 *   target: "local"
 * })
 *
 * console.log(failed.status) // "failed"
 * console.log(failed.ingestRunId) // "forwarder-1"
 * ```
 *
 * @see {@link AiMetricsForwarderOtlpExport} for the tagged union that carries this member.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderOtlpExportFailed extends S.Opaque<
  AiMetricsForwarderOtlpExportFailed,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    endpointTraceUrl: S.String,
    ingestRunId: S.String,
    message: S.String,
    status: S.tag("failed"),
    target: AiMetricsDeployTarget,
  }).pipe(
    $I.annoteSchema("AiMetricsForwarderOtlpExportFailed", {
      description: "Sanitized failure recorded when post-forwarder derived OTLP export does not complete.",
    })
  )
) {}

/**
 * Whether a run's derived OTLP export succeeded, tagged by its `status` field.
 *
 * **Details**
 *
 * Tagging on `status` rather than carrying a nullable failure message means a
 * reader cannot look at `spanCount` on a failed export: the counts exist only on
 * the `exported` member. A run that never attempted an export omits the field
 * entirely, which is a third state distinct from both members.
 *
 * **Example** (Narrowing an export status)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderOtlpExport,
 *   AiMetricsForwarderOtlpExported
 * } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const exported = AiMetricsForwarderOtlpExported.make({
 *   endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *   ingestRunId: "forwarder-1",
 *   sessionSpanCount: 1,
 *   spanCount: 3,
 *   status: "exported",
 *   target: "local",
 *   turnSpanCount: 2
 * })
 *
 * console.log(S.is(AiMetricsForwarderOtlpExport)(exported)) // true
 * console.log(exported.status) // "exported"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiMetricsForwarderOtlpExport = S.Union([
  AiMetricsForwarderOtlpExported,
  AiMetricsForwarderOtlpExportFailed,
]).pipe(
  $I.annoteSchema("AiMetricsForwarderOtlpExport", {
    description: "Tagged post-forwarder derived OTLP export status for the same ingest run.",
  }),
  S.toTaggedUnion("status")
);

/**
 * Decoded export status carried by a forwarder run result.
 *
 * **Details**
 *
 * Narrowing on `status` selects between the exported and failed members, so
 * `spanCount` is reachable only after the `"exported"` check.
 *
 * @see {@link AiMetricsForwarderOtlpExport} for the runtime schema and its guard.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsForwarderOtlpExport = typeof AiMetricsForwarderOtlpExport.Type;

/**
 * Counts and storage paths a completed forwarder run is safe to report.
 *
 * **Details**
 *
 * Every field is a count, a path, an identifier, or a collection flag — nothing derived from
 * transcript content — so the result can be logged, printed by the CLI, or
 * exported without a privacy review. `configSnapshotId` is the join back to the
 * agent-configuration manifest that was in force for the run, which is what
 * makes a metric attributable to a guidance change. Hook and stamp-gap completeness
 * flags distinguish partial evidence from unstamped sessions. Failed shards and
 * rejected-record counts remain visible while decodable records are retained.
 * Unreadable gap evidence still prevents stamp joining. Historical results decode
 * with completeness flags set to false.
 *
 * **Example** (Reporting a completed run)
 *
 * ```ts
 * import { AiMetricsForwarderRunResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsForwarderRunResult.make({
 *   archiveObjectCount: 2,
 *   configSnapshotId: "config-1",
 *   duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *   ingestRunId: "forwarder-1",
 *   parquetExportMode: "snapshot",
 *   parquetTables: ["ai_metrics_turns"],
 *   rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw",
 *   sourceFileCount: 2,
 *   target: "local",
 *   turnCount: 24
 * })
 *
 * console.log(result.turnCount) // 24
 * console.log(result.sourceCoverage.length) // 0
 * ```
 *
 * @see {@link AiMetricsForwarderSourceCoverage} for the per-brand selection counts this result carries.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderRunResult extends S.Opaque<
  AiMetricsForwarderRunResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    archiveObjectCount: S.Natural,
    configSnapshotId: S.String,
    duckDbPath: S.String,
    ingestRunId: S.String,
    otlpExport: S.OptionFromOptionalKey(AiMetricsForwarderOtlpExport).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    parquetExportDir: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    parquetExportMode: AiMetricsParquetExportMode,
    parquetTables: S.Array(S.String),
    rawArchiveDir: S.String,
    sourceCoverage: S.Array(AiMetricsForwarderSourceCoverage).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    hookCollectionComplete: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    failedHookShards: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    hookRejectedRecords: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    stampGapCollectionComplete: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    stampGapRejectedRecords: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    sourceFileCount: S.Natural,
    target: AiMetricsDeployTarget,
    turnCount: S.Natural,
  }).pipe(
    $I.annoteSchema("AiMetricsForwarderRunResult", {
      description:
        "Safe counts, storage paths and explicit hook/stamp-gap collection completeness returned by one durable AI metrics forwarder run. Historical results default to unverified collection.",
    })
  )
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AiMetricsForwarderRunResult));
}

/**
 * Parameters for the systemd user timer that owns scheduled forwarder collection.
 *
 * **Details**
 *
 * `command[0]` must be an absolute executable path; the schema refines that,
 * because a unit's `ExecStart` resolves against the unit environment rather than
 * the operator's shell. `intervalMinutes` becomes `OnUnitInactiveSec`, so it is
 * the gap between runs, not a fixed wall-clock period.
 *
 * **Gotchas**
 *
 * `workingDirectory` becomes the unit's `WorkingDirectory`. Any relative path
 * elsewhere in the command binds to it, which is exactly how a data root once
 * ended up inside a clone — pass absolute paths for anything that is stored.
 *
 * **Example** (Describing a timer that runs every half hour)
 *
 * ```ts
 * import { AiMetricsForwarderTimerInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsForwarderTimerInput.make({
 *   command: ["/usr/bin/bun", "run", "beep", "ai-metrics", "forwarder"],
 *   lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *   statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *   workingDirectory: "/repo"
 * })
 *
 * console.log(input.intervalMinutes) // 30
 * console.log(input.serviceName) // "beep-ai-metrics-forwarder"
 * ```
 *
 * @see {@link renderAiMetricsForwarderTimerPlan} for the units rendered from this input.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderTimerInput extends S.Opaque<
  AiMetricsForwarderTimerInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    command: AiMetricsForwarderTimerCommand,
    hashSaltSecretRef: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    intervalMinutes: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(30)),
      S.withDecodingDefaultKey(Effect.succeed(30))
    ),
    lockPath: S.String,
    rawArchiveKeySecretRef: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    serviceName: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("beep-ai-metrics-forwarder")),
      S.withDecodingDefaultKey(Effect.succeed("beep-ai-metrics-forwarder"))
    ),
    statusPath: S.String,
    workingDirectory: S.String,
  }).pipe(
    $I.annoteSchema("AiMetricsForwarderTimerInput", {
      description: "Workstation timer parameters for scheduled AI metrics forwarder collection.",
    })
  )
) {}

/**
 * Rendered systemd user units and the operator commands that install them.
 *
 * **Details**
 *
 * The plan is render-only: it produces unit text and a command list for a human
 * to review and run. Nothing in it touches systemd, writes a unit file, or
 * enables a timer.
 *
 * **Gotchas**
 *
 * `installCommands` includes a step that truncates the collector's environment
 * file before repopulating it from the secret store. Running the list without an
 * authenticated secret session destroys the hash salt, which silently breaks
 * every hash join in an existing store. Review the list before running it.
 *
 * **Example** (Inspecting a rendered plan)
 *
 * ```ts
 * import { AiMetricsForwarderTimerPlan } from "@beep/repo-ai-metrics"
 *
 * const plan = AiMetricsForwarderTimerPlan.make({
 *   installCommands: ["systemctl --user enable --now beep-ai-metrics-forwarder.timer"],
 *   lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *   serviceUnit: "[Service]\nType=oneshot",
 *   serviceUnitName: "beep-ai-metrics-forwarder.service",
 *   statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *   timerUnit: "[Timer]\nOnUnitInactiveSec=30m",
 *   timerUnitName: "beep-ai-metrics-forwarder.timer"
 * })
 *
 * console.log(plan.timerUnitName) // "beep-ai-metrics-forwarder.timer"
 * console.log(plan.installCommands.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderTimerPlan extends S.Opaque<
  AiMetricsForwarderTimerPlan,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    installCommands: S.Array(S.String),
    lockPath: S.String,
    serviceUnit: S.String,
    serviceUnitName: S.String,
    statusPath: S.String,
    timerUnit: S.String,
    timerUnitName: S.String,
  }).pipe(
    $I.annoteSchema("AiMetricsForwarderTimerPlan", {
      description: "Systemd user timer artifacts that own P6a live collection on the workstation.",
    })
  )
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AiMetricsForwarderTimerPlan));
}

type ForwarderSourceFile = {
  readonly modifiedAtMillis: number;
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly sourceKind: AiMetricsTranscriptSource;
  readonly sourcePath: string;
};

type ForwarderSourceFiles = {
  readonly files: ReadonlyArray<ForwarderSourceFile>;
  readonly sizeExcludedFileCount: number;
};

const forwarderFailure = (message: string, cause: unknown): AiMetricsForwarderError =>
  AiMetricsForwarderError.make({ cause, message });

/**
 * Resolve the agent-evidence root the forwarder reads hook pulses from.
 *
 * **Details**
 *
 * `BEEP_AGENT_EVIDENCE_ROOT` wins when it is non-empty; otherwise the root is
 * `beep/agent-evidence` beneath {@link aiMetricsStateHome} of `XDG_STATE_HOME`
 * and `homeDir`, the same precedence as the hook writers'
 * `${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence}`
 * with the XDG absolute-only rule.
 *
 * **Gotchas**
 *
 * Without the override, a relative or empty `homeDir` and no absolute
 * `XDG_STATE_HOME` fail the run with an `AiMetricsForwarderError` instead of
 * reading hook pulses from a directory relative to the working directory.
 *
 * **Example** (Resolve beneath the home directory)
 *
 * ```ts
 * import { resolveForwarderEvidenceRoot } from "@beep/repo-ai-metrics"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 *
 * const root = resolveForwarderEvidenceRoot("/home/dev").pipe(
 *   Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
 * )
 * console.log(Effect.runSync(root)) // /home/dev/.local/state/beep/agent-evidence
 * ```
 *
 * @param homeDir - The home directory the forwarder run was given.
 * @returns The agent-evidence root.
 * @category utilities
 * @since 0.0.0
 */
export const resolveForwarderEvidenceRoot = Effect.fn("AiMetrics.resolveForwarderEvidenceRoot")(function* (
  homeDir: string
) {
  const override = yield* Config.option(Config.String("BEEP_AGENT_EVIDENCE_ROOT")).pipe(
    Effect.mapError((cause) => forwarderFailure("Cannot resolve hook evidence root.", cause))
  );
  const configured = O.filter(override, Str.isNonEmpty);
  if (O.isSome(configured)) {
    return configured.value;
  }
  const stateHome = yield* Config.option(Config.String("XDG_STATE_HOME")).pipe(
    Effect.map((value) =>
      aiMetricsStateHome(AiMetricsStateHomeInput.make({ homeDir: O.some(homeDir), stateHome: value }))
    ),
    Effect.mapError((cause) => forwarderFailure("Cannot resolve XDG state home.", cause))
  );
  return yield* O.match(stateHome, {
    onNone: () =>
      Effect.fail(
        forwarderFailure(
          "Cannot resolve hook evidence root: set BEEP_AGENT_EVIDENCE_ROOT, or an absolute XDG_STATE_HOME or home directory.",
          homeDir
        )
      ),
    onSome: (home) => Effect.succeed(agentEvidenceRoot(home)),
  });
});

const requireForwarderHashSalt = Effect.fn("AiMetrics.forwarder.requireHashSalt")(function* (
  input: AiMetricsForwarderInput
) {
  if (AiMetricsDeployTarget.is.local(input.target) || O.exists(input.hashSalt, flow(Str.trim, Str.isNonEmpty))) {
    return;
  }

  return yield* forwarderFailure(
    "AI metrics non-local forwarder runs require a resolved hash salt value.",
    input.target
  );
});

const systemdUnitFieldValue: (value: string) => string = Str.replace(/[\u0000-\u001f\u007f]/gu, " ");

const safeSystemdUnitNameStem = (value: string): string => {
  const sanitized = pipe(
    value,
    Str.replace(/[^A-Za-z0-9_.@-]/gu, "-"),
    Str.replace(/-+/gu, "-"),
    Str.replace(/^-|-$/gu, "")
  );
  return Str.isNonEmpty(sanitized) ? sanitized : "beep-ai-metrics-forwarder";
};

const shellCommandFromArgv: (argv: ReadonlyArray<string>) => string = flow(A.map(shellQuote), A.join(" "));

/**
 * Render a systemd user timer that repeatedly runs the forwarder with locking and status evidence.
 *
 * **Details**
 *
 * The service takes `lockPath` as a flock so an overrunning collection cannot
 * overlap the next fire, and writes `statusPath` through a `.tmp` sibling and a
 * rename so a reader never observes a partially written status file. Unit-field
 * values are stripped of control characters before interpolation.
 *
 * **Gotchas**
 *
 * Rendering is pure and does nothing to the machine. Every path interpolated
 * into the units must already be absolute — validate a data root with
 * {@link requireAbsoluteAiMetricsDataRoot} before calling, because a relative
 * path inside `ExecStart` silently binds to the unit's `WorkingDirectory`.
 *
 * **Example** (Rendering the units for an operator to review)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderTimerInput,
 *   renderAiMetricsForwarderTimerPlan
 * } from "@beep/repo-ai-metrics"
 *
 * const plan = renderAiMetricsForwarderTimerPlan(
 *   AiMetricsForwarderTimerInput.make({
 *     command: ["/usr/bin/bun", "run", "beep", "ai-metrics", "forwarder"],
 *     lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *     statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *     workingDirectory: "/repo"
 *   })
 * )
 *
 * console.log(plan.serviceUnitName) // "beep-ai-metrics-forwarder.service"
 * console.log(plan.timerUnit.includes("OnUnitInactiveSec=30m")) // true
 * ```
 *
 * @param input - Timer rendering input with service names, command text, status path, and secret references.
 * @returns A render-only systemd timer/service plan for operator installation.
 * @category services
 * @since 0.0.0
 */
export const renderAiMetricsForwarderTimerPlan = (input: AiMetricsForwarderTimerInput): AiMetricsForwarderTimerPlan => {
  const timerInput = AiMetricsForwarderTimerInput.make(input);
  const serviceName = safeSystemdUnitNameStem(timerInput.serviceName);
  const serviceUnitName = `${serviceName}.service`;
  const timerUnitName = `${serviceName}.timer`;
  const statusTmpPath = `${timerInput.statusPath}.tmp`;
  const envFileShellPath = "~/.config/beep/ai-metrics.env";
  const envFileUnitPath = "%h/.config/beep/ai-metrics.env";
  const command = shellCommandFromArgv(timerInput.command);
  const failureStatusPython =
    'import json,sys; print(json.dumps({"status":"failed","exitCode":int(sys.argv[1]),"diagnostic":"forwarder-command-failed"},separators=(",",":")))';
  const execCommand = pipe(
    [
      "set -euo pipefail",
      `mkdir -p "$(dirname ${shellQuote(timerInput.statusPath)})" "$(dirname ${shellQuote(timerInput.lockPath)})"`,
      "exit_code=0",
      `if flock -n ${shellQuote(timerInput.lockPath)} ${command} > ${shellQuote(statusTmpPath)} 2>/dev/null; then :; else exit_code=$?; python3 -c ${shellQuote(failureStatusPython)} "$exit_code" > ${shellQuote(statusTmpPath)}; fi`,
      `mv ${shellQuote(statusTmpPath)} ${shellQuote(timerInput.statusPath)}`,
      'exit "$exit_code"',
    ],
    A.join("; ")
  );
  const serviceUnit = pipe(
    [
      "[Unit]",
      "Description=Beep AI metrics forwarder collection",
      "StartLimitBurst=3",
      "StartLimitIntervalSec=30m",
      "",
      "[Service]",
      "Type=oneshot",
      `WorkingDirectory=${systemdUnitFieldValue(timerInput.workingDirectory)}`,
      `EnvironmentFile=${envFileUnitPath}`,
      "# The command uses the resolved Bun executable (preferring the mise shim) or the operator's --bun-path pin.",
      `ExecStart=/usr/bin/env bash -lc ${shellQuote(execCommand)}`,
      "Restart=on-failure",
      "RestartSec=5m",
      "",
    ],
    A.join("\n")
  );
  const timerUnit = pipe(
    [
      "[Unit]",
      "Description=Run Beep AI metrics forwarder collection",
      "",
      "[Timer]",
      "OnBootSec=5m",
      `OnUnitInactiveSec=${timerInput.intervalMinutes}m`,
      "RandomizedDelaySec=2m",
      "Persistent=true",
      "",
      "[Install]",
      "WantedBy=timers.target",
      "",
    ],
    A.join("\n")
  );
  const writeEnvFileCommands = [
    `install -m 0600 /dev/null ${envFileShellPath}`,
    ...pipe(
      timerInput.hashSaltSecretRef,
      O.map((secretRef) => [
        `printf 'BEEP_AI_METRICS_HASH_SALT=%s\\n' "$(op read ${shellQuote(secretRef)})" >> ${envFileShellPath}`,
      ]),
      O.getOrElse(A.empty<string>)
    ),
    ...pipe(
      timerInput.rawArchiveKeySecretRef,
      O.map((secretRef) => [
        `printf 'BEEP_AI_METRICS_RAW_ARCHIVE_KEY=%s\\n' "$(op read ${shellQuote(secretRef)})" >> ${envFileShellPath}`,
      ]),
      O.getOrElse(A.empty<string>)
    ),
  ];

  return AiMetricsForwarderTimerPlan.make({
    installCommands: [
      `mkdir -p ~/.config/systemd/user ~/.config/beep "$(dirname ${shellQuote(timerInput.statusPath)})"`,
      ...writeEnvFileCommands,
      `printf '%s\\n' ${shellQuote(serviceUnit)} > ~/.config/systemd/user/${serviceUnitName}`,
      `printf '%s\\n' ${shellQuote(timerUnit)} > ~/.config/systemd/user/${timerUnitName}`,
      `systemctl --user daemon-reload`,
      `systemctl --user enable --now ${timerUnitName}`,
      `systemctl --user status ${timerUnitName}`,
      `journalctl --user -u ${serviceUnitName} -n 80 --no-pager`,
    ],
    lockPath: timerInput.lockPath,
    serviceUnit,
    serviceUnitName,
    statusPath: timerInput.statusPath,
    timerUnit,
    timerUnitName,
  });
};

const isWithinModifiedTimeWindow =
  (input: AiMetricsForwarderInput) =>
  (info: FileSystem.File.Info): boolean =>
    input.includeAll ||
    O.isNone(input.sinceEpochMillis) ||
    O.exists(input.sinceEpochMillis, (since) => modifiedAtMillis(info) >= since);

const isWithinSizeWindow =
  (input: AiMetricsForwarderInput) =>
  (info: FileSystem.File.Info): boolean =>
    O.isNone(input.maxFileBytes) || O.exists(input.maxFileBytes, (maximum) => fileSizeBytes(info) <= maximum);

const sourcePathHashForDiagnostics = Effect.fn("AiMetrics.forwarder.sourcePathHashForDiagnostics")(function* (
  input: AiMetricsForwarderInput,
  sourceFile: ForwarderSourceFile
) {
  return yield* hashPrivateIdentifier(sourceFile.sourcePath, input.hashSalt).pipe(
    Effect.mapError((cause) =>
      forwarderFailure("Failed to hash AI metrics source path for diagnostics.", {
        cause,
        sourceKind: sourceFile.sourceKind,
      })
    )
  );
});

const jsonlSourceFiles = Effect.fn("AiMetrics.forwarder.jsonlSourceFiles")(function* (
  input: AiMetricsForwarderInput,
  root: string,
  sourceKind: AiMetricsTranscriptSource
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const sourcePaths = yield* collectJsonlFiles(root);
  const scannedFiles = yield* Effect.forEach(
    sourcePaths,
    Effect.fnUntraced(function* (sourcePath) {
      const info = yield* fs.stat(sourcePath).pipe(Effect.option);
      if (O.isNone(info) || info.value.type !== "File" || !isWithinModifiedTimeWindow(input)(info.value)) {
        return { excludedByMaxFileBytes: false, file: O.none<ForwarderSourceFile>() };
      }

      if (!isWithinSizeWindow(input)(info.value)) {
        return { excludedByMaxFileBytes: true, file: O.none<ForwarderSourceFile>() };
      }

      return {
        excludedByMaxFileBytes: false,
        file: O.some({
          modifiedAtMillis: modifiedAtMillis(info.value),
          relativePath: normalizedRelativePath(sourcePath, { pathApi, root }),
          sizeBytes: fileSizeBytes(info.value),
          sourceKind,
          sourcePath,
        }),
      };
    }),
    { concurrency: 16 }
  );

  return {
    files: pipe(
      scannedFiles,
      A.map((scan) => scan.file),
      A.getSomes
    ),
    sizeExcludedFileCount: pipe(
      scannedFiles,
      A.filter((scan) => scan.excludedByMaxFileBytes),
      A.length
    ),
  };
});

const openClawSourceFiles = Effect.fn("AiMetrics.forwarder.openClawSourceFiles")(function* (
  input: AiMetricsForwarderInput
) {
  const pathApi = yield* Path.Path;
  const unitPath = O.getOrElse(input.openClawUnitPath, () =>
    pathApi.join(input.homeDir, ".config/systemd/user/openclaw-gateway.service")
  );
  const info = yield* statOption(unitPath);
  if (O.isNone(info) || info.value.type !== "File" || !isWithinModifiedTimeWindow(input)(info.value)) {
    return {
      files: A.empty<ForwarderSourceFile>(),
      sizeExcludedFileCount: 0,
    };
  }

  if (!isWithinSizeWindow(input)(info.value)) {
    return {
      files: A.empty<ForwarderSourceFile>(),
      sizeExcludedFileCount: 1,
    };
  }

  return {
    files: A.of({
      modifiedAtMillis: modifiedAtMillis(info.value),
      relativePath: pathApi.basename(unitPath),
      sizeBytes: fileSizeBytes(info.value),
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      sourcePath: unitPath,
    }),
    sizeExcludedFileCount: 0,
  };
});

const byModifiedDescending: Order.Order<ForwarderSourceFile> = Order.mapInput(
  Order.Number,
  (file) => -file.modifiedAtMillis
);

class DiscoveryCursorRow extends S.Opaque<DiscoveryCursorRow, { readonly brand: unique symbol }>()(
  S.Struct({ cursorHash: Sha256Hex }).pipe(
    $I.annoteSchema("DiscoveryCursorRow", {
      description: "Last scheduled source-path hash, not an ingestion or delivery receipt.",
    })
  )
) {}

const selectSourceFiles = Effect.fn("AiMetrics.forwarder.selectSourceFiles")(function* (
  input: AiMetricsForwarderInput,
  sourceKind: AiMetricsTranscriptSource,
  sourceRoot: string,
  sourceFiles: ForwarderSourceFiles
) {
  const database = yield* DuckDb;
  const scopeId = yield* hashPrivateIdentifier(`discovery-v1:${sourceKind}:${sourceRoot}`, input.hashSalt).pipe(
    Effect.mapError((cause) => forwarderFailure("Failed to hash discovery scope.", cause))
  );
  const candidates = yield* Effect.forEach(
    sourceFiles.files,
    (file) => sourcePathHashForDiagnostics(input, file).pipe(Effect.map((pathHash) => ({ file, pathHash }))),
    { concurrency: 4 }
  );
  const sorted = A.sort(
    candidates,
    Order.mapInput(Order.String, (entry: (typeof candidates)[number]) => entry.pathHash)
  );
  // Cursor changes are transactional and bounded to one row per declared scan
  // root. Advance before content reads so an unreadable file cannot monopolize
  // every run. A crash can defer a file for one round; it does not acknowledge it.
  const includedFiles = yield* database
    .withTransaction((transaction) =>
      Effect.gen(function* () {
        yield* transaction.run(`CREATE TABLE IF NOT EXISTS ai_metrics_discovery_cursors (
      scope_id VARCHAR PRIMARY KEY,
      cursor_hash VARCHAR NOT NULL
    )`);
        const rows = yield* transaction.query(
          'SELECT cursor_hash AS "cursorHash" FROM ai_metrics_discovery_cursors WHERE scope_id = $scopeId',
          { scopeId }
        );
        const decoded = yield* S.decodeUnknownEffect(S.Array(DiscoveryCursorRow))(rows).pipe(
          Effect.mapError((cause) =>
            DuckDbError.make({
              cause: O.some(cause),
              message: "Failed to decode discovery cursor.",
              operation: "query",
            })
          )
        );
        const cursor = pipe(
          A.head(decoded),
          O.map((row) => row.cursorHash),
          O.getOrElse(() => "")
        );
        const next = A.take(
          [
            ...A.filter(sorted, (entry) => entry.pathHash > cursor),
            ...A.filter(sorted, (entry) => entry.pathHash <= cursor),
          ],
          input.maxFiles
        );
        const last = A.last(next);
        if (O.isSome(last)) {
          yield* transaction.run(
            `INSERT INTO ai_metrics_discovery_cursors (scope_id, cursor_hash) VALUES ($scopeId, $cursorHash)
         ON CONFLICT (scope_id) DO UPDATE SET cursor_hash = EXCLUDED.cursor_hash`,
            { scopeId, cursorHash: last.value.pathHash }
          );
        }
        return A.map(next, (entry) => entry.file);
      })
    )
    .pipe(Effect.mapError((cause) => forwarderFailure("Failed to advance bounded discovery cursor.", cause)));

  return {
    coverage: AiMetricsForwarderSourceCoverage.make({
      candidateFileCount: A.length(sorted),
      includedFileCount: A.length(includedFiles),
      limitedByMaxFiles: A.length(sorted) > A.length(includedFiles),
      sizeExcludedFileCount: sourceFiles.sizeExcludedFileCount,
      sourceKind,
    }),
    files: includedFiles,
  };
});

const discoverForwarderSourceFiles = Effect.fn("AiMetrics.forwarder.discoverSourceFiles")(function* (
  input: AiMetricsForwarderInput
) {
  const pathApi = yield* Path.Path;
  const { claudeRoot, codexRoot } = resolveTranscriptSourceRoots(input, pathApi);
  const [codexFiles, claudeFiles, openClawFiles] = yield* Effect.all(
    [
      jsonlSourceFiles(input, codexRoot, AiMetricsTranscriptSource.Enum.codex),
      jsonlSourceFiles(input, claudeRoot, AiMetricsTranscriptSource.Enum.claude),
      openClawSourceFiles(input),
    ] as const,
    { concurrency: 3 }
  );
  const selections = [
    yield* selectSourceFiles(input, AiMetricsTranscriptSource.Enum.codex, codexRoot, codexFiles),
    yield* selectSourceFiles(input, AiMetricsTranscriptSource.Enum.claude, claudeRoot, claudeFiles),
    yield* selectSourceFiles(input, AiMetricsTranscriptSource.Enum.openclaw, input.homeDir, openClawFiles),
  ] as const;

  return {
    coverage: A.map(selections, (selection) => selection.coverage),
    files: pipe(
      selections,
      A.flatMap((selection) => selection.files),
      A.sort(byModifiedDescending)
    ),
  };
});

const processSourceFile = Effect.fn("AiMetrics.forwarder.processSourceFile")(
  function* (
    input: AiMetricsForwarderInput,
    rawArchiveDir: string,
    sourceFile: ForwarderSourceFile,
    hookSalt: O.Option<string>
  ) {
    const fs = yield* FileSystem.FileSystem;
    const diagnosticSourcePathHash = yield* sourcePathHashForDiagnostics(input, sourceFile);
    const content = yield* fs.readFileString(sourceFile.sourcePath).pipe(
      Effect.mapError((_cause) =>
        forwarderFailure(`Failed to read AI metrics ${sourceFile.sourceKind} source file.`, {
          failure: "source_file_read_failed",
          sourceKind: sourceFile.sourceKind,
          sourcePathHash: diagnosticSourcePathHash,
        })
      )
    );
    const summary = yield* summarizeTranscriptText(
      AiMetricsTranscriptTextSummaryInput.make({
        content,
        hashSalt: input.hashSalt,
        sourceKind: sourceFile.sourceKind,
        sourcePath: sourceFile.sourcePath,
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to summarize AI metrics source file.", cause)));
    const archiveObject = yield* writeEncryptedRawArchiveObject({
      content,
      hashSalt: input.hashSalt,
      rawArchiveDir,
      rawArchiveKey: input.rawArchiveKey,
      sourceKind: sourceFile.sourceKind,
      sourcePath: sourceFile.sourcePath,
    }).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to write encrypted AI metrics raw archive object.", cause))
    );
    const privacy = yield* makeAiMetricsPrivacyCheckResult({
      content,
      hashSalt: input.hashSalt,
      relativePath: O.some(sourceFile.relativePath),
      sourcePath: sourceFile.sourcePath,
      summary,
    }).pipe(Effect.mapError((cause) => forwarderFailure("Failed to build AI metrics privacy projection.", cause)));

    const sessionIdentityHash = yield* readSessionIdentityHash(content, sourceFile.sourceKind, hookSalt).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to bind transcript session identity.", cause))
    );
    return ProcessedForwarderSource.make({
      record: AiMetricsDerivedTranscriptRecord.make({ archiveObject, privacy }),
      sessionIdentityHash,
      hookPathHash: yield* hashPrivateIdentifier(sourceFile.sourcePath, hookSalt).pipe(
        Effect.mapError((cause) => forwarderFailure("Failed to bind transcript path identity.", cause))
      ),
    });
  },
  (effect, _input, _rawArchiveDir, sourceFile) =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.forwarder.process_source_file", {
        attributes: {
          "ai_metrics.source_kind": sourceFile.sourceKind,
        },
      })
    )
);

/**
 * Run durable ingest: encrypted raw archive, DuckDB projection, and Parquet export.
 *
 * **Details**
 *
 * The run records identity before it records data. It resolves the install spec,
 * upserts the canonical root into the identity registry, and only then snapshots
 * configuration, archives raw transcripts, and projects derived rows — so a
 * store can never contain rows whose provenance is unreconstructable.
 * Configuration artifacts are written twice: once before derived storage as a
 * crash record, and again afterwards to promote the diff pointer.
 *
 * **Gotchas**
 *
 * The `DuckDb` requirement is not provided internally. Wrap the run with
 * {@link withAiMetricsDuckDb} so the connection scope closes with the run, and
 * point it at the same data root the input resolves to.
 *
 * **Example** (One local collection pass)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderInput,
 *   aiMetricsDerivedDuckDbPath,
 *   runAiMetricsForwarder,
 *   withAiMetricsDuckDb
 * } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect";
 * import * as Option from "effect/Option";
 * import * as Redacted from "effect/Redacted";
 * const dataRoot = "/home/dev/.local/state/beep/ai-metrics"
 *
 * const input = AiMetricsForwarderInput.make({
 *   dataRoot: Option.some(dataRoot),
 *   homeDir: "/home/dev",
 *   rawArchiveKey: Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
 *   repoRoot: "/work/repo"
 * })
 *
 * const program = withAiMetricsDuckDb(
 *   runAiMetricsForwarder(input),
 *   aiMetricsDerivedDuckDbPath(dataRoot)
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((result) => console.log(result.turnCount))
 * ```
 *
 * @effects
 * - Scans local Codex, Claude, and OpenClaw source locations.
 * - Upserts the run's canonical root into the identity registry.
 * - Reads selected source files and writes encrypted raw archive objects.
 * - Writes config snapshot artifacts before and after derived storage succeeds.
 * - Upserts derived rows into DuckDB and optionally refreshes Parquet exports.
 * @see {@link AiMetricsForwarderRunResult} for the counts and paths a completed run reports.
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsForwarder = Effect.fn("AiMetrics.runAiMetricsForwarder")(
  function* (input: AiMetricsForwarderInput) {
    const startedAtEpochMillis = yield* Clock.currentTimeMillis;
    yield* requireForwarderHashSalt(input);
    // Resolve before any write: an unresolvable root must not leave registry,
    // config-snapshot or raw-archive state behind.
    const evidenceRoot = yield* resolveForwarderEvidenceRoot(input.homeDir);
    const installSpec = yield* makeAiMetricsInstallSpec(
      AiMetricsInstallInput.make({
        dataRoot: input.dataRoot,
        hashSaltSecretRef: input.hashSaltSecretRef,
        rawArchiveKeySecretRef: input.rawArchiveKeySecretRef,
        target: input.target,
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to resolve AI metrics install storage layout.", cause)));
    const pathApi = yield* Path.Path;
    yield* upsertAiMetricsIdentityRegistry(
      AiMetricsIdentityRegistryUpsertInput.make({
        dataRoot: installSpec.storage.dataRoot,
        ...O.getSomesStruct({ hashSalt: input.hashSalt }),
        homeDir: input.homeDir,
        rootPath: pathApi.resolve(input.repoRoot),
        // Every kind this run scans, so openclaw-derived rows keep source-instance
        // provenance and stay joinable through the registry.
        sourceKinds: [
          AiMetricsTranscriptSource.Enum.codex,
          AiMetricsTranscriptSource.Enum.claude,
          AiMetricsTranscriptSource.Enum.openclaw,
        ],
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to upsert the AI metrics identity registry.", cause)));
    const configSnapshotDir = pathApi.join(installSpec.storage.dataRoot, "config-snapshots");
    const configSnapshot = yield* makeAiMetricsConfigSnapshot(
      AiMetricsConfigSnapshotInput.make({
        previousSnapshotPath: O.some(pathApi.join(configSnapshotDir, "latest.json")),
        repoRoot: input.repoRoot,
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to build AI metrics config snapshot.", cause)));
    yield* writeAiMetricsConfigSnapshotArtifacts({
      commitLatest: false,
      outputDir: configSnapshotDir,
      result: configSnapshot,
    }).pipe(Effect.mapError((cause) => forwarderFailure("Failed to persist AI metrics config snapshot.", cause)));
    const repoRootHash = yield* hashPrivateIdentifier(pathApi.resolve(input.repoRoot), input.hashSalt).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to hash AI metrics repo root.", cause))
    );
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .makeDirectory(pathApi.dirname(installSpec.storage.duckDbPath), { recursive: true })
      .pipe(Effect.mapError((cause) => forwarderFailure("Failed to prepare discovery state directory.", cause)));
    const sourceSelection = yield* discoverForwarderSourceFiles(input);
    const hookSalt = yield* hookPulseHashSalt.pipe(
      Effect.mapError((cause) => forwarderFailure("Cannot resolve hook hash namespace.", cause))
    );
    const records = yield* Effect.forEach(
      sourceSelection.files,
      (sourceFile) => processSourceFile(input, installSpec.storage.rawArchiveDir, sourceFile, hookSalt),
      { concurrency: 4 }
    );
    // Session-time stamps stay separate from the ingest-time snapshot. Unknown
    // or mixed stamps remain absent; backfill never receives today's regime.
    const stampGaps = yield* readStampGaps(evidenceRoot).pipe(Effect.option);
    const hookDir = hookPulseLedgerDir(evidenceRoot);
    const shardListing = yield* fs.readDirectory(hookDir).pipe(Effect.option);
    const shards = O.getOrElse(shardListing, A.empty<string>);
    const stamps = MutableHashMap.empty<string, HashSet.HashSet<string>>();
    const sessions = MutableHashMap.empty<string, HashSet.HashSet<string>>();
    const freshStarts = MutableHashMap.empty<string, HashSet.HashSet<number>>();
    const firstObserved = MutableHashMap.empty<string, number>();
    const lastObserved = MutableHashMap.empty<string, number>();
    const endings = MutableHashMap.empty<string, number>();
    const sessionLastObserved = MutableHashMap.empty<string, number>();
    let failedHookShards = HashSet.empty<string>();
    let hookRejectedRecords = 0;
    let hookCollectionComplete = O.isSome(shardListing);
    yield* Effect.forEach(
      A.filter(shards, Str.endsWith(".ndjson")),
      Effect.fnUntraced(function* (name) {
        const text = yield* fs.readFileString(pathApi.join(hookDir, name)).pipe(
          Effect.match({
            onFailure: () => {
              hookCollectionComplete = false;
              failedHookShards = HashSet.add(failedHookShards, name);
              return "";
            },
            onSuccess: identity,
          })
        );
        for (const line of A.filter(Str.split(text, "\n"), Str.isNonEmpty)) {
          Result.match(HookPulseV1.decodeJsonResult(line), {
            onFailure: () => {
              hookCollectionComplete = false;
              hookRejectedRecords += 1;
              failedHookShards = HashSet.add(failedHookShards, name);
            },
            onSuccess: (pulse) =>
              collectSessionStamp(
                { stamps, sessions, freshStarts, firstObserved, lastObserved, endings, sessionLastObserved },
                pulse
              ),
          });
        }
      }),
      { discard: true }
    );
    // Completeness describes collection only. Qualification comes from each record's own
    // join outcome; completeness only decides whether an unresolved join is a verdict.
    const sessionStampCompleteness = aiMetricsSessionStampCompletenessFor(
      hookCollectionComplete,
      O.exists(stampGaps, (loaded) => loaded.rejectedRecords === 0)
    );
    const stampedRecords = A.map(records, ({ record, sessionIdentityHash, hookPathHash }) => {
      const sanitized = record.privacy.sanitized;
      const kind = AiMetricsTranscriptSource.match(sanitized.sourceKind, {
        claude: () => O.some(HookPulseAgentKind.Enum["claude-code"]),
        codex: () => O.some(HookPulseAgentKind.Enum["codex-cli"]),
        openclaw: O.none<HookPulseAgentKind>,
      });
      const sessionHarnessHash = O.flatMap(kind, (agentKind) => {
        const key = `${agentKind}:${hookPathHash}`;
        const observedThrough = MutableHashMap.get(sessions, key).pipe(
          O.flatMap((identities) => A.head(A.fromIterable(identities))),
          O.flatMap((identity) => MutableHashMap.get(sessionLastObserved, `${agentKind}:${identity}`))
        );
        const closedAt = O.filter(
          MutableHashMap.get(endings, key),
          (end) =>
            O.exists(MutableHashMap.get(lastObserved, key), (last) => end >= last) &&
            O.exists(observedThrough, (last) => end >= last) &&
            O.exists(O.flatMap(sanitized.lastTimestamp, timestampEpoch), (last) => end >= last)
        );
        if (
          !recordAvoidsStampGaps(
            record,
            agentKind,
            O.map(stampGaps, (loaded) => loaded.gaps),
            closedAt,
            MutableHashMap.get(firstObserved, key),
            observedThrough
          )
        )
          return O.none();
        return pipe(
          MutableHashMap.get(sessions, key),
          O.filter(() =>
            O.exists(
              MutableHashMap.get(firstObserved, key),
              (first) =>
                O.exists(O.flatMap(sanitized.firstTimestamp, timestampEpoch), (beginning) => first <= beginning) &&
                O.exists(MutableHashMap.get(freshStarts, key), (starts) => HashSet.has(starts, first))
            )
          ),
          O.filter(
            (values) =>
              HashSet.size(values) === 1 && O.exists(sessionIdentityHash, (identity) => HashSet.has(values, identity))
          ),
          O.flatMap(() => MutableHashMap.get(stamps, key)),
          O.filter((values) => HashSet.size(values) === 1 && !HashSet.has(values, "unknown")),
          O.flatMap((values) => A.head(A.fromIterable(values)))
        );
      });
      const join = sessionStampJoinFor({
        gaps: O.map(stampGaps, (loaded) => loaded.gaps),
        index: { sessions, stamps },
        kind,
        pathHash: hookPathHash,
        record,
        retained: O.isSome(sessionHarnessHash),
        sessionIdentityHash,
      });
      return AiMetricsDerivedTranscriptRecord.make({
        ...record,
        sessionHarnessHash: O.map(sessionHarnessHash, HarnessHash.make),
        sessionStampCompleteness,
        sessionStampQualification: aiMetricsSessionStampQualificationFor(join, sessionStampCompleteness),
      });
    });
    const ingestRunId = `forwarder-${startedAtEpochMillis}`;
    const derived = yield* writeAiMetricsDerivedStorage(
      AiMetricsDerivedStorageWriteInput.make({
        configSnapshot: configSnapshot.snapshot,
        ingestRunId,
        parquetExportMode: input.parquetExportMode,
        records: stampedRecords,
        repoRootHash,
        startedAtEpochMillis,
        storage: installSpec.storage,
        target: input.target,
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to write AI metrics derived storage.", cause)));
    yield* writeAiMetricsConfigSnapshotArtifacts({
      outputDir: configSnapshotDir,
      result: configSnapshot,
    }).pipe(Effect.mapError((cause) => forwarderFailure("Failed to commit latest AI metrics config snapshot.", cause)));

    return AiMetricsForwarderRunResult.make({
      archiveObjectCount: derived.archiveObjectCount,
      configSnapshotId: configSnapshot.snapshot.snapshotId,
      duckDbPath: derived.duckDbPath,
      ingestRunId: derived.ingestRunId,
      parquetExportDir: derived.parquetExportDir,
      parquetExportMode: derived.parquetExportMode,
      parquetTables: derived.parquetTables,
      rawArchiveDir: installSpec.storage.rawArchiveDir,
      sourceCoverage: sourceSelection.coverage,
      hookCollectionComplete,
      failedHookShards: A.fromIterable(failedHookShards),
      hookRejectedRecords,
      stampGapCollectionComplete: O.exists(stampGaps, (loaded) => loaded.rejectedRecords === 0),
      stampGapRejectedRecords: O.getOrElse(
        O.map(stampGaps, (loaded) => loaded.rejectedRecords),
        () => 0
      ),
      sourceFileCount: derived.sourceFileCount,
      target: input.target,
      turnCount: derived.turnCount,
    });
  },
  (effect, input) =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.forwarder.run", {
        attributes: {
          "ai_metrics.include_all": input.includeAll,
          "ai_metrics.max_files": input.maxFiles,
          "ai_metrics.parquet_export_mode": input.parquetExportMode,
          "ai_metrics.target": input.target,
        },
      })
    )
);

/**
 * Encode a forwarder run result as the JSON the CLI prints and the status file stores.
 *
 * **Details**
 *
 * Encoding goes through the schema rather than `JSON.stringify`, so the text
 * round-trips back through {@link AiMetricsForwarderRunResult} and absent
 * optional keys stay absent instead of becoming `undefined`.
 *
 * **Example** (Encoding a completed run for the status file)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderRunResult,
 *   forwarderRunResultToJson
 * } from "@beep/repo-ai-metrics"
 * import * as Effect from "effect/Effect";
 * const result = AiMetricsForwarderRunResult.make({
 *   archiveObjectCount: 0,
 *   configSnapshotId: "config-1",
 *   duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *   ingestRunId: "forwarder-1",
 *   parquetExportMode: "snapshot",
 *   parquetTables: [],
 *   rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw",
 *   sourceFileCount: 0,
 *   target: "local",
 *   turnCount: 0
 * })
 *
 * const json = Effect.runSync(forwarderRunResultToJson(result))
 *
 * console.log(json.includes("forwarder-1")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const forwarderRunResultToJson: (
  result: AiMetricsForwarderRunResult
) => Effect.Effect<string, AiMetricsForwarderError> = Effect.fn("AiMetrics.forwarderRunResultToJson")(
  function* (result) {
    return yield* AiMetricsForwarderRunResult.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to encode AI metrics forwarder result as JSON.", cause))
    );
  }
);

/**
 * Encode a rendered timer plan as JSON for machine-readable operator output.
 *
 * **Details**
 *
 * The unit text is carried as JSON string fields rather than being written to
 * disk, so a caller can diff a proposed plan against the units already
 * installed before changing anything on the machine.
 *
 * **Example** (Encoding a plan for review)
 *
 * ```ts
 * import { AiMetricsForwarderTimerPlan, forwarderTimerPlanToJson } from "@beep/repo-ai-metrics"
 * import * as Effect from "effect/Effect";
 * const json = Effect.runSync(
 *   forwarderTimerPlanToJson(
 *     AiMetricsForwarderTimerPlan.make({
 *       installCommands: [],
 *       lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *       serviceUnit: "[Service]\nType=oneshot",
 *       serviceUnitName: "beep-ai-metrics-forwarder.service",
 *       statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *       timerUnit: "[Timer]\nOnUnitInactiveSec=30m",
 *       timerUnitName: "beep-ai-metrics-forwarder.timer"
 *     })
 *   )
 * )
 *
 * console.log(json.includes("beep-ai-metrics-forwarder.timer")) // true
 * ```
 *
 * @see {@link renderAiMetricsForwarderTimerPlan} for the renderer that produces the plan.
 * @category utilities
 * @since 0.0.0
 */
export const forwarderTimerPlanToJson: (
  result: AiMetricsForwarderTimerPlan
) => Effect.Effect<string, AiMetricsForwarderError> = Effect.fn("AiMetrics.forwarderTimerPlanToJson")(
  function* (result) {
    return yield* AiMetricsForwarderTimerPlan.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to encode AI metrics forwarder timer plan as JSON.", cause))
    );
  }
);
