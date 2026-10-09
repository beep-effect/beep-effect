/**
 * Candidate-surface enumeration and hook-pulse session-window observation for
 * `harness-ledger prune-proposals`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  contextSurfaceId,
  HookPulseAgentKind,
  HookPulseClientCoverage,
  HookPulseDisarmWindow,
  HookPulseEvent,
  HookPulseRefusal,
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
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
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
  readonly maxTs: number;
  readonly agentKind: HookPulseAgentKind;
  readonly parent: string;
  readonly key: string;
  readonly userTurns: number;
  readonly toolEvents: number;
  readonly disarmed: boolean;
  readonly primary: boolean;
  readonly child: boolean;
  readonly unknownStart: boolean;
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
// per-session tallies and the two counters the report carries.
type ShardScan = {
  readonly stateDir: string;
  readonly tallies: MutableHashMap.MutableHashMap<string, SessionTally>;
  undecodableLines: number;
  shardsRead: number;
  readonly disarmWindows: ReadonlyArray<HookPulseDisarmWindow>;
  readonly openDisarm: boolean;
  readonly provenDisarmed: boolean;
  readonly writerRefusalsTotal: number;
  readonly refusalsByAgentKind: ObservedSessionWindow["refusalsByAgentKind"];
};

// Split shard names into those indexed by session and date and those read
// eagerly because their name does not follow the naming scheme.
const foldPulse = (tallies: ShardScan["tallies"], pulse: HookPulseV1): void => {
  if (pulse.instrumentClass !== "production") return;
  const ts = DateTime.toEpochMillis(pulse.ts);
  const parent = `${pulse.agentKind}:${pulse.sessionId}`;
  const key = `${parent}:${O.getOrElse(pulse.transcriptPath, () => "no-transcript")}`;
  const tally = O.getOrElse(MutableHashMap.get(tallies, key), () => ({
    minTs: ts,
    maxTs: ts,
    agentKind: pulse.agentKind,
    parent,
    key,
    userTurns: 0,
    toolEvents: 0,
    disarmed: false,
    primary: false,
    child: false,
    unknownStart: false,
    surfaces: HashSet.empty<string>(),
    stamps: HashSet.empty<string>(),
  }));
  MutableHashMap.set(tallies, key, {
    ...tally,
    primary: tally.primary || O.contains(pulse.sessionRole, "primary"),
    child: tally.child || O.contains(pulse.sessionRole, "subagent"),
    unknownStart: tally.unknownStart || isUnknownStart(pulse),
    minTs: Math.min(tally.minTs, ts),
    userTurns:
      tally.userTurns + (O.contains(pulse.sessionRole, "primary") && pulse.hookEvent === "UserPromptSubmit" ? 1 : 0),
    toolEvents:
      tally.toolEvents + (O.contains(pulse.sessionRole, "primary") && isActivityToolEvent(pulse.hookEvent) ? 1 : 0),
    maxTs: Math.max(tally.maxTs, ts),
    surfaces: O.match(
      O.filter(pulse.surface, () => O.isSome(pulse.sessionRole)),
      {
        onNone: () => tally.surfaces,
        onSome: (surface) => HashSet.add(tally.surfaces, surface),
      }
    ),
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
  agentKind: HookPulseAgentKind,
  shared: boolean
): ObservedSessionWindow => {
  const ranked = pipe(A.fromIterable(MutableHashMap.values(visited)), A.sort(byNewestFirst));
  const overlapsDisarm = (tally: SessionTally) =>
    scan.openDisarm ||
    A.some(
      scan.disarmWindows,
      (gap) =>
        tally.minTs <= DateTime.toEpochMillis(DateTime.makeUnsafe(gap.rearmedAt)) &&
        O.match(gap.disarmedAt, {
          onNone: () => true,
          onSome: (start) => tally.maxTs >= DateTime.toEpochMillis(DateTime.makeUnsafe(start)),
        })
    );
  // A parent's first transcript is the root; nested transcripts contribute
  // touches to that root but never create extra qualifying sessions.
  const parentStamps = (tally: SessionTally) =>
    A.reduce(
      A.filter(ranked, (other) => other.parent === tally.parent),
      HashSet.empty<string>(),
      (acc, other) => HashSet.union(acc, other.stamps)
    );
  const parentSummary = (tally: SessionTally) => {
    const group = A.filter(ranked, (other) => other.parent === tally.parent);
    return A.reduce(
      group,
      {
        ...tally,
        stamps: parentStamps(tally),
        primary: A.some(group, (other) => other.primary && !other.child),
        child: A.every(group, (other) => other.child),
        unknownStart: A.some(group, (other) => other.unknownStart),
        userTurns: 0,
        toolEvents: 0,
      },
      (acc, other) => ({
        ...acc,
        minTs: Math.min(acc.minTs, other.minTs),
        maxTs: Math.max(acc.maxTs, other.maxTs),
        userTurns: acc.userTurns + (other.primary && !other.child ? other.userTurns : 0),
        toolEvents: acc.toolEvents + (other.primary && !other.child ? other.toolEvents : 0),
      })
    );
  };
  const parentRegime = (tally: SessionTally) => regimeOf(parentSummary(tally), harnessHash);
  const isChild = (tally: SessionTally) =>
    A.some(
      ranked,
      (other) =>
        other.parent === tally.parent &&
        other.primary &&
        !other.child &&
        (other.minTs < tally.minTs || (other.minTs === tally.minTs && other.key < tally.key))
    );
  const active = (tally: SessionTally) => {
    const activity = A.filter(ranked, (other) => other.parent === tally.parent && other.primary && !other.child);
    return (
      tally.primary &&
      !tally.child &&
      A.some(activity, (other) => other.userTurns >= 1) &&
      A.some(activity, (other) => other.toolEvents >= 1) &&
      !isChild(tally)
    );
  };
  const qualifying = pipe(
    A.filter(
      ranked,
      (tally) =>
        parentRegime(tally) === "in-regime" &&
        !A.some(ranked, (other) => other.parent === tally.parent && other.unknownStart) &&
        active(tally) &&
        !overlapsDisarm(parentSummary(tally))
    ),
    A.map(parentSummary),
    A.sort(byNewestFirst)
  );
  const countFor = (kind: HookPulseAgentKind) =>
    Math.min(window, A.length(A.filter(qualifying, (tally) => tally.agentKind === kind)));
  const counts = {
    "claude-code": countFor("claude-code"),
    "codex-cli": countFor("codex-cli"),
    "cursor-cli": countFor("cursor-cli"),
  };
  const inRegime = A.take(
    A.filter(qualifying, (tally) => tally.agentKind === agentKind),
    window
  );
  const rootsForTouches = shared
    ? A.flatten(
        R.values(
          R.map(counts, (_count, kind) =>
            A.take(
              A.filter(qualifying, (tally) => tally.agentKind === kind),
              window
            )
          )
        )
      )
    : inRegime;
  const selectedRanked = A.filter(ranked, (tally) => tally.agentKind === agentKind);
  const selectedGrouped = A.map(
    A.filter(selectedRanked, (tally) =>
      O.exists(
        A.findFirst(selectedRanked, (other) => other.parent === tally.parent),
        (first) => first.key === tally.key
      )
    ),
    parentSummary
  );
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
    touched: A.reduce(
      A.filter(
        ranked,
        (tally) =>
          (tally.primary || tally.child) &&
          parentRegime(tally) === "in-regime" &&
          !overlapsDisarm(parentSummary(tally)) &&
          A.some(rootsForTouches, (root) => root.parent === tally.parent)
      ),
      HashSet.empty<string>(),
      (acc, tally) => HashSet.union(acc, tally.surfaces)
    ),
    shardsRead: scan.shardsRead,
    undecodableLines: scan.undecodableLines,
  });
};

const readRefusals = Effect.fn("HarnessLedger.readRefusals")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let refusalUndecodableLines = 0;
  let writerRefusalsTotal = 0;
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
          if (isSupportedAgentKind(row.agentKind)) refusalsByAgentKind[row.agentKind] += 1;
        },
      });
    }
  }
  return { refusalUndecodableLines, writerRefusalsTotal, refusalsByAgentKind };
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
  agentKind: HookPulseAgentKind = "claude-code",
  shared = false
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
    Effect.mapError(HarnessLedgerIoError.wrap("Cannot resolve disarm sentinel."))
  );
  const sentinelPresent = yield* fs.exists(sentinel).pipe(Effect.asSome, Effect.orElseSucceed(O.none<boolean>));
  const openDisarm =
    O.getOrElse(sentinelPresent, () => true) ||
    A.some(A.filter(Str.split(windowsText, "\n"), Str.isNonEmpty), (line) =>
      Result.isFailure(HookPulseDisarmWindow.decodeJsonResult(line))
    );
  const { refusalUndecodableLines, writerRefusalsTotal, refusalsByAgentKind } = yield* readRefusals(root);
  const scan: ShardScan = {
    stateDir,
    tallies: MutableHashMap.empty(),
    undecodableLines: refusalUndecodableLines,
    shardsRead: 0,
    disarmWindows: windows,
    openDisarm,
    provenDisarmed: O.getOrElse(sentinelPresent, () => false),
    writerRefusalsTotal,
    refusalsByAgentKind,
  };
  yield* Effect.forEach(names, (name) => readShard(scan, name), { discard: true });
  return windowReport(scan, scan.tallies, window, harnessHash, agentKind, shared);
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

class TranscriptTally extends S.Class<TranscriptTally>("HarnessLedger.TranscriptTally")({
  session: S.OptionFromOptionalKey(S.String),
  calls: S.Natural,
  undecodableLines: S.Natural,
}) {}

class TranscriptFileCounts extends S.Class<TranscriptFileCounts>("HarnessLedger.TranscriptFileCounts")({
  sessionHash: Sha256Hex,
  pathHash: Sha256Hex,
  calls: S.Natural,
  undecodableLines: S.Natural,
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
    onSuccess: (row) =>
      TranscriptTally.make({
        ...tally,
        session: O.orElse(O.fromUndefinedOr(row.sessionId), () =>
          row.type === "session_meta"
            ? O.orElse(O.fromUndefinedOr(row.payload?.id), () => tally.session)
            : tally.session
        ),
        calls: tally.calls + transcriptToolCount(row),
      }),
  });

const foldReconciliationHook = (
  row: HookPulseV1,
  agentKind: HookPulseAgentKind,
  sessionHooks: MutableHashMap.MutableHashMap<string, number>,
  hooks: MutableHashMap.MutableHashMap<string, number>
): void => {
  if (row.instrumentClass !== "production" || row.agentKind !== agentKind || !isTerminalToolEvent(row.hookEvent))
    return;
  MutableHashMap.set(
    sessionHooks,
    row.sessionId,
    O.getOrElse(MutableHashMap.get(sessionHooks, row.sessionId), () => 0) + 1
  );
  O.match(row.transcriptPath, {
    onNone: F.constVoid,
    onSome: (key) => MutableHashMap.set(hooks, key, O.getOrElse(MutableHashMap.get(hooks, key), () => 0) + 1),
  });
};

const readReconciliationHooks = Effect.fn("HarnessLedger.readReconciliationHooks")(function* (
  stateDir: string,
  agentKind: HookPulseAgentKind,
  sessionHooks: MutableHashMap.MutableHashMap<string, number>,
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
        onSuccess: (row) => foldReconciliationHook(row, agentKind, sessionHooks, hooks),
      });
    }
  }
  return undecodableLines;
});

const reconciliationTranscriptFiles = Effect.fn("HarnessLedger.reconciliationTranscriptFiles")(function* (
  dir: string,
  visited = MutableHashSet.empty<string>()
): Effect.fn.Return<ReadonlyArray<string>, HarnessLedgerIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonical = yield* fs
    .realPath(dir)
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot resolve transcript directory.")));
  if (MutableHashSet.has(visited, canonical)) return A.empty<string>();
  MutableHashSet.add(visited, canonical);
  const entries = yield* listDirectorySorted(canonical);
  return A.flatten(
    yield* Effect.forEach(
      entries,
      Effect.fnUntraced(function* (entry) {
        const file = path.join(canonical, entry);
        const info = yield* fs
          .stat(file)
          .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot inspect transcript file.")));
        if (info.type === "Directory") return yield* reconciliationTranscriptFiles(file, visited);
        return Str.endsWith(".jsonl")(entry) ? A.of(file) : A.empty<string>();
      }),
      { concurrency: 1 }
    )
  );
});

const ParentSessionSegment = S.String.check(S.isPattern(/^[0-9a-f-]{36}$/));
const isParentSessionSegment = S.is(ParentSessionSegment);
const readTranscriptCounts = Effect.fn("HarnessLedger.readTranscriptCounts")(function* (
  file: string,
  transcriptDir: string,
  agentKind: HookPulseAgentKind,
  hashSalt: O.Option<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs
    .readFileString(file)
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot read transcript reconciliation file.")));
  const tally = A.reduce(
    A.filter(Str.split(text, "\n"), Str.isNonEmpty),
    TranscriptTally.make({ session: O.none(), calls: 0, undecodableLines: 0 }),
    foldTranscriptLine
  );
  const relative = Str.split(path.relative(transcriptDir, file), path.sep);
  const parent =
    agentKind === "claude-code" && A.length(relative) > 1
      ? A.findFirst(relative, isParentSessionSegment)
      : O.none<string>();
  const session = O.orElse(parent, () => tally.session);
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
    undecodableLines: tally.undecodableLines,
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
  const sessionHooks = MutableHashMap.empty<string, number>();
  let undecodableLines = yield* readReconciliationHooks(stateDir, agentKind, sessionHooks, hooks);
  const fs = yield* FileSystem.FileSystem;
  const canonical = yield* fs
    .realPath(transcriptDir)
    .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot resolve transcript root.")));
  const files = yield* reconciliationTranscriptFiles(canonical);
  const sessions = MutableHashMap.empty<string, number>();
  const transcriptPaths = MutableHashMap.empty<string, number>();
  for (const file of files) {
    const counts = yield* readTranscriptCounts(file, canonical, agentKind, hashSalt);
    undecodableLines += counts.undecodableLines;
    if (counts.calls === 0) continue;
    MutableHashMap.set(
      sessions,
      counts.sessionHash,
      O.getOrElse(MutableHashMap.get(sessions, counts.sessionHash), () => 0) + counts.calls
    );
    MutableHashMap.set(transcriptPaths, counts.pathHash, counts.calls);
  }
  const counts = agentKind === "claude-code" ? sessions : transcriptPaths;
  const matchedHooks = agentKind === "claude-code" ? sessionHooks : hooks;
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
