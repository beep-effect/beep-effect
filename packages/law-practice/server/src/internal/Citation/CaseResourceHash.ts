/**
 * Exact case/resource hashing adapted from pinned eyecite 2.7.6 models.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationComponents, FullCaseCitation } from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CitationAuthorityEdition, citationAuthorityEditionMatches } from "./AuthorityIdentity.ts";
import { encodeCitationRuntimeString, hashCitationRuntimePreimage } from "./RuntimeHashEncoding.ts";
import type * as Digest from "effect/crypto/Digest";

const $I = $LawPracticeServerId.create("internal/Citation/CaseResourceHash");
const IdentityHash = S.BigIntFromString.check(
  S.makeFilter(
    (value) => value > BigInt(0) && value < BigInt(2) ** BigInt(63),
    $I.annote("PositiveIdentityHash", {
      description: "Explicit positive signed 64-bit object identity hash.",
      message: "Invalid identity hash.",
    })
  )
);
/**
 * Current semantic snapshot plus trusted edition lookup and optional opaque identity hash.
 * The identity value is needed only for explicit null pages; it is never derived from content.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationCaseResourceHashInput extends S.Opaque<
  CitationCaseResourceHashInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    citation: FullCaseCitation,
    selectedEdition: S.OptionFromNullOr(CitationAuthorityEdition),
    missingPageIdentityHash: S.OptionFromNullOr(IdentityHash),
  }).pipe(
    $I.annoteSchema("CitationCaseResourceHashInput", {
      description: "Private current case hash inputs; lookup and identity provenance remain adapter responsibilities.",
    })
  )
) {}
const CitationCaseResourceHashInputType = S.toType(CitationCaseResourceHashInput);

/**
 * Exact source citation and resource hashes without JSON number precision loss.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationCaseResourceHash extends S.Opaque<CitationCaseResourceHash, { readonly brand: unique symbol }>()(
  S.Struct({ citationHash: S.BigIntFromString, resourceHash: S.BigIntFromString }).pipe(
    $I.annoteSchema("CitationCaseResourceHash", {
      description: "CPython 64-bit runtime hash pair, encoded as decimal strings.",
    })
  )
) {}
const Reason = LiteralKit([
  "invalid-input",
  "missing-page",
  "missing-reporter",
  "missing-edition",
  "identity-unavailable",
  "digest-failed",
]);
/**
 * Sanitized hash-production failure without retained input or digest causes.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationCaseResourceHashFailure extends S.TaggedError<
  CitationCaseResourceHashFailure,
  { readonly brand: unique symbol }
>($I`CitationCaseResourceHashFailure`)(
  "CitationCaseResourceHashFailure",
  { reason: Reason },
  $I.annoteError<CitationCaseResourceHashFailure>("CitationCaseResourceHashFailure", {
    description: "Closed private runtime hash failure.",
  })
) {}
const failure = (reason: typeof Reason.Type) => CitationCaseResourceHashFailure.make({ reason });
const quote = Effect.fn("Citation.caseHashString")((value: string) =>
  encodeCitationRuntimeString(value).pipe(Effect.mapError((error) => failure(error.reason)))
);
const jsonValue = (value: string | null) => (value === null ? Effect.succeed("null") : quote(value));
const numericHash = Effect.fn("Citation.caseHashPreimage")((preimage: string) =>
  hashCitationRuntimePreimage(preimage).pipe(Effect.mapError((error) => failure(error.reason)))
);
const nonNullCaseHash = Effect.fn("Citation.hashNonNullCase")(function* (
  decoded: typeof CitationCaseResourceHashInputType.Type,
  groups: typeof CitationComponents.Encoded,
  page: string
) {
  const selected = decoded.citation.publication.selectedEdition;
  const edition = decoded.selectedEdition;
  if (
    !citationAuthorityEditionMatches(
      selected,
      O.map(edition, (value) => value.edition)
    )
  )
    return yield* failure("missing-edition");
  const rawReporter = R.get(groups, "reporter");
  if (O.isNone(edition) && O.isNone(rawReporter)) return yield* failure("missing-reporter");
  const reporter = O.isSome(edition) ? edition.value.shortName : O.getOrElse(rawReporter, () => null);
  const pageJson = yield* quote(page);
  const reporterJson = yield* jsonValue(reporter);
  const volume = R.get(groups, "volume");
  const volumeJson = O.isSome(volume) ? `, "volume": ${yield* jsonValue(volume.value)}` : "";
  // Snapshot the complete preimage before the first asynchronous digest.
  return yield* numericHash(
    `{"class": "FullCaseCitation", "page": ${pageJson}, "reporter": ${reporterJson}${volumeJson}}`
  );
});
/**
 * Hash the current case fields with source JSON spacing, ASCII escaping and
 * CPython integer reduction. No mutable citation-bearing input is memoized.
 * Null pages bypass reporter/edition access exactly as the source does.
 * This helper does not allocate process identities or authenticate edition data.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const makeCitationCaseResourceHash = Effect.fn("Citation.makeCaseResourceHash")(function* (
  input: unknown
): Effect.fn.Return<CitationCaseResourceHash, CitationCaseResourceHashFailure, Digest.Digest> {
  const decoded = yield* S.decodeUnknownEffect(CitationCaseResourceHashInputType)(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const groups = yield* S.encodeEffect(CitationComponents)(decoded.citation.components).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const page = R.get(groups, "page");
  if (O.isNone(page)) return yield* failure("missing-page");
  let citationHash: bigint;
  if (page.value === null) {
    if (O.isNone(decoded.missingPageIdentityHash)) return yield* failure("identity-unavailable");
    citationHash = decoded.missingPageIdentityHash.value;
  } else {
    citationHash = yield* nonNullCaseHash(decoded, groups, page.value);
  }
  const decimal = yield* S.encodeEffect(S.BigIntFromString)(citationHash).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const resourceHash = yield* numericHash(`{"citation": ${decimal}, "class": "Resource"}`);
  return CitationCaseResourceHash.make({ citationHash, resourceHash });
});
