/**
 * Candidate-surface enumeration and hook-pulse session-window observation for
 * `harness-ledger prune-proposals`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { contextSurfaceId, HookPulseV1 } from "@beep/repo-ai-metrics";
import { LiteralKit } from "@beep/schema";
import { A, O, pipe, Str } from "@beep/utils";
import { DateTime, Effect, FileSystem, Order, Path, Result } from "effect";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { HarnessLedgerIoError } from "../HarnessLedger.errors.ts";
import { ObservedSessionWindow, PrunableSurfaceKind, PruneSurfaceCandidate } from "../HarnessLedger.schemas.ts";
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

const INDEXED_SHARD = /^hook-pulse-(\d{4}-\d{2}-\d{2})-([0-9a-f]{64})\.ndjson$/;
const ANY_SHARD = /^hook-pulse-.*\.ndjson$/;

type IndexedShard = {
  readonly name: string;
  readonly date: string;
  readonly session: string;
};

// A calendar day the name spells exactly: `2026-99-99` does not parse and
// `2026-02-30` would roll over to another day, so both are refused.
const calendarDay = (date: string): O.Option<string> =>
  pipe(
    DateTime.make(`${date}T00:00:00.000Z`),
    O.map(DateTime.formatIsoDateUtc),
    O.filter((day) => day === date)
  );

// A name whose date is not a real calendar day is not indexed; the shard is
// then read like any other shard outside the naming scheme.
const indexShard = (name: string): O.Option<IndexedShard> =>
  pipe(
    O.fromNullishOr(INDEXED_SHARD.exec(name)),
    O.flatMap((match) =>
      pipe(
        O.all([O.flatMap(O.fromUndefinedOr(match[1]), calendarDay), O.fromUndefinedOr(match[2])]),
        O.map(([date, session]) => ({ name, date, session }))
      )
    )
  );

const previousDay = (date: string): string =>
  pipe(DateTime.makeUnsafe(`${date}T00:00:00.000Z`), DateTime.subtract({ days: 1 }), DateTime.formatIsoDateUtc);

const latestDate = (current: O.Option<string>, date: string): string =>
  O.match(current, { onNone: () => date, onSome: (previous) => (previous < date ? date : previous) });

// Which side of the current harness a session falls on. `in-regime`: at least
// one SessionStart stamp, every stamp equal to the current harness hash.
// `out-of-regime`: stamped, but some stamp names another harness (a session
// restarted across a harness edit is mixed and lands here). `unstamped`: no
// stamp at all.
const SessionRegime = LiteralKit(["in-regime", "out-of-regime", "unstamped"]);
type SessionRegime = typeof SessionRegime.Type;

type SessionTally = {
  readonly maxTs: number;
  readonly surfaces: HashSet.HashSet<string>;
  readonly stamps: HashSet.HashSet<string>;
};

const regimeOf = (tally: SessionTally, harnessHash: HarnessHash): SessionRegime =>
  pipe(
    O.liftPredicate(tally.stamps, (stamps) => !HashSet.isEmpty(stamps)),
    O.match({
      onNone: SessionRegime.thunk.unstamped,
      onSome: (stamps) =>
        HashSet.every(stamps, (stamp) => stamp === harnessHash)
          ? SessionRegime.Enum["in-regime"]
          : SessionRegime.Enum["out-of-regime"],
    })
  );

const byNewestFirst = Order.flip(Order.mapInput(Order.Number, (tally: SessionTally) => tally.maxTs));

/**
 * Read hook-pulse shards under `stateDir` and observe the last `window`
 * sessions that ran under `harnessHash`.
 *
 * **Details**
 *
 * Shards named `hook-pulse-<YYYY-MM-DD>-<sessionId>.ndjson`, whose date is a
 * real calendar day, are indexed by session and date without being read. Sessions are visited newest day first
 * (by their newest shard date, or by the newest row date for rows found in
 * shards that do not follow the naming scheme, which are always read), and
 * every shard of a visited session is read, so its regime is decided from all
 * of its rows. Visiting stops once `window` in-regime sessions are known and
 * the day before that point has also been read, so a one-day gap between a
 * shard's name and its rows cannot drop a session; older sessions are never
 * read. The newest `window` in-regime sessions by newest event form the
 * window. Lines that do not decode as `HookPulseV1` are counted and skipped.
 * A missing state directory observes zero sessions.
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const observeSessionWindow = Effect.fn("HarnessLedger.observeSessionWindow")(function* (
  stateDir: string,
  window: number,
  harnessHash: HarnessHash
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = A.filter(yield* listDirectorySorted(stateDir), (name) => ANY_SHARD.test(name));
  const indexed = A.getSomes(A.map(names, indexShard));
  const unindexed = A.filter(names, (name) => O.isNone(indexShard(name)));
  const tallies = MutableHashMap.empty<string, SessionTally>();
  let undecodableLines = 0;
  let shardsRead = 0;

  const readShard = Effect.fnUntraced(function* (name: string) {
    const text = yield* fs
      .readFileString(path.join(stateDir, name))
      .pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to read hook-pulse shard ${name}.`)));
    shardsRead += 1;
    const lines = pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty));
    for (const line of lines) {
      const decoded = HookPulseV1.decodeJsonResult(line);
      if (Result.isFailure(decoded)) {
        undecodableLines += 1;
        continue;
      }
      const pulse = decoded.success;
      const ts = DateTime.toEpochMillis(pulse.ts);
      const previous = MutableHashMap.get(tallies, pulse.sessionId);
      const surfaces = O.getOrElse(
        O.map(previous, (tally) => tally.surfaces),
        HashSet.empty<string>
      );
      const stamps = O.getOrElse(
        O.map(previous, (tally) => tally.stamps),
        HashSet.empty<string>
      );
      MutableHashMap.set(tallies, pulse.sessionId, {
        maxTs: O.match(previous, { onNone: () => ts, onSome: (tally) => Math.max(tally.maxTs, ts) }),
        surfaces: O.match(pulse.surface, {
          onNone: () => surfaces,
          onSome: (surface) => HashSet.add(surfaces, surface),
        }),
        stamps: O.match(pulse.harnessHash, {
          onNone: () => stamps,
          onSome: (stamp) => HashSet.add(stamps, stamp),
        }),
      });
    }
  });

  // Unindexed shards can hold rows of any session, so they are read first and
  // their rows' dates join the session's visiting key.
  yield* Effect.forEach(unindexed, readShard, { discard: true });
  const visitDate = MutableHashMap.empty<string, string>();
  for (const [session, tally] of tallies) {
    MutableHashMap.set(visitDate, session, DateTime.formatIsoDateUtc(DateTime.makeUnsafe(tally.maxTs)));
  }
  for (const shard of indexed) {
    MutableHashMap.set(visitDate, shard.session, latestDate(MutableHashMap.get(visitDate, shard.session), shard.date));
  }
  const days = pipe(A.fromIterable(MutableHashMap.values(visitDate)), A.dedupe, A.sort(Order.flip(Order.String)));
  const visited = MutableHashMap.empty<string, SessionTally>();
  const inRegimeCount = (): number =>
    A.length(
      A.filter(A.fromIterable(MutableHashMap.values(visited)), (tally) =>
        SessionRegime.is["in-regime"](regimeOf(tally, harnessHash))
      )
    );
  let floor = O.none<string>();
  for (const day of days) {
    if (O.exists(floor, (min) => day < min)) {
      break;
    }
    const sessions = A.filterMap(A.fromIterable(visitDate), ([session, date]) =>
      date === day ? Result.succeed(session) : Result.failVoid
    );
    yield* Effect.forEach(
      A.filter(indexed, (shard) => A.contains(sessions, shard.session)),
      (shard) => readShard(shard.name),
      { discard: true }
    );
    for (const session of sessions) {
      const tally = MutableHashMap.get(tallies, session);
      if (O.isSome(tally)) {
        MutableHashMap.set(visited, session, tally.value);
      }
    }
    if (O.isNone(floor) && inRegimeCount() >= window) {
      floor = O.some(previousDay(day));
    }
  }

  const ranked = pipe(A.fromIterable(MutableHashMap.values(visited)), A.sort(byNewestFirst));
  const inRegime = A.take(
    A.filter(ranked, (tally) => SessionRegime.is["in-regime"](regimeOf(tally, harnessHash))),
    window
  );
  // Skipped sessions newer than the window's oldest session; every visited
  // skipped session when the window is not full (then every session was read).
  const oldest = A.length(inRegime) < window ? O.none<SessionTally>() : A.last(inRegime);
  const skipped = (regime: SessionRegime): number =>
    A.length(
      A.filter(
        ranked,
        (tally) => regimeOf(tally, harnessHash) === regime && !O.exists(oldest, (last) => tally.maxTs < last.maxTs)
      )
    );
  return ObservedSessionWindow.make({
    harnessHash,
    sessionsObserved: A.length(inRegime),
    sessionsSkippedOutOfRegime: skipped(SessionRegime.Enum["out-of-regime"]),
    sessionsSkippedUnstamped: skipped(SessionRegime.Enum.unstamped),
    windowEnd: pipe(
      A.head(inRegime),
      O.map((tally) => DateTime.makeUnsafe(tally.maxTs))
    ),
    touched: A.reduce(inRegime, HashSet.empty<string>(), (acc, tally) => HashSet.union(acc, tally.surfaces)),
    shardsRead,
    undecodableLines,
  });
});
