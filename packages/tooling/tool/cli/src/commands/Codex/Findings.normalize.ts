/**
 * Deterministic normalization of a capture payload into an ordered packet plan.
 *
 * Ordering is total and derived only from payload content, never from the
 * dashboard's row order or the wall clock, so ingesting the same payload twice
 * produces byte-identical packet documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import { Effect, HashMap, Order } from "effect";
import { CodexFindingSeverity as Severity } from "./Findings.capture.schemas.ts";
import { CodexFindingsIngestError } from "./Findings.errors.ts";
import { CodexFindingRecord, CodexPacketPlan, CodexSeverityCounts } from "./Findings.schemas.ts";
import type { CodexFindingSeverity, CodexFindingsCapturePayload } from "./Findings.capture.schemas.ts";

/**
 * Rank of a severity within the packet ordering, most severe first.
 *
 * **Details**
 *
 * The rank is read from the literal domain's declaration order rather than a
 * separate table, so adding a severity to {@link CodexFindingSeverity} cannot
 * leave the ordering silently stale.
 *
 * **Example** (Ranking severities)
 *
 * ```ts
 * import { severityRank } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 *
 * console.log(severityRank("High") < severityRank("Low")) // true
 * ```
 *
 * @param severity - Severity reported for a captured finding.
 * @returns Zero-based rank, lower being more severe.
 * @category utilities
 * @since 0.0.0
 */
export const severityRank = (severity: CodexFindingSeverity): number => Severity.Options.indexOf(severity);

/** Minimal shape {@link captureOrder} needs to place a finding. */
type OrderableFinding = {
  readonly severity: CodexFindingSeverity;
  readonly codexId: string;
};

/**
 * Total order over captured findings: most severe first, then by Codex identity.
 *
 * **Details**
 *
 * The identity tiebreak is what makes the order total. Two findings can share a
 * severity, but the capture schema rejects duplicate identities, so no two rows
 * can ever compare equal.
 *
 * **Example** (Sorting two captured rows)
 *
 * ```ts
 * import { captureOrder } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 *
 * console.log(typeof captureOrder) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const captureOrder: Order.Order<OrderableFinding> = Order.combine(
  Order.mapInput(Order.Number, (finding: OrderableFinding) => severityRank(finding.severity)),
  Order.mapInput(Order.String, (finding: OrderableFinding) => finding.codexId)
);

/**
 * Render a one-based ordinal as a zero-padded `CSF-NNN` identity.
 *
 * **Example** (Assigning the first identity)
 *
 * ```ts
 * import { recordIdForOrdinal } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 *
 * console.log(recordIdForOrdinal(1)) // "CSF-001"
 * console.log(recordIdForOrdinal(1234)) // "CSF-1234"
 * ```
 *
 * @param ordinal - One-based position of the finding in assignment order.
 * @returns The zero-padded `CSF-NNN` identity.
 * @category utilities
 * @since 0.0.0
 */
export const recordIdForOrdinal = (ordinal: number): string => `CSF-${Str.padStart(3, "0")(`${ordinal}`)}`;

/**
 * Tally findings per severity, in severity-domain order, omitting zero counts.
 *
 * **Gotchas**
 *
 * Severities with no findings are absent rather than present with a `0`, which
 * matches the `catalog.severityCounts` block every hand-written Codex packet
 * already ships.
 *
 * **Example** (Counting a mixed batch)
 *
 * ```ts
 * import { severityCountsOf } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 *
 * const counts = severityCountsOf([{ severity: "Low" }, { severity: "Low" }])
 *
 * console.log(counts.Low) // 2
 * console.log("High" in counts) // false
 * ```
 *
 * @param findings - Findings to tally, in any order.
 * @returns Per-severity totals with zero-count severities omitted.
 * @category utilities
 * @since 0.0.0
 */
export const severityCountsOf = (
  findings: ReadonlyArray<{ readonly severity: CodexFindingSeverity }>
): CodexSeverityCounts =>
  CodexSeverityCounts.make(
    A.reduce(Severity.Options, {} as Record<string, number>, (counts, severity) => {
      const total = A.length(A.filter(findings, (finding) => finding.severity === severity));
      return total === 0 ? counts : { ...counts, [severity]: total };
    })
  );

/**
 * Slug a capture date resolves to when no override is supplied.
 *
 * **Example** (Deriving the default slug)
 *
 * ```ts
 * import { defaultPacketSlug } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 *
 * console.log(defaultPacketSlug("2026-08-04")) // "codex-security-findings-2026-08-04"
 * ```
 *
 * @param capturedAt - Calendar date of the capture, as `YYYY-MM-DD`.
 * @returns The packet directory name under `goals/`.
 * @category utilities
 * @since 0.0.0
 */
export const defaultPacketSlug = (capturedAt: string): string => `codex-security-findings-${capturedAt}`;

/**
 * Branch a capture date resolves to when no override is supplied.
 *
 * **Example** (Deriving the default branch)
 *
 * ```ts
 * import { defaultPacketBranch } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 *
 * console.log(defaultPacketBranch("2026-08-04")) // "security/codex-findings-2026-08-04"
 * ```
 *
 * @param capturedAt - Calendar date of the capture, as `YYYY-MM-DD`.
 * @returns The remediation branch name the packet declares.
 * @category utilities
 * @since 0.0.0
 */
export const defaultPacketBranch = (capturedAt: string): string => `security/codex-findings-${capturedAt}`;

/**
 * Read the ordinal back out of an assigned record identifier.
 *
 * **Example** (Reading an ordinal)
 *
 * ```ts
 * import { ordinalOfRecordId } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrElse(ordinalOfRecordId("CSF-007"), () => 0)) // 7
 * ```
 *
 * @param recordId - A `CSF-NNN` identity.
 * @returns The ordinal, or `None` when the identity is not well formed.
 * @category utilities
 * @since 0.0.0
 */
export const ordinalOfRecordId = (recordId: string): O.Option<number> => {
  const match = /^CSF-(\d{3,})$/.exec(recordId);
  return match === null ? O.none() : O.some(Number.parseInt(match[1] ?? "", 10));
};

/**
 * Highest ordinal any prior binding has already consumed.
 *
 * **Details**
 *
 * Retired findings keep their reservation. A number that once addressed a
 * finding is never handed to a different one, so a Codex identifier quoted in a
 * merged PR or a closeout allowlist keeps meaning what it meant.
 *
 * @param priorIds - Existing `codexId -> CSF-NNN` bindings.
 * @returns The highest ordinal already consumed, or zero when there are none.
 * @category utilities
 * @since 0.0.0
 */
const highestReservedOrdinal = (priorIds: HashMap.HashMap<string, string>): number =>
  A.reduce(A.fromIterable(HashMap.values(priorIds)), 0, (highest, recordId) =>
    Math.max(
      highest,
      O.getOrElse(ordinalOfRecordId(recordId), () => 0)
    )
  );

/**
 * Recover `codexId -> CSF-NNN` bindings from an existing packet's ledger.
 *
 * **When to use**
 *
 * Use when re-ingesting a capture into a packet that already exists, so
 * {@link planPacket} preserves the identifiers that packet already published.
 *
 * **Example** (Recovering bindings)
 *
 * ```ts
 * import { priorIdsOfEntries } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 * import { HashMap } from "effect"
 *
 * const priorIds = priorIdsOfEntries([{ id: "CSF-004", codexId: "abc" }])
 *
 * console.log(HashMap.size(priorIds)) // 1
 * ```
 *
 * @param entries - Identity pairs read from an existing triage ledger.
 * @returns A `codexId -> CSF-NNN` binding map.
 * @category utilities
 * @since 0.0.0
 */
export const priorIdsOfEntries = (
  entries: ReadonlyArray<{ readonly id: string; readonly codexId: string }>
): HashMap.HashMap<string, string> =>
  A.reduce(entries, HashMap.empty<string, string>(), (bindings, entry) =>
    HashMap.set(bindings, entry.codexId, entry.id)
  );

/**
 * Turn a decoded capture payload into an ordered, reconciled packet plan.
 *
 * **When to use**
 *
 * Use to turn a decoded, scanned payload into the plan every renderer consumes.
 * This is the last stage that can fail on payload content; rendering from the
 * resulting plan is total.
 *
 * **Gotchas**
 *
 * A payload whose session had expired, or whose captured rows fall short of the
 * dashboard's own reported total, is rejected rather than bootstrapped. Both
 * cases would otherwise produce a packet that reads like a clean scan.
 *
 * Pass `priorIds` whenever a packet for this capture already exists. Without it
 * every identifier is reassigned from capture order, so one new high-severity
 * finding silently shifts every later `CSF-NNN` — invalidating hand-written
 * triage prose and the exact-identifier allowlist used to close findings after
 * merge. With it, existing findings keep their numbers and new ones append.
 *
 * **Example** (Planning an empty capture)
 *
 * ```ts
 * import { planPacket } from "@beep/repo-cli/commands/Codex/Findings.normalize"
 * import { CodexCaptureMeta, CodexFindingsCapturePayload } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import { Effect } from "effect"
 *
 * const payload = CodexFindingsCapturePayload.make({
 *   schemaVersion: "codex-findings-capture/v1",
 *   capture: CodexCaptureMeta.make({
 *     capturedAt: "2026-08-04",
 *     sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
 *     repository: "kriegcloud/beep-effect",
 *     findingsView: "repo-scoped, status=open",
 *     expectedCount: 0,
 *     authState: "authenticated",
 *   }),
 *   findings: [],
 * })
 *
 * const program = planPacket(payload, {}).pipe(Effect.map((plan) => plan.slug))
 *
 * console.log(Effect.runSync(program)) // "codex-security-findings-2026-08-04"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const planPacket = Effect.fnUntraced(function* (
  payload: CodexFindingsCapturePayload,
  overrides: {
    readonly slug?: string | undefined;
    readonly branch?: string | undefined;
    readonly capturedAt?: string | undefined;
    readonly expectedCount?: number | undefined;
    /** Existing `codexId -> CSF-NNN` bindings read from a packet being re-ingested. */
    readonly priorIds?: HashMap.HashMap<string, string> | undefined;
  }
) {
  if (payload.capture.authState === "expired") {
    return yield* CodexFindingsIngestError.make({
      reason: "auth-expired",
      message:
        "The capture ran against a signed-out session, so the findings list was empty or partial. Sign in to the dashboard and capture again.",
    });
  }

  const expectedCount = overrides.expectedCount ?? payload.capture.expectedCount;
  const capturedCount = A.length(payload.findings);

  if (capturedCount < expectedCount) {
    return yield* CodexFindingsIngestError.make({
      reason: "short-read",
      message: `The capture read ${capturedCount} findings but the dashboard reported ${expectedCount}. Scroll the findings list to the end so every virtualized row renders, then capture again.`,
    });
  }

  const capturedAt = overrides.capturedAt ?? payload.capture.capturedAt;
  const ordered = A.sort(payload.findings, captureOrder);
  const priorIds = overrides.priorIds ?? HashMap.empty<string, string>();

  // Identifiers are assigned once and never reassigned. A finding that already
  // has a CSF number keeps it even when a more severe finding arrives ahead of
  // it in capture order, because that number is quoted in hand-written triage
  // prose and in the post-merge Codex close allowlist.
  const assignment = A.reduce(
    ordered,
    { nextOrdinal: highestReservedOrdinal(priorIds) + 1, records: A.empty<CodexFindingRecord>() },
    (accumulator, finding) => {
      const bound = HashMap.get(priorIds, finding.codexId);
      const id = O.getOrElse(bound, () => recordIdForOrdinal(accumulator.nextOrdinal));
      return {
        nextOrdinal: O.isSome(bound) ? accumulator.nextOrdinal : accumulator.nextOrdinal + 1,
        records: A.append(
          accumulator.records,
          CodexFindingRecord.make({
            id,
            codexId: finding.codexId,
            title: finding.title,
            severity: finding.severity,
            codexStatus: finding.codexStatus,
            commit: finding.commit,
          })
        ),
      };
    }
  );
  const records = assignment.records;

  return CodexPacketPlan.make({
    slug: overrides.slug ?? defaultPacketSlug(capturedAt),
    branch: overrides.branch ?? defaultPacketBranch(capturedAt),
    capturedAt,
    repository: payload.capture.repository,
    sourceUrl: payload.capture.sourceUrl,
    findingsView: payload.capture.findingsView,
    expectedCount,
    records,
    severityCounts: severityCountsOf(records),
  });
});
