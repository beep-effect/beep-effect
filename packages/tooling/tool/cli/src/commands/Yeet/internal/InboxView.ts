/**
 * The consumer-side view of the checkout failure inbox.
 *
 * **Details**
 *
 * Writers append immutable rows (`appendYeetInboxRow`) and never look
 * back; this module is where every consumer — the `yeet inbox` CLI today, the
 * A2 harness adapters (Claude hook deny/inject, Codex splice, Grok tail) next
 * — turns that append-only evidence into the three joined facts enforcement
 * runs on: what failed (the row), whether it was dealt with (the ack state),
 * and whether it still matters (liveness against the current remediation
 * wave).
 *
 * **Gotchas**
 *
 * The reader is deliberately tolerant. Undecodable lines are counted and
 * skipped, never fatal: the inbox is a shared append-only file and one
 * writer's garbage must not blind consumers to every other writer's rows.
 * Duplicate ids keep the first occurrence — rows are immutable
 * first-observation evidence, so a re-appended id is the same failure
 * re-announced, not new information.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { thunkFalse } from "@beep/utils";
import { Effect, FileSystem, MutableHashSet } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { readYeetAckState, YeetAckState } from "./Ack.ts";
import { YeetInboxRow, YeetInboxRowJson, yeetInboxExpectedRowId, yeetInboxPaths } from "./Inbox.ts";
import { loadYeetRemediationWave } from "./Remediation.ts";
import type { Path } from "effect";
import type { YeetRemediationWave } from "./Remediation.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/InboxView");

/**
 * Schema version stamped on every rendered inbox view.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_INBOX_VIEW_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_INBOX_VIEW_SCHEMA_VERSION) // "yeet-inbox-view/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_INBOX_VIEW_SCHEMA_VERSION = "yeet-inbox-view/v1";

/**
 * Whether an inbox row still gates anything.
 *
 * **Details**
 *
 * `live` means the row's identity matches the current remediation wave —
 * same PR, same head — so its failure is about the code the checkout is
 * standing on. `superseded` means a later push made the row historical, and
 * a superseded row must not gate anything. `unknown` means there is no
 * usable wave record to join against — it is *not* a verdict either way.
 * Only the watch dispatcher maintains the wave record today, so rows from
 * writers that never touch it (SPEC A2's local lane runners and collision
 * detectors, A5's package audits) are expected to be `unknown` rather than
 * dead: liveness rules out stale rows, and the consumer's severity policy
 * decides what an `unknown` row's tier still enforces.
 *
 * **Example** (Check a liveness)
 *
 * ```ts
 * import { YeetInboxLiveness } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetInboxLiveness.is.live("live")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxLiveness = LiteralKit(["live", "superseded", "unknown"]).pipe(
  $I.annoteSchema("YeetInboxLiveness", {
    title: "Yeet Inbox Liveness",
    description: "Whether one inbox row belongs to the current remediation wave, a superseded one, or no known wave.",
  })
);

/**
 * Whether an inbox row still gates anything.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetInboxLiveness = typeof YeetInboxLiveness.Type;

/**
 * Decide one row's liveness against the persisted wave record.
 *
 * **Example** (No wave record means unknown)
 *
 * ```ts
 * import { yeetInboxRowLiveness, YeetCheckFailedRow, YeetFailureCapsule, yeetInboxRowId } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail",
 *   headSha: "abc123",
 *   lane: "Check",
 *   link: null,
 *   observedAt: "2026-08-17T00:00:00Z",
 *   prNumber: 754,
 *   state: "FAILURE",
 *   workflow: null
 * })
 * const row = YeetCheckFailedRow.make({
 *   capsule,
 *   checkout: "/repo",
 *   id: yeetInboxRowId(capsule),
 *   severity: "P0",
 *   ts: "2026-08-17T00:00:00Z"
 * })
 *
 * console.log(yeetInboxRowLiveness(row, O.none())) // "unknown"
 * ```
 *
 * @param row - The inbox row to place.
 * @param wave - The persisted remediation wave, when one exists.
 * @returns The row's liveness tier.
 * @category utilities
 * @since 0.0.0
 */
export const yeetInboxRowLiveness: {
  (wave: O.Option<YeetRemediationWave>): (row: YeetInboxRow) => YeetInboxLiveness;
  (row: YeetInboxRow, wave: O.Option<YeetRemediationWave>): YeetInboxLiveness;
} = dual(2, (row: YeetInboxRow, wave: O.Option<YeetRemediationWave>): YeetInboxLiveness => {
  if (row.kind === "sibling-collision" || row.kind === "local-shard-failed") {
    return "live";
  }
  return O.match(wave, {
    onNone: () => "unknown" as const,
    onSome: (current) =>
      current.headSha === row.capsule.headSha && current.prNumber === row.capsule.prNumber
        ? ("live" as const)
        : ("superseded" as const),
  });
});

/**
 * One inbox row joined with everything a consumer decides on.
 *
 * **Example** (Build an entry)
 *
 * ```ts
 * import {
 *   YeetAckState,
 *   YeetCheckFailedRow,
 *   YeetFailureCapsule,
 *   YeetInboxEntry,
 *   yeetInboxRowId
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail",
 *   headSha: "abc123",
 *   lane: "Check",
 *   link: null,
 *   observedAt: "2026-08-17T00:00:00Z",
 *   prNumber: 754,
 *   state: "FAILURE",
 *   workflow: null
 * })
 * const entry = YeetInboxEntry.make({
 *   ack: YeetAckState.make({ acked: false, receipt: null }),
 *   liveness: "live",
 *   row: YeetCheckFailedRow.make({
 *     capsule,
 *     checkout: "/repo",
 *     id: yeetInboxRowId(capsule),
 *     severity: "P0",
 *     ts: "2026-08-17T00:00:00Z"
 *   })
 * })
 *
 * console.log(entry.ack.acked) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetInboxEntry extends S.Class<YeetInboxEntry>($I`YeetInboxEntry`)(
  {
    row: YeetInboxRow,
    ack: YeetAckState,
    liveness: YeetInboxLiveness,
  },
  $I.annote("YeetInboxEntry", {
    description: "One inbox row joined with its ack state and its liveness against the current wave.",
  })
) {}

/**
 * The joined inbox: every deduplicated row plus the reader's accounting.
 *
 * **Details**
 *
 * `unreadable` distinguishes "the failures file does not exist" (a genuinely
 * empty inbox) from "the file exists but could not be read" (permissions, a
 * directory squatting on the path, IO failure). An enforcement consumer must
 * not treat the second case as an empty backlog — the inbox state is unknown,
 * not clear.
 *
 * **Example** (Build an empty view)
 *
 * ```ts
 * import { YeetInboxView } from "@beep/repo-cli/test/Yeet"
 *
 * const view = YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: false })
 * console.log(view.schemaVersion) // "yeet-inbox-view/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetInboxView extends S.Class<YeetInboxView>($I`YeetInboxView`)(
  {
    schemaVersion: S.Literal(YEET_INBOX_VIEW_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_VIEW_SCHEMA_VERSION))
    ),
    entries: S.Array(YeetInboxEntry),
    skippedLines: S.Finite,
    unreadable: S.Boolean,
  },
  $I.annote("YeetInboxView", {
    description:
      "Every deduplicated inbox entry, the count of skipped lines, and whether the failures file was unreadable.",
  })
) {}

/**
 * JSON string codec for one rendered inbox view.
 *
 * **Example** (Reject garbage)
 *
 * ```ts
 * import { YeetInboxViewJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(YeetInboxViewJson.decodeOption("not json"))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const YeetInboxViewJson = JsonStringCodec(YeetInboxView);

const dedupeRowsById = (rows: ReadonlyArray<YeetInboxRow>): ReadonlyArray<YeetInboxRow> => {
  const seen = MutableHashSet.empty<string>();
  return A.filter(rows, (row) => {
    if (MutableHashSet.has(seen, row.id)) {
      return false;
    }
    MutableHashSet.add(seen, row.id);
    return true;
  });
};

// Appends write one whole `line\n` per call, so an unterminated tail is an
// in-flight append the next read will see whole — provisional, not garbage.
// Only newline-terminated content is complete evidence.
const terminatedPortion = (text: string): string =>
  Str.endsWith("\n")(text)
    ? text
    : O.match(Str.lastIndexOf("\n")(text), {
        onNone: () => "",
        onSome: (index) => Str.slice(0, index + 1)(text),
      });

/**
 * Load the joined inbox view for one checkout.
 *
 * **Details**
 *
 * Reads the failures file tolerantly: a missing file is an empty inbox, an
 * existing-but-unreadable file is flagged `unreadable` instead of decaying to
 * empty, an unterminated final line is treated as an in-flight append and
 * ignored without counting, and terminated lines that fail to decode — or
 * whose id breaks the deterministic {@link yeetInboxRowId} contract the
 * append path enforces — are counted in `skippedLines`. Surviving rows are
 * deduplicated by id keeping the first observation, then joined with their
 * ack state and their liveness against the persisted wave record. This is the
 * one read every consumer shares, so the CLI and the hook adapters provably
 * see the same inbox.
 *
 * **Example** (Build the load effect)
 *
 * ```ts
 * import { loadYeetInboxView } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(loadYeetInboxView("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox is read.
 * @returns The joined view; never an error — failure modes fold into the view's accounting.
 * @category services
 * @since 0.0.0
 */
export const loadYeetInboxView = Effect.fn("Yeet.loadYeetInboxView")(function* (
  repoRoot: string
): Effect.fn.Return<YeetInboxView, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(repoRoot);
  const exists = yield* fs.exists(paths.failuresPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: false });
  }
  const text = yield* Effect.option(fs.readFileString(paths.failuresPath));
  if (O.isNone(text)) {
    return YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: true });
  }
  const lines = A.filter(Str.split(terminatedPortion(text.value), "\n"), Str.isNonEmpty);
  const rows = A.getSomes(A.map(lines, YeetInboxRowJson.decodeOption));
  const wellFormed = A.filter(rows, (row) => row.id === yeetInboxExpectedRowId(row));
  const deduped = dedupeRowsById(wellFormed);
  const wave = yield* loadYeetRemediationWave(repoRoot);
  const entries = yield* Effect.forEach(deduped, (row) =>
    readYeetAckState(repoRoot, row.id).pipe(
      Effect.map((ack) => YeetInboxEntry.make({ ack, liveness: yeetInboxRowLiveness(row, wave), row }))
    )
  );
  return YeetInboxView.make({
    entries,
    skippedLines: A.length(lines) - A.length(wellFormed),
    unreadable: false,
  });
});
