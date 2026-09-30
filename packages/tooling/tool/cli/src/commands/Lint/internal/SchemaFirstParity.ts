/**
 * Occurrence-membership ratchet for the upstream-parity schema-first rules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { HashMap, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { diffMembership } from "../../../internal/ratchet/index.ts";
import {
  makeSchemaFirstEntryKey,
  SchemaFirstBacklogRow,
  SchemaFirstParityFindings,
  SchemaFirstParityRuleId,
  SchemaFirstParityRuleSummary,
  schemaFirstBacklogRowKeys,
} from "../Lint.schemas.ts";
import type { SchemaFirstInventoryEntry } from "../Lint.schemas.ts";

const isSchemaFirstParityRuleId = S.is(SchemaFirstParityRuleId);

type BacklogMember = {
  readonly file: string;
  readonly ruleId: SchemaFirstParityRuleId;
  readonly occurrence: string;
};

const backlogMember = (entry: SchemaFirstInventoryEntry): O.Option<BacklogMember> =>
  pipe(
    O.all({
      ruleId: pipe(O.fromUndefinedOr(entry.ruleId), O.filter(isSchemaFirstParityRuleId)),
      occurrence: O.fromUndefinedOr(entry.occurrence),
    }),
    O.map(({ ruleId, occurrence }) => ({ file: entry.file, ruleId, occurrence }))
  );

const backlogRowOrder = Order.combine(
  Order.mapInput(Order.String, (row: SchemaFirstBacklogRow) => row.file),
  Order.mapInput(Order.String, (row: SchemaFirstBacklogRow) => row.ruleId)
);

const toBacklogRows = (members: ReadonlyArray<BacklogMember>): ReadonlyArray<SchemaFirstBacklogRow> =>
  pipe(
    members,
    A.groupBy((member) => `${member.file}::${member.ruleId}`),
    R.values,
    A.map((group) => {
      const first = A.headNonEmpty(group);
      return SchemaFirstBacklogRow.make({
        ruleId: first.ruleId,
        file: first.file,
        occurrences: A.sort(
          A.map(group, (member) => member.occurrence),
          Order.String
        ),
      });
    }),
    A.sort(backlogRowOrder)
  );

/**
 * Group live parity entries into the compact backlog rows committed with `--write`.
 *
 * **Details**
 *
 * Rows are sorted by file then rule id and each row's anchors are sorted
 * lexically, so the committed backlog only changes when membership changes.
 * Entries without a parity rule id or an occurrence anchor are ignored.
 *
 * **Example** (Group parity entries into backlog rows)
 *
 * ```ts
 * import { toSchemaFirstBacklog } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(toSchemaFirstBacklog([]).length) // 0
 * ```
 *
 * @param entries - Live parity entries from the scan.
 * @returns The backlog rows that record exactly those occurrences.
 * @category utilities
 * @since 0.0.0
 */
export const toSchemaFirstBacklog = (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>
): ReadonlyArray<SchemaFirstBacklogRow> => toBacklogRows(A.getSomes(A.map(entries, backlogMember)));

const countByRule = <Item>(
  items: ReadonlyArray<Item>,
  ruleOf: (item: Item) => string | undefined,
  ruleId: SchemaFirstParityRuleId
): number => A.length(A.filter(items, (item) => ruleOf(item) === ruleId));

const backlogOccurrenceCount = (rows: ReadonlyArray<SchemaFirstBacklogRow>, ruleId: SchemaFirstParityRuleId): number =>
  A.reduce(
    A.filter(rows, (row) => row.ruleId === ruleId),
    0,
    (total, row) => total + A.length(row.occurrences)
  );

/**
 * Diff live parity entries against the committed backlog by occurrence membership.
 *
 * **Details**
 *
 * Both sides reduce to {@link makeSchemaFirstEntryKey} membership keys and go
 * through the shared `diffMembership` ratchet classification, so no line
 * number takes part and nothing is counted: a new anchor is introduced, a
 * missing one is resolved.
 *
 * **Example** (Diff an empty scan against an empty backlog)
 *
 * ```ts
 * import { diffSchemaFirstParity } from "@beep/repo-cli/commands/Lint"
 *
 * const findings = diffSchemaFirstParity([], [])
 * console.log(findings.introduced.length, findings.resolved.length) // 0 0
 * ```
 *
 * @param live - Live parity entries from the scan.
 * @param baseline - Committed backlog rows.
 * @returns Introduced entries, resolved rows, and per-rule membership counts.
 * @category utilities
 * @since 0.0.0
 */
export const diffSchemaFirstParity: {
  (
    live: ReadonlyArray<SchemaFirstInventoryEntry>,
    baseline: ReadonlyArray<SchemaFirstBacklogRow>
  ): SchemaFirstParityFindings;
  (
    baseline: ReadonlyArray<SchemaFirstBacklogRow>
  ): (live: ReadonlyArray<SchemaFirstInventoryEntry>) => SchemaFirstParityFindings;
} = dual(2, (live: ReadonlyArray<SchemaFirstInventoryEntry>, baseline: ReadonlyArray<SchemaFirstBacklogRow>) => {
  const liveByKey = HashMap.fromIterable(
    A.map(live, (entry): readonly [string, SchemaFirstInventoryEntry] => [makeSchemaFirstEntryKey(entry), entry])
  );
  const baselineByKey = HashMap.fromIterable(
    A.flatMap(baseline, (row) =>
      A.zip(
        schemaFirstBacklogRowKeys(row),
        A.map(row.occurrences, (occurrence): BacklogMember => ({ file: row.file, ruleId: row.ruleId, occurrence }))
      )
    )
  );
  const membership = diffMembership({
    current: A.fromIterable(HashMap.keys(liveByKey)),
    baseline: A.fromIterable(HashMap.keys(baselineByKey)),
    equivalence: Str.Equivalence,
    order: Order.String,
  });
  const introduced = A.getSomes(A.map(membership.introduced, (key) => HashMap.get(liveByKey, key)));
  const resolved = toBacklogRows(A.getSomes(A.map(membership.resolved, (key) => HashMap.get(baselineByKey, key))));
  return SchemaFirstParityFindings.make({
    introduced,
    resolved,
    rules: A.map(SchemaFirstParityRuleId.literals, (ruleId) =>
      SchemaFirstParityRuleSummary.make({
        ruleId,
        live: countByRule(live, (entry) => entry.ruleId, ruleId),
        baseline: backlogOccurrenceCount(baseline, ruleId),
        introduced: countByRule(introduced, (entry) => entry.ruleId, ruleId),
        resolved: backlogOccurrenceCount(resolved, ruleId),
      })
    ),
    liveCount: membership.currentCount,
    baselineCount: membership.baselineCount,
  });
});
