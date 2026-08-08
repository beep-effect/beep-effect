/**
 * OSV ignore parsing for Quality audit commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str, thunkFalse, thunkTrue } from "@beep/utils";
import { DateTime, flow, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";

const OSV_IGNORED_VULNS_HEADER = "[[IgnoredVulns]]";
// Per-block field patterns. The `m` flag anchors `^`/`$` to each physical line
// inside a multi-line block chunk; `ignoreUntil` is a bare RFC-3339 TOML
// datetime (optionally quoted) such as `2026-09-13T00:00:00Z`.
const osvIgnoreIdPattern = /^\s*id\s*=\s*"(.+)"\s*$/mu;
const osvIgnoreUntilPattern = /^\s*ignoreUntil\s*=\s*"?([^"#\s]+)"?\s*$/mu;

type OsvIgnoreEntry = {
  readonly id: string;
  // `O.none` when the block declares no expiry; `O.some` with the parsed
  // instant when `ignoreUntil` is present and parseable. A present-but-
  // unparseable `ignoreUntil` is reported via `expiryMalformed` so the entry
  // fails closed (it is not allowed to suppress the advisory).
  readonly ignoreUntil: O.Option<DateTime.DateTime>;
  readonly expiryMalformed: boolean;
};

/**
 * Active and dropped OSV ignore ids for one audit invocation.
 *
 * **Example** (Empty selection object)
 *
 * ```ts
 * import type { OsvIgnoreAuditSelection } from "@beep/repo-cli/commands/Quality/Quality.osv-ignore"
 *
 * const selection: OsvIgnoreAuditSelection = { activeIds: [], droppedIds: [] }
 * console.log(selection.activeIds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
type OsvIgnoreAuditSelection = {
  readonly activeIds: Array<string>;
  readonly droppedIds: Array<string>;
};

const parseOsvIgnoreBlock = (block: string): O.Option<OsvIgnoreEntry> =>
  pipe(
    O.fromNullishOr(osvIgnoreIdPattern.exec(block)),
    O.flatMap((match) => O.fromNullishOr(match[1])),
    O.map((id) => {
      const rawIgnoreUntil = pipe(
        O.fromNullishOr(osvIgnoreUntilPattern.exec(block)),
        O.flatMap((match) => O.fromNullishOr(match[1]))
      );
      const ignoreUntil = O.flatMap(rawIgnoreUntil, DateTime.make);
      return {
        id,
        ignoreUntil,
        expiryMalformed: O.isSome(rawIgnoreUntil) && O.isNone(ignoreUntil),
      };
    })
  );

const parseOsvIgnoreEntries = (configText: string): ReadonlyArray<OsvIgnoreEntry> =>
  pipe(Str.split(configText, OSV_IGNORED_VULNS_HEADER), A.drop(1), A.map(parseOsvIgnoreBlock), A.getSomes);

const osvIgnoreEntryIsActive = (now: DateTime.DateTime): ((entry: OsvIgnoreEntry) => boolean) =>
  flow(
    O.liftPredicate((entry: OsvIgnoreEntry) => !entry.expiryMalformed),
    // Keep when there is no expiry, or the expiry is still in the future
    // (`ignoreUntil >= now`); drop malformed or expired ignores so the audit
    // fails closed and re-flags the advisory.
    O.map((entry) =>
      O.match(entry.ignoreUntil, {
        onNone: thunkTrue,
        onSome: Order.isGreaterThanOrEqualTo(DateTime.Order)(now),
      })
    ),
    O.getOrElse(thunkFalse)
  );

/**
 * Select active and dropped OSV advisory ids from `osv-scanner.toml`.
 *
 * **Example** (Select from empty config)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { selectOsvIgnoreIdsForAudit } from "@beep/repo-cli/commands/Quality/Quality.osv-ignore"
 *
 * const selection = selectOsvIgnoreIdsForAudit("", DateTime.makeUnsafe("2026-06-17T00:00:00Z"))
 * console.log(selection.activeIds)
 * ```
 *
 * @param configText - Raw `osv-scanner.toml` contents.
 * @param now - Current instant used to compare against each `ignoreUntil`.
 * @returns Active ids to pass to Bun audit and ids dropped because they expired or malformed.
 * @category parsing
 * @since 0.0.0
 */
export const selectOsvIgnoreIdsForAudit: {
  (configText: string, now: DateTime.DateTime): OsvIgnoreAuditSelection;
  (now: DateTime.DateTime): (configText: string) => OsvIgnoreAuditSelection;
} = dual(2, (configText: string, now: DateTime.DateTime): OsvIgnoreAuditSelection => {
  const entries = parseOsvIgnoreEntries(configText);
  const isActive = osvIgnoreEntryIsActive(now);

  return {
    activeIds: pipe(
      entries,
      A.filter(isActive),
      A.map((entry) => entry.id)
    ),
    droppedIds: pipe(
      entries,
      A.filter((entry) => !isActive(entry)),
      A.map((entry) => entry.id)
    ),
  };
});

/**
 * Select the OSV advisory ids that may still be suppressed at `now`.
 *
 * **Details**
 *
 * Entries whose `ignoreUntil` has passed, or whose `ignoreUntil` is present but
 * unparseable, are dropped so the Bun audit lane stops mirroring expired
 * ignores and fails closed once the configured expiry elapses.
 *
 * **Example** (Future expiry stays active)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { activeOsvIgnoreIdsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const ids = activeOsvIgnoreIdsForTesting(
 *   '[[IgnoredVulns]]\nid = "GHSA-x"\nignoreUntil = 2999-01-01T00:00:00Z\n',
 *   DateTime.makeUnsafe("2026-06-17T00:00:00Z")
 * )
 * console.log(ids) // example value
 * ```
 *
 * @param configText - Raw `osv-scanner.toml` contents.
 * @param now - Current instant used to compare against each `ignoreUntil`.
 * @returns Active advisory ids in config order.
 * @category testing
 * @since 0.0.0
 */
export const activeOsvIgnoreIdsForTesting: {
  (configText: string, now: DateTime.DateTime): ReadonlyArray<string>;
  (now: DateTime.DateTime): (configText: string) => ReadonlyArray<string>;
} = dual(
  2,
  (configText: string, now: DateTime.DateTime): ReadonlyArray<string> =>
    selectOsvIgnoreIdsForAudit(configText, now).activeIds
);
