/**
 * Conservative organization-domain and temporal review leads.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyServerId } from "@beep/identity/packages";
import { normalizeEmail } from "@beep/party-domain/Identifier";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const $I = $PartyServerId.create("values/OrgEvidence/OrgEvidence.model");

/**
 * Consumer-mail domains excluded from organization leads.
 * **Example** (Use FreeMailDomain)
 * ```ts
 * import { FreeMailDomain } from "@beep/party-server/OrgEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(FreeMailDomain)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const FreeMailDomain = LiteralKit([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "comcast.net",
  "att.net",
  "sbcglobal.net",
  "bellsouth.net",
  "verizon.net",
  "cox.net",
  "charter.net",
  "earthlink.net",
  "juno.com",
  "mchsi.com",
  "mediacombb.net",
  "centurylink.net",
  "q.com",
  "windstream.net",
  "frontiernet.net",
  "protonmail.com",
  "proton.me",
  "gmx.com",
]).pipe($I.annoteSchema("FreeMailDomain", { description: "Consumer-mail domains excluded from organization leads." }));
/**
 * Decoded FreeMailDomain.
 * @category models
 * @since 0.0.0
 */
export type FreeMailDomain = typeof FreeMailDomain.Type;

/**
 * A review lead, never an accepted identity or affiliation claim.
 * **Example** (Use OrgLead)
 * ```ts
 * import { OrgLead } from "@beep/party-server/OrgEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(OrgLead)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const OrgLead = LiteralKit([
  "same-org-alias",
  "different-orgs-concurrent",
  "different-orgs-sequential",
  "different-orgs-undated",
  "no-org-evidence",
]).pipe($I.annoteSchema("OrgLead", { description: "A review lead, never an accepted identity or affiliation claim." }));
/**
 * Decoded OrgLead.
 * @category models
 * @since 0.0.0
 */
export type OrgLead = typeof OrgLead.Type;

/**
 * Display-name information shape; never sufficient evidence of identity.
 * **Example** (Use NameShape)
 * ```ts
 * import { NameShape } from "@beep/party-server/OrgEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(NameShape)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NameShape = LiteralKit(["full-name", "single-token"]).pipe(
  $I.annoteSchema("NameShape", {
    description: "Display-name information shape; never sufficient evidence of identity.",
  })
);
/**
 * Decoded NameShape.
 * @category models
 * @since 0.0.0
 */
export type NameShape = typeof NameShape.Type;

/**
 * Inclusive first and last observed message instants.
 * **Example** (Use ObservedSpan)
 * ```ts
 * import { ObservedSpan } from "@beep/party-server/OrgEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ObservedSpan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservedSpan extends S.Opaque<ObservedSpan, { readonly brand: unique symbol }>()(
  S.Struct({ first: S.DateTimeUtcFromMillis, last: S.DateTimeUtcFromMillis })
    .check(
      S.makeFilter(
        (span) => DateTime.toEpochMillis(span.first) <= DateTime.toEpochMillis(span.last),
        $I.annote("OrderedObservedSpan", { message: "First observation must not follow last observation." })
      )
    )
    .pipe($I.annoteSchema("ObservedSpan", { description: "Inclusive observed bounds, not a claim validity interval." }))
) {}

/**
 * Organization-domain hints and an optional observed span for one mailbox.
 * **Example** (Use MailboxEvidence)
 * ```ts
 * import { MailboxEvidence } from "@beep/party-server/OrgEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(MailboxEvidence)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailboxEvidence extends S.Opaque<MailboxEvidence, { readonly brand: unique symbol }>()(
  S.Struct({ domains: S.HashSet(S.NonEmptyString), span: S.OptionFromNullOr(ObservedSpan) }).pipe(
    $I.annoteSchema("MailboxEvidence", { description: "Domain and time evidence for a review lead." })
  )
) {}
const secondLevel = HashSet.make("co", "com", "org", "net", "ac", "gov", "edu");
const isFreeMail = S.is(FreeMailDomain);

/**
 * Normalize a mailbox and derive a conservative organization-domain grouping hint.
 * **Details**
 * The inherited two/three-label heuristic is not a public-suffix registry or
 * proof of common ownership. Exchange directory organization strings are never
 * used. Free mail and malformed addresses yield None.
 * **Example** (Use organizationDomain)
 * ```ts
 * import { organizationDomain } from "@beep/party-server/OrgEvidence"
 * const classify = organizationDomain
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const organizationDomain = Effect.fn("PartyOrg.organizationDomain")(function* (raw: string) {
  const normalized = yield* Effect.option(normalizeEmail(raw));
  return normalized.pipe(
    O.flatMap((email) => A.last(Str.split(email, "@"))),
    O.filter((host) => Str.includes(".")(host)),
    O.map((host) => {
      const labels = Str.split(host, ".");
      const n = A.length(labels);
      const take =
        n >= 3 &&
        HashSet.has(
          secondLevel,
          O.getOrElse(A.get(labels, n - 2), () => "")
        )
          ? 3
          : 2;
      return A.join(A.drop(labels, N.max(0, n - take)), ".");
    }),
    O.filter((domain) => !isFreeMail(domain))
  );
});
const overlap = (left: ObservedSpan, right: ObservedSpan) =>
  DateTime.toEpochMillis(left.first) <= DateTime.toEpochMillis(right.last) &&
  DateTime.toEpochMillis(right.first) <= DateTime.toEpochMillis(left.last);

/**
 * Classify disjoint organization evidence using numeric observed times.
 * **Details**
 * A known concurrent disjoint pair is retained even when another pair is
 * undated. Every result remains a reviewer lead; this function creates no claims.
 * **Example** (Use classifyByOrganization)
 * ```ts
 * import { classifyByOrganization } from "@beep/party-server/OrgEvidence"
 * const classify = classifyByOrganization
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const classifyByOrganization = (mailboxes: ReadonlyArray<MailboxEvidence>): OrgLead => {
  const withOrg = A.filter(mailboxes, (mailbox) => HashSet.size(mailbox.domains) > 0);
  if (A.length(withOrg) < 2) return OrgLead.Enum["no-org-evidence"];
  const pairs = A.flatMap(withOrg, (left, index) =>
    A.map(A.drop(withOrg, index + 1), (right) => Tuple.make(left, right))
  );
  const disjoint = A.filter(
    pairs,
    ([left, right]) => HashSet.size(HashSet.intersection(left.domains, right.domains)) === 0
  );
  if (A.isReadonlyArrayEmpty(disjoint)) return OrgLead.Enum["same-org-alias"];
  const timed = A.flatMap(disjoint, ([left, right]) => O.toArray(O.all([left.span, right.span])));
  if (A.some(timed, ([left, right]) => overlap(left, right))) return OrgLead.Enum["different-orgs-concurrent"];
  return A.length(timed) < A.length(disjoint)
    ? OrgLead.Enum["different-orgs-undated"]
    : OrgLead.Enum["different-orgs-sequential"];
};

/**
 * Classify the information shape of a display name.
 * **Example** (Use nameShape)
 * ```ts
 * import { nameShape } from "@beep/party-server/OrgEvidence"
 * const classify = nameShape
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const nameShape = (name: string): NameShape =>
  A.length(A.filter(Str.split(name, /[\s,]+/u), Str.isNonEmpty)) >= 2
    ? NameShape.Enum["full-name"]
    : NameShape.Enum["single-token"];
