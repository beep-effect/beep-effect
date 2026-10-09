/**
 * Candidate-surface enumeration and hook-pulse session-window observation for
 * `harness-ledger prune-proposals`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  contextSurfaceId,
  HookPulseAgentKind,
  HookPulseClientCoverage,
  HookPulseDisarmSentinel,
  HookPulseDisarmWindow,
  HookPulseEvent,
  HookPulseRefusal,
  HookPulseRefusalReason,
  HookPulseV1,
  hashPrivateIdentifier,
  hookPulseHashSalt,
} from "@beep/repo-ai-metrics";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { A, O, pipe, Str } from "@beep/utils";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { HarnessLedgerIoError } from "../HarnessLedger.errors.ts";
import {
  HarnessTelemetryReconciliation,
  ObservedSessionWindow,
  PrunableSurfaceKind,
  PruneSurfaceCandidate,
} from "../HarnessLedger.schemas.ts";
import { listDirectorySorted } from "./Fs.ts";
import type { HarnessHash } from "@beep/repo-ai-metrics";

const $I = $RepoCliId.create("commands/HarnessLedger/internal/PruneWindow");

const McpConfig = S.fromJsonString(
  S.Struct({
    mcpServers: S.optionalKey(S.Record(S.String, S.Unknown)),
  })
);
const decodeMcpConfig = S.decodeUnknownEffect(McpConfig);

const readMcpServerNames = Effect.fn("HarnessLedger.readMcpServerNames")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(file).pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to inspect ${file}.`)));
  if (!exists) {
    return A.empty<string>();
  }
  const text = yield* fs
    .readFileString(file)
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to read ${file}.`)));
  const config = yield* decodeMcpConfig(text).pipe(
    Effect.mapError(HarnessLedgerIoError.wrap(".mcp.json does not decode as { mcpServers?: Record<string, unknown> }."))
  );
  return pipe(O.fromUndefinedOr(config.mcpServers), O.map(R.keys), O.getOrElse(A.empty<string>), A.sort(Order.String));
});

/**
 * Enumerate prunable surfaces from a repo root: `.claude/skills/<dir>/SKILL.md`
 * as `skill:<dir>` and the server
 * names in `.mcp.json` as `mcp-server:<name>`. Hooks are excluded until
 * execution telemetry can distinguish unused hooks from always-on hooks.
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const enumeratePruneCandidates = Effect.fn("HarnessLedger.enumeratePruneCandidates")(function* (
  repoRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skillsDir = path.join(repoRoot, ".claude", "skills");
  const skills = yield* listDirectorySorted(skillsDir).pipe(
    Effect.flatMap((names) =>
      Effect.filter(names, (name) =>
        fs.exists(path.join(skillsDir, name, "SKILL.md")).pipe(Effect.orElseSucceed(() => false))
      )
    )
  );
  const servers = yield* readMcpServerNames(path.join(repoRoot, ".mcp.json"));
  const refs = A.flatten([
    A.map(skills, (name) => [PrunableSurfaceKind.Enum.skill, name] as const),
    A.map(servers, (name) => [PrunableSurfaceKind.Enum["mcp-server"], name] as const),
  ]);
  return yield* Effect.forEach(refs, ([kind, name]) =>
    contextSurfaceId(kind, name).pipe(
      Effect.map((surfaceId) => PruneSurfaceCandidate.make({ kind, name, surfaceId })),
      Effect.mapError(HarnessLedgerIoError.wrap(`Failed to hash surface ${kind}:${name}.`))
    )
  );
});

const ActivityToolEvent = HookPulseEvent.pick(["PreToolUse", "PostToolUse", "PostToolUseFailure"]);
const TerminalToolEvent = HookPulseEvent.pick(["PostToolUse", "PostToolUseFailure"]);
const isSupportedAgentKind = S.is(HookPulseAgentKind);
const isActivityToolEvent = S.is(ActivityToolEvent);
const isTerminalToolEvent = S.is(TerminalToolEvent);
const isUnknownStart = (pulse: HookPulseV1) => pulse.hookEvent === "SessionStart" && O.isNone(pulse.harnessHash);

const ANY_SHARD = /^hook-pulse-.*\.ndjson$/;

// Which side of the current harness a session falls on. `in-regime`: at least
// one SessionStart stamp, every stamp equal to the current harness hash.
// `out-of-regime`: stamped, but some stamp names another harness (a session
// restarted across a harness edit is mixed and lands here). `unstamped`: no
// stamp at all.
const SessionRegime = LiteralKit(["in-regime", "out-of-regime", "unstamped"]);
type SessionRegime = typeof SessionRegime.Type;

type SessionTally = {
  readonly minTs: number;
  readonly endedAt: O.Option<number>;
  readonly maxTs: number;
  readonly agentKind: HookPulseAgentKind;
  readonly parent: string;
  readonly key: string;
  readonly userTurns: number;
  readonly toolEvents: number;
  readonly primary: boolean;
  readonly child: boolean;
  readonly unknownStart: boolean;
  readonly freshStarts: HashSet.HashSet<number>;
  readonly surfaces: HashSet.HashSet<string>;
  readonly stamps: HashSet.HashSet<string>;
};

const regimeOf = (tally: SessionTally, harnessHash: HarnessHash): SessionRegime =>
  pipe(
    O.liftPredicate(tally.stamps, (stamps) => !HashSet.isEmpty(stamps)),
    O.match({
      onNone: F.constant(SessionRegime.Enum.unstamped),
      onSome: (stamps) =>
        HashSet.every(stamps, (stamp) => stamp === harnessHash)
          ? SessionRegime.Enum["in-regime"]
          : SessionRegime.Enum["out-of-regime"],
    })
  );

const byNewestFirst = Order.flip(Order.mapInput(Order.Number, (tally: SessionTally) => tally.maxTs));

// The mutable state one observation threads through its shard reads: the
// per-session tallies, collection counters and disarm provenance.
type ShardScan = {
  readonly stateDir: string;
  readonly tallies: MutableHashMap.MutableHashMap<string, SessionTally>;
  undecodableLines: number;
  shardsRead: number;
  readonly disarmWindows: ReadonlyArray<HookPulseDisarmWindow>;
  readonly openDisarm: boolean;
  readonly openDisarmSince: O.Option<number>;
  readonly provenDisarmed: boolean;
  readonly writerRefusalsTotal: number;
  readonly refusalRows: ReadonlyArray<HookPulseRefusal>;
  readonly refusalUndecodableLines: number;
  readonly refusalsByAgentKind: ObservedSessionWindow["refusalsByAgentKind"];
};

// Fold production rows into client/session/transcript tallies across all shards.
const countPrimaryEvent = (pulse: HookPulseV1, event: (value: HookPulseEvent) => boolean): number =>
  O.contains(pulse.sessionRole, "primary") && event(pulse.hookEvent) ? 1 : 0;

const foldPulse = (tallies: ShardScan["tallies"], pulse: HookPulseV1): void => {
  if (pulse.instrumentClass !== "production") return;
  const ts = DateTime.toEpochMillis(pulse.ts);
  const parent = `${pulse.agentKind}:${pulse.sessionId}`;
  const key = `${parent}:${O.getOrElse(pulse.transcriptPath, () => "no-transcript")}`;
  const tally = O.getOrElse(MutableHashMap.get(tallies, key), () => ({
    minTs: ts,
    endedAt: O.none<number>(),
    maxTs: ts,
    agentKind: pulse.agentKind,
    parent,
    key,
    userTurns: 0,
    toolEvents: 0,
    primary: false,
    child: false,
    unknownStart: false,
    freshStarts: HashSet.empty<number>(),
    surfaces: HashSet.empty<string>(),
    stamps: HashSet.empty<string>(),
  }));
  MutableHashMap.set(tallies, key, {
    ...tally,
    primary: tally.primary || O.contains(pulse.sessionRole, "primary"),
    child: tally.child || O.contains(pulse.sessionRole, "subagent"),
    unknownStart: tally.unknownStart || isUnknownStart(pulse),
    freshStarts: O.contains(pulse.sessionStartSource, "startup")
      ? HashSet.add(tally.freshStarts, ts)
      : tally.freshStarts,
    minTs: Math.min(tally.minTs, ts),
    endedAt: O.filter(
      pulse.hookEvent === "SessionEnd" && O.contains(pulse.sessionRole, "primary") ? O.some(ts) : tally.endedAt,
      (end) => end >= Math.max(tally.maxTs, ts)
    ),
    userTurns: tally.userTurns + countPrimaryEvent(pulse, HookPulseEvent.is.UserPromptSubmit),
    toolEvents: tally.toolEvents + countPrimaryEvent(pulse, isActivityToolEvent),
    maxTs: Math.max(tally.maxTs, ts),
    surfaces: O.match(pulse.surface, {
      onNone: () => tally.surfaces,
      onSome: (surface) => HashSet.add(tally.surfaces, surface),
    }),
    stamps: O.match(pulse.harnessHash, {
      onNone: () => tally.stamps,
      onSome: (stamp) => HashSet.add(tally.stamps, stamp),
    }),
  });
};

const foldShardText = (scan: ShardScan, text: string): void => {
  scan.shardsRead += 1;
  for (const line of pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty))) {
    Result.match(HookPulseV1.decodeJsonResult(line), {
      onFailure: () => {
        scan.undecodableLines += 1;
      },
      onSuccess: (pulse) => foldPulse(scan.tallies, pulse),
    });
  }
};

const readShard = Effect.fnUntraced(function* (scan: ShardScan, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs
    .readFileString(path.join(scan.stateDir, name))
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to read hook-pulse shard ${name}.`)));
  foldShardText(scan, text);
});

// Skipped sessions of `regime` newer than the window's oldest session; every
// visited skipped session when the window is not full (then every session
// was read).
const countSkipped = (
  ranked: ReadonlyArray<SessionTally>,
  oldest: O.Option<SessionTally>,
  harnessHash: HarnessHash,
  regime: SessionRegime
): number =>
  A.length(
    A.filter(
      ranked,
      (tally) => regimeOf(tally, harnessHash) === regime && !O.exists(oldest, (last) => tally.maxTs < last.maxTs)
    )
  );

const windowReport = (
  scan: ShardScan,
  visited: ShardScan["tallies"],
  window: number,
  harnessHash: HarnessHash,
  agentKind: HookPulseAgentKind
): ObservedSessionWindow => {
  const ranked = pipe(A.fromIterable(MutableHashMap.values(visited)), A.sort(byNewestFirst));
  const overlapsDisarm = (tally: SessionTally) =>
    (scan.openDisarm &&
      O.match(scan.openDisarmSince, { onNone: () => true, onSome: (start) => tally.maxTs >= start })) ||
    A.some(
      scan.disarmWindows,
      (gap) =>
        tally.minTs <= DateTime.toEpochMillis(DateTime.makeUnsafe(gap.rearmedAt)) &&
        O.match(gap.disarmedAt, {
          onNone: () => true,
          onSome: (start) => tally.maxTs >= DateTime.toEpochMillis(DateTime.makeUnsafe(start)),
        })
    );
  const overlapsRefusal = (tally: SessionTally) =>
    scan.refusalUndecodableLines > 0 ||
    A.some(
      scan.refusalRows,
      (row) =>
        row.reason !== HookPulseRefusalReason.Enum["stamp-failed"] &&
        (row.agentKind === "unknown" || row.agentKind === tally.agentKind) &&
        DateTime.toEpochMillis(row.ts) + 999 >= tally.minTs &&
        !O.exists(tally.endedAt, (end) => end < DateTime.toEpochMillis(row.ts))
    );
  // Group once: summaries and root selection never scan the complete history
  // from inside a per-transcript predicate.
  const groups = A.groupBy(ranked, (tally) => tally.parent);
  const roots = R.map(groups, (group) => {
    const primary = A.filter(group, (tally) => tally.primary && !tally.child);
    return A.length(primary) === 1 ? A.head(primary) : O.none<SessionTally>();
  });
  const isSelectedRoot = (tally: SessionTally) =>
    O.exists(O.flatten(R.get(roots, tally.parent)), (root) => root.key === tally.key);
  const missingOpening = (tally: SessionTally) =>
    tally.primary && (!isSelectedRoot(tally) || !HashSet.has(tally.freshStarts, tally.minTs));
  const summaries = R.map(groups, (group) =>
    A.reduce(
      group,
      {
        ...A.headNonEmpty(group),
        stamps: A.reduce(group, HashSet.empty<string>(), (acc, other) => HashSet.union(acc, other.stamps)),
        primary: A.some(group, (other) => other.primary && !other.child),
        child: A.every(group, (other) => other.child),
        unknownStart: A.some(group, (other) => other.unknownStart || missingOpening(other)),
        userTurns: 0,
        toolEvents: 0,
        endedAt: O.none<number>(),
      },
      (acc, other) => ({
        ...acc,
        minTs: Math.min(acc.minTs, other.minTs),
        endedAt: isSelectedRoot(other) ? other.endedAt : acc.endedAt,
        maxTs: Math.max(acc.maxTs, other.maxTs),
        userTurns: acc.userTurns + (isSelectedRoot(other) ? other.userTurns : 0),
        toolEvents: acc.toolEvents + (isSelectedRoot(other) ? other.toolEvents : 0),
      })
    )
  );
  const parentSummary = (tally: SessionTally): SessionTally => {
    const summary = O.getOrElse(R.get(summaries, tally.parent), () => tally);
    return { ...summary, endedAt: O.filter(summary.endedAt, (end) => end >= summary.maxTs) };
  };
  const parentRegime = (tally: SessionTally) => regimeOf(parentSummary(tally), harnessHash);
  const active = (tally: SessionTally) => {
    const summary = parentSummary(tally);
    return isSelectedRoot(tally) && summary.userTurns >= 1 && summary.toolEvents >= 1;
  };
  const qualifying = pipe(
    A.filter(
      ranked,
      (tally) =>
        scan.undecodableLines === 0 &&
        parentRegime(tally) === "in-regime" &&
        !parentSummary(tally).unknownStart &&
        active(tally) &&
        !overlapsDisarm(parentSummary(tally)) &&
        !overlapsRefusal(parentSummary(tally))
    ),
    A.map(parentSummary),
    A.sort(byNewestFirst)
  );
  const countFor = (kind: HookPulseAgentKind) => A.length(A.filter(qualifying, (tally) => tally.agentKind === kind));
  const counts = {
    "claude-code": countFor("claude-code"),
    "codex-cli": countFor("codex-cli"),
    "cursor-cli": countFor("cursor-cli"),
  };
  const inRegime = A.take(
    A.filter(qualifying, (tally) => tally.agentKind === agentKind),
    window
  );
  const selectedGrouped = A.filter(R.values(summaries), (tally) => tally.agentKind === agentKind);
  const oldest = A.length(inRegime) < window ? O.none<SessionTally>() : A.last(inRegime);
  return ObservedSessionWindow.make({
    harnessHash,
    sessionsObserved: A.length(inRegime),
    sessionsByAgentKind: counts,
    sessionsSkippedMixedFingerprint: A.length(A.filter(selectedGrouped, (tally) => HashSet.size(tally.stamps) > 1)),
    refusalsByAgentKind: scan.refusalsByAgentKind,
    clientCoverage: R.map(counts, () =>
      scan.provenDisarmed ? O.some(HookPulseClientCoverage.Enum.disabled) : O.none()
    ),
    sessionsSkippedDisarmed: A.length(A.filter(selectedGrouped, overlapsDisarm)),
    sessionsSkippedRefused: A.length(A.filter(selectedGrouped, overlapsRefusal)),
    sessionsSkippedCorrupt: scan.undecodableLines > 0 ? A.length(selectedGrouped) : 0,
    sessionsBelowActivityFloor: A.length(
      A.filter(
        selectedGrouped,
        (tally) => tally.primary && !tally.child && (tally.userTurns < 1 || tally.toolEvents < 1)
      )
    ),
    sessionsSkippedUnknownRestart: A.length(A.filter(selectedGrouped, (tally) => tally.unknownStart)),
    writerRefusalsTotal: scan.writerRefusalsTotal,
    sessionsSkippedRole: A.length(A.filter(selectedGrouped, (tally) => !tally.primary || tally.child)),
    sessionsSkippedOutOfRegime: countSkipped(selectedGrouped, oldest, harnessHash, SessionRegime.Enum["out-of-regime"]),
    sessionsSkippedUnstamped: countSkipped(selectedGrouped, oldest, harnessHash, SessionRegime.Enum.unstamped),
    windowEnd: pipe(
      A.head(inRegime),
      O.map((tally) => DateTime.makeUnsafe(tally.maxTs))
    ),
    touched: A.reduce(ranked, HashSet.empty<string>(), (acc, tally) => HashSet.union(acc, tally.surfaces)),
    shardsRead: scan.shardsRead,
    undecodableLines: scan.undecodableLines,
  });
};

const readRefusals = Effect.fn("HarnessLedger.readRefusals")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let refusalUndecodableLines = 0;
  let writerRefusalsTotal = 0;
  const refusalRows = A.empty<HookPulseRefusal>();
  const refusalsByAgentKind = { "claude-code": 0, "codex-cli": 0, "cursor-cli": 0 };
  for (const name of A.filter(yield* listDirectorySorted(root), (name) =>
    /^hook-pulse-refusals-.*\.ndjson$/.test(name)
  )) {
    const text = yield* fs
      .readFileString(path.join(root, name))
      .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot read payload-free refusal ledger.")));
    for (const line of A.filter(Str.split(text, "\n"), Str.isNonEmpty)) {
      Result.match(HookPulseRefusal.decodeJsonResult(line), {
        onFailure: () => {
          refusalUndecodableLines += 1;
        },
        onSuccess: (row) => {
          writerRefusalsTotal += 1;
          refusalRows.push(row);
          if (isSupportedAgentKind(row.agentKind)) refusalsByAgentKind[row.agentKind] += 1;
        },
      });
    }
  }
  return { refusalUndecodableLines, writerRefusalsTotal, refusalsByAgentKind, refusalRows };
});

/**
 * Read hook-pulse shards under `stateDir` and observe the last `window`
 * sessions that ran under `harnessHash`.
 *
 * **Details**
 *
 * Reads complete shards so restarted, mixed, child, and disarmed sessions
 * cannot be hidden by a date-bound shortcut. Windows are per client. A root
 * needs a user turn and a tool event; children add touches without adding
 * sessions. Invalid lines are counted. A missing state directory observes zero.
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const observeSessionWindow = Effect.fn("HarnessLedger.observeSessionWindow")(function* (
  stateDir: string,
  window: number,
  harnessHash: HarnessHash,
  agentKind: HookPulseAgentKind = "claude-code"
) {
  const names = A.filter(yield* listDirectorySorted(stateDir), (name) => ANY_SHARD.test(name));
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.dirname(stateDir);
  const windowsFile = path.join(root, "hook-pulse-disarm-windows.ndjson");
  const windowsExist = yield* fs
    .exists(windowsFile)
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot inspect disarm windows.")));
  const windowsText = windowsExist
    ? yield* fs
        .readFileString(windowsFile)
        .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot read disarm windows.")))
    : "";
  const windows = A.filterMap(Str.split(windowsText, "\n"), (line) => HookPulseDisarmWindow.decodeJsonResult(line));
  const sentinel = yield* Config.String("BEEP_HOOK_PULSE_DISARM_SENTINEL").pipe(
    Config.withDefault(path.join(root, "hook-pulse.disarmed")),
    Effect.map((value) => (value === "" ? path.join(root, "hook-pulse.disarmed") : value)),
    Effect.mapError(HarnessLedgerIoError.wrap("Cannot resolve disarm sentinel."))
  );
  const sentinelPresent = yield* fs.exists(sentinel).pipe(Effect.asSome, Effect.orElseSucceed(O.none<boolean>));
  const malformedWindows = A.some(A.filter(Str.split(windowsText, "\n"), Str.isNonEmpty), (line) =>
    Result.isFailure(HookPulseDisarmWindow.decodeJsonResult(line))
  );
  const openSentinel = O.contains(sentinelPresent, true)
    ? yield* fs
        .readFileString(sentinel)
        .pipe(
          Effect.map(F.flow(HookPulseDisarmSentinel.decodeJsonResult, Result.getSuccess)),
          Effect.orElseSucceed(O.none<HookPulseDisarmSentinel>)
        )
    : O.none<HookPulseDisarmSentinel>();
  const openDisarmSince = malformedWindows
    ? O.none<number>()
    : pipe(
        openSentinel,
        O.map((value) => DateTime.toEpochMillis(DateTime.makeUnsafe(value.disarmedAt)))
      );
  const openDisarm = O.getOrElse(sentinelPresent, () => true) || malformedWindows;
  const { refusalUndecodableLines, writerRefusalsTotal, refusalsByAgentKind, refusalRows } = yield* readRefusals(root);
  const scan: ShardScan = {
    stateDir,
    tallies: MutableHashMap.empty(),
    undecodableLines: refusalUndecodableLines,
    shardsRead: 0,
    disarmWindows: windows,
    openDisarm,
    openDisarmSince,
    provenDisarmed: O.getOrElse(sentinelPresent, () => false),
    writerRefusalsTotal,
    refusalsByAgentKind,
    refusalRows,
    refusalUndecodableLines,
  };
  yield* Effect.forEach(names, (name) => readShard(scan, name), { discard: true });
  return windowReport(scan, scan.tallies, window, harnessHash, agentKind);
});

// Only structural metadata is decoded. Content strings never leave this reader.
const TranscriptTool = S.Struct({ type: S.optionalKey(S.String), id: S.optionalKey(S.String) });
const TranscriptContent = S.Array(S.Unknown);
const isTranscriptContent = S.is(TranscriptContent);
const TranscriptRow = S.fromJsonString(
  S.Struct({
    type: S.optionalKey(S.String),
    sessionId: S.optionalKey(S.String),
    message: S.optionalKey(S.Struct({ content: S.optionalKey(S.Union([S.String, TranscriptContent])) })),
    payload: S.optionalKey(S.Struct({ id: S.optionalKey(S.String), type: S.optionalKey(S.String) })),
  })
);
const decodeTranscript = S.decodeUnknownResult(TranscriptRow);
const decodeTool = S.decodeUnknownOption(TranscriptTool);

class TranscriptTally extends S.Class<TranscriptTally>($I`TranscriptTally`)({
  session: S.OptionFromOptionalKey(S.String),
  identityConflict: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  calls: S.Natural,
  undecodableLines: S.Natural,
}) {}

class TranscriptFileCounts extends S.Class<TranscriptFileCounts>($I`TranscriptFileCounts`)({
  sessionHash: Sha256Hex,
  pathHash: Sha256Hex,
  calls: S.Natural,
  undecodableLines: S.Natural,
  identityConflict: S.Boolean,
  bindingHash: S.OptionFromOptionalKey(S.String),
}) {}

const transcriptToolCount = (row: typeof TranscriptRow.Type): number => {
  const content = row.message?.content;
  const claude = isTranscriptContent(content)
    ? A.length(A.filter(content, (block) => O.exists(decodeTool(block), (tool) => tool.type === "tool_use")))
    : 0;
  const codex =
    row.type === "response_item" && (row.payload?.type === "function_call" || row.payload?.type === "custom_tool_call")
      ? 1
      : 0;
  return claude + codex;
};

const foldTranscriptLine = (tally: TranscriptTally, line: string): TranscriptTally =>
  Result.match(decodeTranscript(line), {
    onFailure: () => TranscriptTally.make({ ...tally, undecodableLines: tally.undecodableLines + 1 }),
    onSuccess: (row) => {
      const identity = O.orElse(O.fromUndefinedOr(row.sessionId), () =>
        row.type === "session_meta" ? O.fromUndefinedOr(row.payload?.id) : O.none<string>()
      );
      return TranscriptTally.make({
        ...tally,
        session: O.orElse(tally.session, () => identity),
        identityConflict:
          tally.identityConflict || O.exists(identity, (value) => O.exists(tally.session, (prior) => prior !== value)),
        calls: tally.calls + transcriptToolCount(row),
      });
    },
  });

class ReconciliationHookBinding extends S.Class<ReconciliationHookBinding>($I`ReconciliationHookBinding`)({
  identities: S.Array(S.String),
  count: S.Natural,
}) {}

const foldReconciliationHook = (
  row: HookPulseV1,
  agentKind: HookPulseAgentKind,
  bindings: MutableHashMap.MutableHashMap<string, ReconciliationHookBinding>,
  hooks: MutableHashMap.MutableHashMap<string, number>
): void => {
  if (row.instrumentClass !== "production" || row.agentKind !== agentKind || !isTerminalToolEvent(row.hookEvent))
    return;
  O.match(row.transcriptPath, {
    onNone: F.constVoid,
    onSome: (key) => {
      const prior = MutableHashMap.get(bindings, key);
      MutableHashMap.set(
        bindings,
        key,
        ReconciliationHookBinding.make({
          identities: A.dedupe([
            row.sessionId,
            ...O.getOrElse(
              O.map(prior, (value) => value.identities),
              A.empty<string>
            ),
          ]),
          count:
            O.getOrElse(
              O.map(prior, (value) => value.count),
              () => 0
            ) + 1,
        })
      );
      MutableHashMap.set(hooks, key, O.getOrElse(MutableHashMap.get(hooks, key), () => 0) + 1);
    },
  });
};

const readReconciliationHooks = Effect.fn("HarnessLedger.readReconciliationHooks")(function* (
  stateDir: string,
  agentKind: HookPulseAgentKind,
  bindings: MutableHashMap.MutableHashMap<string, ReconciliationHookBinding>,
  hooks: MutableHashMap.MutableHashMap<string, number>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let undecodableLines = 0;
  for (const shard of A.filter(yield* listDirectorySorted(stateDir), (name) => ANY_SHARD.test(name))) {
    const text = yield* fs
      .readFileString(path.join(stateDir, shard))
      .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot read reconciliation shard.")));
    for (const line of A.filter(Str.split(text, "\n"), Str.isNonEmpty)) {
      Result.match(HookPulseV1.decodeJsonResult(line), {
        onFailure: () => {
          undecodableLines += 1;
        },
        onSuccess: (row) => foldReconciliationHook(row, agentKind, bindings, hooks),
      });
    }
  }
  return undecodableLines;
});

const reconciliationRead = <A, E, R>(
  operation: Effect.Effect<A, E, R>,
  failures: Ref.Ref<HashSet.HashSet<string>>,
  identity: string
) =>
  operation.pipe(
    Effect.matchEffect({
      onFailure: () => Ref.update(failures, HashSet.add(identity)).pipe(Effect.as(O.none<A>())),
      onSuccess: Effect.succeedSome,
    })
  );

const transcriptRepresentativePriority = (
  file: string,
  canonical: string,
  pathHash: string,
  hooks: MutableHashMap.MutableHashMap<string, number>
) => {
  if (MutableHashMap.has(hooks, pathHash)) return 2;
  return canonical === file ? 1 : 0;
};

class ReconciliationTranscriptFile extends S.Class<ReconciliationTranscriptFile>($I`ReconciliationTranscriptFile`)({
  file: S.String,
  identity: S.String,
  hookKeys: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed(A.empty<string>()))),
  canonical: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
}) {}

const reconciliationTranscriptFiles = Effect.fn("HarnessLedger.reconciliationTranscriptFiles")(function* (
  dir: string,
  failures: Ref.Ref<HashSet.HashSet<string>>,
  ancestors = HashSet.empty<string>(),
  failureIdentity = dir
): Effect.fn.Return<
  ReadonlyArray<ReconciliationTranscriptFile>,
  HarnessLedgerIoError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = yield* reconciliationRead(fs.realPath(dir), failures, failureIdentity);
  if (O.isNone(resolved) || HashSet.has(ancestors, resolved.value)) return A.empty<ReconciliationTranscriptFile>();
  const nestedAncestors = HashSet.add(ancestors, resolved.value);
  const entries = yield* reconciliationRead(listDirectorySorted(dir), failures, resolved.value).pipe(
    Effect.map(O.getOrElse(A.empty<string>))
  );
  return A.flatten(
    yield* Effect.forEach(
      entries,
      Effect.fnUntraced(function* (entry) {
        const file = path.join(dir, entry);
        const info = yield* reconciliationRead(fs.stat(file), failures, path.join(resolved.value, entry));
        if (O.isNone(info)) return A.empty<ReconciliationTranscriptFile>();
        if (info.value.type === "Directory")
          return yield* reconciliationTranscriptFiles(
            file,
            failures,
            nestedAncestors,
            path.join(resolved.value, entry)
          );
        if (info.value.type !== "File" || !Str.endsWith(".jsonl")(entry))
          return A.empty<ReconciliationTranscriptFile>();
        return A.of(ReconciliationTranscriptFile.make({ file, identity: path.join(resolved.value, entry) }));
      }),
      { concurrency: 1 }
    )
  );
});

const selectTranscriptRepresentatives = Effect.fnUntraced(function* (
  files: ReadonlyArray<ReconciliationTranscriptFile>,
  hooks: MutableHashMap.MutableHashMap<string, number>,
  hashSalt: O.Option<string>,
  failures: Ref.Ref<HashSet.HashSet<string>>
) {
  const fs = yield* FileSystem.FileSystem;
  const selected = MutableHashMap.empty<
    string,
    { readonly candidate: ReconciliationTranscriptFile; readonly priority: number }
  >();
  for (const candidate of files) {
    const file = candidate.file;
    const canonical = yield* reconciliationRead(fs.realPath(file), failures, candidate.identity);
    if (O.isNone(canonical)) continue;
    const pathHash = yield* hashPrivateIdentifier(file, hashSalt).pipe(
      Effect.mapError(HarnessLedgerIoError.wrap("Cannot hash transcript alias identity."))
    );
    const priority = transcriptRepresentativePriority(file, canonical.value, pathHash, hooks);
    const prior = MutableHashMap.get(selected, canonical.value);
    const chosen = O.match(prior, {
      onNone: () => candidate,
      onSome: (old) => (old.priority >= priority ? old.candidate : candidate),
    });
    const hookKeys = A.dedupe([
      pathHash,
      yield* hashPrivateIdentifier(canonical.value, hashSalt).pipe(
        Effect.mapError(HarnessLedgerIoError.wrap("Cannot hash canonical transcript identity."))
      ),
      ...O.getOrElse(
        O.map(prior, (old) => old.candidate.hookKeys),
        A.empty<string>
      ),
    ]);
    MutableHashMap.set(selected, canonical.value, {
      candidate: ReconciliationTranscriptFile.make({ ...chosen, canonical, hookKeys }),
      priority: Math.max(
        priority,
        O.getOrElse(
          O.map(prior, (old) => old.priority),
          () => 0
        )
      ),
    });
  }
  return A.map(A.fromIterable(MutableHashMap.values(selected)), (entry) => entry.candidate);
});

const ParentSessionSegment = S.String.check(S.isPattern(/^[0-9a-f-]{36}$/));
const isParentSessionSegment = S.is(ParentSessionSegment);
const readTranscriptCounts = Effect.fn("HarnessLedger.readTranscriptCounts")(function* (
  candidate: ReconciliationTranscriptFile,
  transcriptDir: string,
  agentKind: HookPulseAgentKind,
  hashSalt: O.Option<string>,
  failures: Ref.Ref<HashSet.HashSet<string>>
) {
  const file = candidate.file;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* reconciliationRead(fs.readFileString(file), failures, candidate.identity).pipe(
    Effect.map(O.getOrElse(() => ""))
  );
  const tally = A.reduce(
    A.filter(Str.split(text, "\n"), Str.isNonEmpty),
    TranscriptTally.make({ session: O.none(), calls: 0, undecodableLines: 0 }),
    foldTranscriptLine
  );
  const physicalFile = candidate.canonical;
  const relative = O.isSome(physicalFile)
    ? Str.split(path.relative(transcriptDir, physicalFile.value), path.sep)
    : A.empty<string>();
  const parent =
    agentKind === "claude-code"
      ? A.findFirst(
          relative,
          (segment, index) =>
            isParentSessionSegment(segment) &&
            (relative[index + 1] === "subagents" || relative[index + 1] === "workflow")
        )
      : O.none<string>();
  const session = tally.identityConflict ? O.none<string>() : O.orElse(parent, () => tally.session);
  const sessionHash = yield* hashPrivateIdentifier(
    O.getOrElse(session, () => file),
    hashSalt
  ).pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot hash transcript identity.")));
  const pathHash = yield* hashPrivateIdentifier(file, hashSalt).pipe(
    Effect.mapError(HarnessLedgerIoError.wrap("Cannot hash transcript path."))
  );
  return TranscriptFileCounts.make({
    sessionHash,
    pathHash,
    calls: tally.calls,
    undecodableLines: tally.undecodableLines + (tally.identityConflict ? 1 : 0),
    identityConflict: tally.identityConflict || O.isNone(tally.session),
    bindingHash: O.isSome(tally.session)
      ? O.some(
          yield* hashPrivateIdentifier(tally.session.value, hashSalt).pipe(
            Effect.mapError(HarnessLedgerIoError.wrap("Cannot hash recorded transcript identity."))
          )
        )
      : O.none(),
  });
});

const reconciliationBasis = HookPulseAgentKind.$match({
  "codex-cli": F.constant(
    "failed-or-interrupted: exec wrappers are not one-to-one with inner hook calls; non-use unqualified"
  ),
  "cursor-cli": F.constant("unsupported transcript format; non-use unqualified"),
  "claude-code": F.constant(
    "aggregate ratio is advisory; per-tool identity, current window, and surface coverage remain unqualified"
  ),
});

/**
 * Reconcile every transcript file beneath a caller-selected root, including
 * nested Workflow and subagent files, against complete production hook shards.
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const reconcileTranscripts = Effect.fn("HarnessLedger.reconcileTranscripts")(function* (
  stateDir: string,
  transcriptDir: string,
  agentKind: HookPulseAgentKind
) {
  const hashSalt = yield* hookPulseHashSalt.pipe(
    Effect.mapError(HarnessLedgerIoError.wrap("Cannot resolve reconciliation hash namespace."))
  );
  const hooks = MutableHashMap.empty<string, number>();
  const bindings = MutableHashMap.empty<string, ReconciliationHookBinding>();
  let undecodableLines = yield* readReconciliationHooks(stateDir, agentKind, bindings, hooks);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonical = path.resolve(transcriptDir);
  const physicalRoot = yield* fs
    .realPath(canonical)
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot resolve transcript root.")));
  const failures = yield* Ref.make(HashSet.empty<string>());
  const files = yield* selectTranscriptRepresentatives(
    yield* reconciliationTranscriptFiles(canonical, failures),
    hooks,
    hashSalt,
    failures
  );
  const sessions = MutableHashMap.empty<string, number>();
  const selectedSessionHooks = MutableHashMap.empty<string, number>();
  const selectedPathHooks = MutableHashMap.empty<string, number>();
  const transcriptPaths = MutableHashMap.empty<string, number>();
  for (const file of files) {
    const counts = yield* readTranscriptCounts(file, physicalRoot, agentKind, hashSalt, failures);
    undecodableLines += counts.undecodableLines;
    if (counts.calls === 0) continue;
    MutableHashMap.set(
      sessions,
      counts.sessionHash,
      O.getOrElse(MutableHashMap.get(sessions, counts.sessionHash), () => 0) + counts.calls
    );
    MutableHashMap.set(transcriptPaths, counts.pathHash, counts.calls);
    const hookCount = counts.identityConflict
      ? 0
      : A.reduce(
          file.hookKeys,
          0,
          (sum, key) =>
            sum +
            O.getOrElse(
              O.filter(
                MutableHashMap.get(bindings, key),
                (binding) =>
                  A.length(binding.identities) === 1 &&
                  O.exists(counts.bindingHash, (identity) => A.contains(binding.identities, identity))
              ).pipe(O.map((binding) => binding.count)),
              () => 0
            )
        );
    if (hookCount > 0) {
      MutableHashMap.set(selectedPathHooks, counts.pathHash, hookCount);
      MutableHashMap.set(
        selectedSessionHooks,
        counts.sessionHash,
        O.getOrElse(MutableHashMap.get(selectedSessionHooks, counts.sessionHash), () => 0) + hookCount
      );
    }
  }
  undecodableLines += HashSet.size(yield* Ref.get(failures));
  const counts = agentKind === "claude-code" ? sessions : transcriptPaths;
  const matchedHooks = agentKind === "claude-code" ? selectedSessionHooks : selectedPathHooks;
  const transcriptToolEvents = A.reduce(A.fromIterable(MutableHashMap.values(counts)), 0, (sum, count) => sum + count);
  const hookedToolEvents = A.reduce(
    A.fromIterable(counts),
    0,
    (sum, [key]) => sum + O.getOrElse(MutableHashMap.get(matchedHooks, key), () => 0)
  );
  const sessionsWithoutHooks = A.length(
    A.filter(A.fromIterable(counts), ([key]) => !MutableHashMap.has(matchedHooks, key))
  );
  return HarnessTelemetryReconciliation.make({
    agentKind,
    transcriptFiles: A.length(files),
    transcriptToolEvents,
    hookedToolEvents,
    sessionsWithoutHooks,
    undecodableLines,
    ratio: transcriptToolEvents > 0 ? O.some(hookedToolEvents / transcriptToolEvents) : O.none<number>(),
    qualifiedForNonUse: false,
    basis: reconciliationBasis(agentKind),
  });
});
