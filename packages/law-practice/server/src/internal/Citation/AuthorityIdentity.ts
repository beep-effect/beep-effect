/**
 * Versioned authority keys adapted from pinned eyecite resource equality.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAuthorityId,
  CitationComponents,
  CitationEditionRef,
  CitationMentionId,
  FullCitation,
} from "@beep/law-practice-domain/values";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as Crypto from "effect/Crypto";

const $I = $LawPracticeServerId.create("internal/Citation/AuthorityIdentity");
const encoder = new TextEncoder();
/**
 * Selected frozen edition spelling supplied by the trusted artifact adapter.
 * Reference coherence is checked; this data does not authenticate its spelling.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationAuthorityEdition extends S.Opaque<CitationAuthorityEdition, { readonly brand: unique symbol }>()(
  S.Struct({ edition: CitationEditionRef, shortName: S.NonEmptyString }).pipe(
    $I.annoteSchema("CitationAuthorityEdition", {
      description: "Private frozen edition adapter data reused by authority and document identity checks.",
    })
  )
) {}
/**
 * Private decoded authority input from semantic models and trusted adapters.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationAuthorityIdentityInput extends S.Opaque<
  CitationAuthorityIdentityInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    citation: FullCitation,
    mentionId: CitationMentionId,
    selectedEdition: S.OptionFromNullOr(CitationAuthorityEdition),
  }).pipe(
    $I.annoteSchema("CitationAuthorityIdentityInput", {
      description:
        "Decoded full citation and occurrence ID, with selected edition spelling supplied by the trusted frozen artifact lookup.",
    })
  )
) {}
const Component = S.Tuple([S.NonEmptyString, S.NullOr(S.String)]);
const Components = S.Array(Component);
const Key = S.fromJsonString(
  S.Union([
    S.Tuple([S.tag("citation-authority/v1"), S.tag("case"), Components]),
    S.Tuple([S.tag("citation-authority/v1"), S.tag("case-occurrence"), CitationMentionId]),
    S.Tuple([S.tag("citation-authority/v1"), S.Literals(["law", "journal"]), Components, S.Array(CitationEditionRef)]),
  ])
).pipe(
  $I.annoteSchema("Key", {
    description:
      "Ordered JSON authority protocol; case resource identity or complete legal groups and edition bag, without metadata.",
  })
);
const FailureReason = LiteralKit(["invalid-input", "missing-edition", "digest-failed"]).pipe(
  $I.annoteSchema("FailureReason", { description: "Sanitized private authority-key failure reasons." })
);
/**
 * Private identity failure for mapping into the final closed engine boundary.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationAuthorityIdentityFailure extends S.TaggedError<
  CitationAuthorityIdentityFailure,
  { readonly brand: unique symbol }
>($I`CitationAuthorityIdentityFailure`)(
  "CitationAuthorityIdentityFailure",
  { reason: FailureReason },
  $I.annoteError<CitationAuthorityIdentityFailure>("CitationAuthorityIdentityFailure", {
    description: "Authority key production failed without retaining citation input or adapter causes.",
  })
) {}
const invalid = () => CitationAuthorityIdentityFailure.make({ reason: "invalid-input" });
const componentOrder = Order.mapInput(Order.String, (entry: typeof Component.Type) => entry[0]);

/**
 * Produce a deterministic document-local authority ID using canonical equality.
 *
 * Cases with explicit null pages remain occurrence-unique. Other cases use
 * volume/page and corrected reporter, ignoring dates/names/extra components.
 * Law/journal resources preserve all components and edition multiplicity.
 * Candidate order is normalized under the packet's declared edition-bag law.
 * Selected spelling is trusted artifact adapter data, not self-authenticating;
 * the live engine must resolve/check the edition reference before calling.
 * The occurrence ID must likewise come from the verified mention producer.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const makeCitationAuthorityId = Effect.fn("Citation.makeAuthorityId")(function* (
  input: unknown
): Effect.fn.Return<CitationAuthorityId, CitationAuthorityIdentityFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(CitationAuthorityIdentityInput))(input).pipe(
    Effect.mapError(invalid)
  );
  const citation = decoded.citation;
  const selected = citation.publication.selectedEdition;
  const edition = decoded.selectedEdition;
  if (
    O.isSome(selected) !== O.isSome(edition) ||
    (O.isSome(selected) && O.isSome(edition) && selected.value !== edition.value.edition)
  ) {
    return yield* CitationAuthorityIdentityFailure.make({ reason: "missing-edition" });
  }
  const components = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(Effect.mapError(invalid));
  const pairs = A.map(R.toEntries(components), ([name, value]): typeof Component.Type => [name, value]);
  let preimage: string;
  if (citation.type === "case") {
    const page = R.get(components, "page");
    const reporter = R.get(components, "reporter");
    if (O.isNone(page) || O.isNone(reporter)) return yield* invalid();
    if (page.value === null) {
      preimage = yield* S.encodeEffect(Key)(["citation-authority/v1", "case-occurrence", decoded.mentionId]).pipe(
        Effect.mapError(invalid)
      );
    } else {
      const groups = A.filter(pairs, ([name]) => name === "volume" || name === "page");
      const correctedReporter = O.isSome(edition) ? edition.value.shortName : reporter.value;
      preimage = yield* S.encodeEffect(Key)([
        "citation-authority/v1",
        "case",
        A.sort(A.append(groups, ["reporter", correctedReporter]), componentOrder),
      ]).pipe(Effect.mapError(invalid));
    }
  } else {
    preimage = yield* S.encodeEffect(Key)([
      "citation-authority/v1",
      citation.type,
      A.sort(pairs, componentOrder),
      A.sort(citation.publication.editions, Order.String),
    ]).pipe(Effect.mapError(invalid));
  }
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(preimage)).pipe(
    Effect.mapError(() => CitationAuthorityIdentityFailure.make({ reason: "digest-failed" }))
  );
  return CitationAuthorityId.make(`ca1:${digest}`);
});
