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
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { parse } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";

const OSV_IGNORED_VULNS_HEADER = "[[IgnoredVulns]]";
const OSV_PACKAGE_OVERRIDE_HEADER = "[[PackageOverrides]]";
// Per-block field patterns. The `m` flag anchors `^`/`$` to each physical line
// inside a multi-line block chunk; `ignoreUntil` is a bare RFC-3339 TOML
// datetime (optionally quoted) such as `2026-09-13T00:00:00Z`.
const osvIgnoreIdPattern = /^\s*id\s*=\s*"(.+)"\s*$/mu;
const osvIgnoreUntilPattern = /^\s*ignoreUntil\s*=\s*"?([^"#\s]+)"?\s*$/mu;
const osvPackageNamePattern = /^\s*name\s*=\s*"([^"]+)"\s*$/mu;
const osvPackageVersionPattern = /^\s*version\s*=\s*"([^"]+)"\s*$/mu;
const osvPackageNpmPattern = /^\s*ecosystem\s*=\s*"npm"\s*$/mu;
const osvPackageIgnorePattern = /^\s*ignore\s*=\s*true\s*$/mu;
const osvPackageExpiryPattern = /^\s*effectiveUntil\s*=\s*"?([^"#\s]+)"?\s*$/mu;
const osvPackageReasonPattern = /^\s*reason\s*=\s*"([^"]+)"\s*$/mu;
const ghsaIdPattern = /\b(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\b/u;
const bunAuditLock = S.Struct({ packages: S.Record(S.String, S.Array(S.Unknown)) });

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

const field = (pattern: RegExp, block: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(pattern.exec(block)),
    O.flatMap((match) => O.fromNullishOr(match[1]))
  );

const packageOverrideAuditId = (
  block: string,
  packages: Readonly<Record<string, ReadonlyArray<unknown>>>,
  now: DateTime.DateTime
): O.Option<string> => {
  if (!osvPackageNpmPattern.test(block) || !osvPackageIgnorePattern.test(block)) return O.none();

  return pipe(
    O.all({
      name: field(osvPackageNamePattern, block),
      version: field(osvPackageVersionPattern, block),
      expiry: O.flatMap(field(osvPackageExpiryPattern, block), DateTime.make),
      reason: field(osvPackageReasonPattern, block),
    }),
    O.filter(({ expiry }) => Order.isGreaterThanOrEqualTo(DateTime.Order)(now)(expiry)),
    O.filter(({ name, version }) => {
      const resolutions = A.filter(R.toEntries(packages), ([key]) => key === name || Str.startsWith(`${name}@`)(key));
      return (
        A.isReadonlyArrayNonEmpty(resolutions) &&
        A.every(resolutions, ([, tuple]) => S.is(S.String)(tuple[0]) && tuple[0] === `${name}@${version}`)
      );
    }),
    O.flatMap(({ reason }) => field(ghsaIdPattern, reason))
  );
};

/**
 * Mirror an exact OSV package override into Bun audit only while every locked
 * resolution of that package matches its reviewed version and its expiry holds.
 *
 * **Example** (No package overrides)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { selectOsvPackageOverrideIdsForAudit } from "@beep/repo-cli/commands/Quality/Quality.osv-ignore"
 * const ids = selectOsvPackageOverrideIdsForAudit("", "{}", DateTime.makeUnsafe("2026-10-02T00:00:00Z"))
 * console.log(ids) // []
 * ```
 *
 * @param configText - Raw OSV Scanner configuration.
 * @param lockfileText - Raw Bun JSONC lockfile.
 * @param now - Current instant for override expiry.
 * @returns Advisory ids safe to ignore for the exact locked artifacts.
 * @category parsing
 * @since 0.0.0
 */
export const selectOsvPackageOverrideIdsForAudit: {
  (configText: string, lockfileText: string, now: DateTime.DateTime): ReadonlyArray<string>;
  (lockfileText: string, now: DateTime.DateTime): (configText: string) => ReadonlyArray<string>;
} = dual(3, (configText: string, lockfileText: string, now: DateTime.DateTime): ReadonlyArray<string> => {
  const errors: Array<ParseError> = [];
  const parsed: unknown = parse(lockfileText, errors, { allowTrailingComma: true, disallowComments: false });
  if (A.isReadonlyArrayNonEmpty(errors) || !S.is(bunAuditLock)(parsed)) return [];

  return pipe(
    Str.split(configText, OSV_PACKAGE_OVERRIDE_HEADER),
    A.drop(1),
    A.map((block) => packageOverrideAuditId(block, parsed.packages, now)),
    A.getSomes
  );
});

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
