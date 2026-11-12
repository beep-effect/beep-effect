import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { decodeReport } from "@/Lanes";
import type { LanesSnapshot } from "@/Lanes";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

/** The clock every frame test draws at. */
export const NOW = DateTime.makeUnsafe("2026-11-10T12:00:00.000Z");

const minutesAgo = (minutes: number): string => DateTime.formatIso(DateTime.subtract(NOW, { minutes }));

const row = (fields: {
  readonly lane: string;
  readonly state: "open" | "blocked";
  readonly minutes: number;
  readonly next: string;
  readonly pr?: number;
  readonly summary?: string;
}) => ({
  schemaVersion: "session-ledger/v1",
  repository: { host: "github.com", owner: "beep-effect", name: "beep-effect" },
  clone: "/work/beep-effect",
  checkout: `/work/beep-effect-worktrees/${fields.lane}`,
  lane: fields.lane,
  branch: `feat/${fields.lane}`,
  state: fields.state,
  next: fields.next,
  summary: fields.summary ?? null,
  pr: fields.pr ?? null,
  harness: "claude-code",
  sessionId: null,
  recordedAt: minutesAgo(fields.minutes),
});

/** Five lanes in ledger order (newest first), two of them blocked. */
export const ROWS = [
  row({ lane: "async-merge", state: "open", minutes: 12, next: "finish slice A package proof" }),
  row({
    lane: "residue-closeout",
    state: "open",
    minutes: 16,
    next: "ready; monitor holds the review window",
    pr: 3073,
    summary: "re-final after the hand merge",
  }),
  row({ lane: "budget-ledger", state: "open", minutes: 30, next: "final-check running", pr: 3068 }),
  row({ lane: "stood-down", state: "blocked", minutes: 480, next: "stood down by the orchestrator" }),
  row({ lane: "reboot-successor", state: "blocked", minutes: 1_440, next: "successor runs the hand-off" }),
];

/** A `session open --json` document over the given rows. */
export const report = (rows: ReadonlyArray<unknown>): Effect.Effect<string> =>
  encodeJson({
    schemaVersion: "session-open/v1",
    repository: { host: "github.com", owner: "beep-effect", name: "beep-effect" },
    rows,
    goalCloseouts: [],
  }).pipe(Effect.orDie);

/** The snapshot a source would yield for the given rows, read at {@link NOW}. */
export const snapshotOf = (rows: ReadonlyArray<unknown>): Effect.Effect<LanesSnapshot> =>
  Effect.map(report(rows), decodeReport(NOW));
