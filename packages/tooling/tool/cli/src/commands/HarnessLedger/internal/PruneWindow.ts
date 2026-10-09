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
  HookPulseDisarmWindow,
  HookPulseV1,
  hashPrivateIdentifier,
  hookPulseHashSalt,
} from "@beep/repo-ai-metrics";
import { LiteralKit } from "@beep/schema";
import { A, O, pipe, Str } from "@beep/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
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
import type { HarnessHash, HookPulseAgentKind } from "@beep/repo-ai-metrics";

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

const isInRegime =
  (harnessHash: HarnessHash) =>
  (tally: SessionTally): boolean =>
    SessionRegime.is["in-regime"](regimeOf(tally, harnessHash));

// The mutable state one observation threads through its shard reads: the
// per-session tallies and the two counters the report carries.
type ShardScan = {
  readonly stateDir: string;
  readonly tallies: MutableHashMap.MutableHashMap<string, SessionTally>;
  undecodableLines: number;
  shardsRead: number;
  readonly disarmWindows: ReadonlyArray<HookPulseDisarmWindow>;
  readonly openDisarm: boolean;
};

// Split shard names into those indexed by session and date and those read
// eagerly because their name does not follow the naming scheme.
const foldPulse = (tallies: ShardScan["tallies"], pulse: HookPulseV1): void => {
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
    surfaces: HashSet.empty<string>(),
    stamps: HashSet.empty<string>(),
  }));
  MutableHashMap.set(tallies, key, {
    ...tally,
    minTs: Math.min(tally.minTs, ts),
    userTurns: tally.userTurns + (pulse.hookEvent === "UserPromptSubmit" ? 1 : 0),
    toolEvents:
      tally.toolEvents +
      (pulse.hookEvent === "PreToolUse" || pulse.hookEvent === "PostToolUse" || pulse.hookEvent === "PostToolUseFailure"
        ? 1
        : 0),
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
    scan.openDisarm ||
    A.some(
      scan.disarmWindows,
      (gap) =>
        O.isNone(gap.disarmedAt) ||
        (tally.maxTs >= DateTime.toEpochMillis(DateTime.makeUnsafe(gap.disarmedAt.value)) &&
          tally.minTs <= DateTime.toEpochMillis(DateTime.makeUnsafe(gap.rearmedAt)))
    );
  // A parent's first transcript is the root; nested transcripts contribute
  // touches to that root but never create extra qualifying sessions.
  const isChild = (tally: SessionTally) =>
    A.some(
      ranked,
      (other) =>
        other.parent === tally.parent &&
        (other.minTs < tally.minTs || (other.minTs === tally.minTs && other.key < tally.key))
    );
  const active = (tally: SessionTally) => tally.userTurns >= 1 && tally.toolEvents >= 1 && !isChild(tally);
  const qualifying = A.filter(
    ranked,
    (tally) => isInRegime(harnessHash)(tally) && active(tally) && !overlapsDisarm(tally)
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
  const selectedRanked = A.filter(ranked, (tally) => tally.agentKind === agentKind);
  const oldest = A.length(inRegime) < window ? O.none<SessionTally>() : A.last(inRegime);
  return ObservedSessionWindow.make({
    harnessHash,
    sessionsObserved: A.length(inRegime),
    sessionsByAgentKind: counts,
    sessionsSkippedDisarmed: A.length(A.filter(selectedRanked, overlapsDisarm)),
    sessionsBelowActivityFloor: A.length(A.filter(selectedRanked, (tally) => !active(tally))),
    sessionsSkippedOutOfRegime: countSkipped(selectedRanked, oldest, harnessHash, SessionRegime.Enum["out-of-regime"]),
    sessionsSkippedUnstamped: countSkipped(selectedRanked, oldest, harnessHash, SessionRegime.Enum.unstamped),
    windowEnd: pipe(
      A.head(inRegime),
      O.map((tally) => DateTime.makeUnsafe(tally.maxTs))
    ),
    touched: A.reduce(
      A.filter(ranked, (tally) => A.some(inRegime, (root) => root.parent === tally.parent)),
      HashSet.empty<string>(),
      (acc, tally) => HashSet.union(acc, tally.surfaces)
    ),
    shardsRead: scan.shardsRead,
    undecodableLines: scan.undecodableLines,
  });
};

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
  const windowsText = yield* fs
    .readFileString(path.join(root, "hook-pulse-disarm-windows.ndjson"))
    .pipe(Effect.orElseSucceed(() => ""));
  const windows = A.filterMap(Str.split(windowsText, "\n"), (line) => HookPulseDisarmWindow.decodeJsonResult(line));
  const openDisarm = yield* fs.exists(path.join(root, "hook-pulse.disarmed")).pipe(Effect.orElseSucceed(() => true));
  const scan: ShardScan = {
    stateDir,
    tallies: MutableHashMap.empty(),
    undecodableLines: 0,
    shardsRead: 0,
    disarmWindows: windows,
    openDisarm,
  };
  yield* Effect.forEach(names, (name) => readShard(scan, name), { discard: true });
  return windowReport(scan, scan.tallies, window, harnessHash, agentKind);
});

// Only structural metadata is decoded. Content strings never leave this reader.
const TranscriptTool = S.Struct({ type: S.optionalKey(S.String), id: S.optionalKey(S.String) });
const TranscriptRow = S.fromJsonString(
  S.Struct({
    type: S.optionalKey(S.String),
    sessionId: S.optionalKey(S.String),
    message: S.optionalKey(S.Struct({ content: S.optionalKey(S.Union([S.String, S.Array(S.Unknown)])) })),
    payload: S.optionalKey(S.Struct({ id: S.optionalKey(S.String), type: S.optionalKey(S.String) })),
  })
);
const decodeTranscript = S.decodeUnknownResult(TranscriptRow);
const decodeTool = S.decodeUnknownOption(TranscriptTool);

/**
 * Reconcile every transcript file beneath a caller-selected root, including
 * nested Workflow and subagent files, against complete hook shards.
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
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const hashSalt = yield* hookPulseHashSalt.pipe(
    Effect.mapError(HarnessLedgerIoError.wrap("Cannot resolve reconciliation hash namespace."))
  );
  const hooks = MutableHashMap.empty<string, number>();
  const sessionHooks = MutableHashMap.empty<string, number>();
  let undecodableLines = 0;
  for (const shard of A.filter(yield* listDirectorySorted(stateDir), (name) => ANY_SHARD.test(name))) {
    const text = yield* fs
      .readFileString(path.join(stateDir, shard))
      .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot read reconciliation shard.")));
    for (const line of A.filter(Str.split(text, "\n"), Str.isNonEmpty)) {
      const decoded = HookPulseV1.decodeJsonResult(line);
      if (Result.isFailure(decoded)) {
        undecodableLines += 1;
        continue;
      }
      const row = decoded.success;
      if (row.agentKind !== agentKind || (row.hookEvent !== "PostToolUse" && row.hookEvent !== "PostToolUseFailure"))
        continue;
      MutableHashMap.set(
        sessionHooks,
        row.sessionId,
        O.getOrElse(MutableHashMap.get(sessionHooks, row.sessionId), () => 0) + 1
      );
      if (O.isSome(row.transcriptPath))
        MutableHashMap.set(
          hooks,
          row.transcriptPath.value,
          O.getOrElse(MutableHashMap.get(hooks, row.transcriptPath.value), () => 0) + 1
        );
    }
  }
  const walk = Effect.fnUntraced(function* (
    dir: string
  ): Effect.fn.Return<ReadonlyArray<string>, HarnessLedgerIoError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* listDirectorySorted(dir);
    return A.flatten(
      yield* Effect.forEach(
        entries,
        Effect.fnUntraced(function* (entry) {
          const file = path.join(dir, entry);
          const info = yield* fs
            .stat(file)
            .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot inspect transcript file.")));
          if (info.type === "Directory") return yield* walk(file);
          return Str.endsWith(".jsonl")(entry) ? A.of(file) : A.empty<string>();
        }),
        { concurrency: 1 }
      )
    );
  });
  const files = yield* walk(transcriptDir);
  const sessions = MutableHashMap.empty<string, number>();
  const transcriptPaths = MutableHashMap.empty<string, number>();
  for (const file of files) {
    const text = yield* fs
      .readFileString(file)
      .pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot read transcript reconciliation file.")));
    const relative = Str.split(path.relative(transcriptDir, file), path.sep);
    // Claude's nested paths are <session>/subagents or <session>/workflow.
    let session = O.none<string>();
    let calls = 0;
    for (const line of A.filter(Str.split(text, "\n"), Str.isNonEmpty)) {
      const decoded = decodeTranscript(line);
      if (Result.isFailure(decoded)) {
        undecodableLines += 1;
        continue;
      }
      const row = decoded.success;
      if (row.type === "session_meta") session = O.fromUndefinedOr(row.payload?.id);
      if (row.sessionId !== undefined) session = O.some(row.sessionId);
      const content = row.message?.content;
      if (S.is(S.Array(S.Unknown))(content)) {
        calls += A.length(
          A.filter(content, (block) => O.exists(decodeTool(block), (tool) => tool.type === "tool_use"))
        );
      }
      if (
        row.type === "response_item" &&
        (row.payload?.type === "function_call" || row.payload?.type === "custom_tool_call")
      )
        calls += 1;
    }
    if (calls === 0) continue;
    if (agentKind === "claude-code" && A.length(relative) > 1) {
      const parent = A.findFirst(relative, (part) => /^[0-9a-f-]{36}$/.test(part));
      session = O.orElse(parent, () => session);
    }
    const identity = yield* hashPrivateIdentifier(
      O.getOrElse(session, () => file),
      hashSalt
    ).pipe(Effect.mapError(HarnessLedgerIoError.wrap("Cannot hash transcript identity.")));
    MutableHashMap.set(sessions, identity, O.getOrElse(MutableHashMap.get(sessions, identity), () => 0) + calls);
    const pathHash = yield* hashPrivateIdentifier(file, hashSalt).pipe(
      Effect.mapError(HarnessLedgerIoError.wrap("Cannot hash transcript path."))
    );
    MutableHashMap.set(transcriptPaths, pathHash, calls);
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
  const ratio = transcriptToolEvents > 0 ? O.some(hookedToolEvents / transcriptToolEvents) : O.none<number>();
  return HarnessTelemetryReconciliation.make({
    agentKind,
    transcriptFiles: A.length(files),
    transcriptToolEvents,
    hookedToolEvents,
    sessionsWithoutHooks,
    undecodableLines,
    ratio,
    qualifiedForNonUse:
      agentKind === "claude-code" &&
      undecodableLines === 0 &&
      sessionsWithoutHooks === 0 &&
      O.exists(ratio, (value) => value >= 0.98 && value <= 1.02),
    basis:
      agentKind === "codex-cli"
        ? "failed-or-interrupted: exec wrappers are not one-to-one with inner hook calls; non-use unqualified"
        : agentKind === "cursor-cli"
          ? "unsupported transcript format; non-use unqualified"
          : "main plus all nested child transcripts; current-window qualification is also required",
  });
});
