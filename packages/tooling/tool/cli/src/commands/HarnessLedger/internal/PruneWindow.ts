/**
 * Candidate-surface enumeration and hook-pulse session-window observation for
 * `harness-ledger prune-proposals`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { contextSurfaceId, HookPulseV1 } from "@beep/repo-ai-metrics";
import { A, O, pipe, Str } from "@beep/utils";
import { DateTime, Effect, FileSystem, Order, Path, Result } from "effect";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { HarnessLedgerIoError } from "../HarnessLedger.errors.ts";
import { ObservedSessionWindow, PrunableSurfaceKind, PruneSurfaceCandidate } from "../HarnessLedger.schemas.ts";
import { listDirectorySorted } from "./Fs.ts";

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

const indexShard = (name: string): O.Option<IndexedShard> =>
  pipe(
    O.fromNullishOr(INDEXED_SHARD.exec(name)),
    O.flatMap((match) =>
      pipe(
        O.all([O.fromUndefinedOr(match[1]), O.fromUndefinedOr(match[2])]),
        O.map(([date, session]) => ({ name, date, session }))
      )
    )
  );

const previousDay = (date: string): string =>
  pipe(DateTime.makeUnsafe(`${date}T00:00:00.000Z`), DateTime.subtract({ days: 1 }), DateTime.formatIsoDateUtc);

/**
 * Pick the shards that can hold the last `window` sessions.
 *
 * **Details**
 *
 * Shards named `hook-pulse-<YYYY-MM-DD>-<sessionId>.ndjson` are indexed by
 * session and date without being read. Sessions are ranked by their newest
 * shard date; every shard of every session whose newest date is on or after
 * the day before the `window`-th session's newest date is read, so a one-day
 * gap between shard date and event timestamp cannot drop a session. Shards
 * that do not follow the naming scheme are always read.
 *
 * @param names - Hook-pulse shard file names found in the state directory.
 * @param window - Number of most recent sessions the caller will observe.
 * @returns The shard names to read: every unindexed shard, then the indexed shards of sessions inside the window.
 */
const selectShards = (names: ReadonlyArray<string>, window: number): ReadonlyArray<string> => {
  const indexed = A.getSomes(A.map(names, indexShard));
  const unindexed = A.filter(names, (name) => O.isNone(indexShard(name)));
  const latest = MutableHashMap.empty<string, string>();
  for (const shard of indexed) {
    const current = MutableHashMap.get(latest, shard.session);
    if (O.isNone(current) || current.value < shard.date) {
      MutableHashMap.set(latest, shard.session, shard.date);
    }
  }
  const ranked = pipe(A.fromIterable(MutableHashMap.values(latest)), A.sort(Order.flip(Order.String)));
  const floor = pipe(A.get(ranked, window - 1), O.map(previousDay));
  const keep = (shard: IndexedShard): boolean =>
    O.match(floor, {
      onNone: () => true,
      onSome: (min) =>
        pipe(
          MutableHashMap.get(latest, shard.session),
          O.exists((date) => date >= min)
        ),
    });
  return A.appendAll(
    unindexed,
    A.map(A.filter(indexed, keep), (shard) => shard.name)
  );
};

type SessionTally = {
  readonly maxTs: number;
  readonly surfaces: HashSet.HashSet<string>;
};

/**
 * Read hook-pulse shards under `stateDir` and observe the last `window`
 * sessions.
 *
 * **Details**
 *
 * Lines that do not decode as `HookPulseV1` are counted and skipped. A missing
 * state directory observes zero sessions.
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const observeSessionWindow = Effect.fn("HarnessLedger.observeSessionWindow")(function* (
  stateDir: string,
  window: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = A.filter(yield* listDirectorySorted(stateDir), (name) => ANY_SHARD.test(name));
  const shards = selectShards(names, window);
  const tallies = MutableHashMap.empty<string, SessionTally>();
  let undecodableLines = 0;
  for (const name of shards) {
    const text = yield* fs
      .readFileString(path.join(stateDir, name))
      .pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to read hook-pulse shard ${name}.`)));
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
      MutableHashMap.set(tallies, pulse.sessionId, {
        maxTs: O.match(previous, { onNone: () => ts, onSome: (tally) => Math.max(tally.maxTs, ts) }),
        surfaces: O.match(pulse.surface, {
          onNone: () => surfaces,
          onSome: (surface) => HashSet.add(surfaces, surface),
        }),
      });
    }
  }
  const recent = pipe(
    A.fromIterable(MutableHashMap.values(tallies)),
    A.sort(Order.flip(Order.mapInput(Order.Number, (tally: SessionTally) => tally.maxTs))),
    A.take(window)
  );
  return ObservedSessionWindow.make({
    sessionsObserved: A.length(recent),
    windowEnd: pipe(
      A.head(recent),
      O.map((tally) => DateTime.makeUnsafe(tally.maxTs))
    ),
    touched: A.reduce(recent, HashSet.empty<string>(), (acc, tally) => HashSet.union(acc, tally.surfaces)),
    shardsRead: A.length(shards),
    undecodableLines,
  });
});
