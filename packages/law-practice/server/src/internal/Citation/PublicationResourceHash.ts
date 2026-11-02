/**
 * Exact law/journal hashes adapted from eyecite 2.7.6 ResourceCitation/Resource.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationComponents,
  CitationEditionRef,
  FullJournalCitation,
  FullLawCitation,
} from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CitationCaseResourceHash } from "./CaseResourceHash.ts";
import {
  encodeCitationRuntimeString,
  hashCitationRuntimePreimage,
  makeCitationRuntimeStringOrder,
} from "./RuntimeHashEncoding.ts";
import type * as Digest from "effect/crypto/Digest";

const $I = $LawPracticeServerId.create("internal/Citation/PublicationResourceHash");
const Reporter = S.Struct({
  short_name: S.String,
  name: S.String,
  cite_type: S.String,
  source: S.String,
  is_scotus: S.Boolean,
});
const Edition = S.Struct({
  short_name: S.String,
  start: S.NullOr(S.String),
  end: S.NullOr(S.String),
  reporter: Reporter,
});
/**
 * Source dataclass payload resolved by a trusted frozen-artifact adapter.
 * Dates are exact Python str(datetime) values, not inferred from target dates.
 * This schema checks shape; the reference does not authenticate its own payload.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationRuntimeEdition extends S.Opaque<CitationRuntimeEdition, { readonly brand: unique symbol }>()(
  S.Struct({ edition: CitationEditionRef, value: Edition }).pipe(
    $I.annoteSchema("CitationRuntimeEdition", {
      description: "Private exact source edition/reporter payload with an external artifact reference.",
    })
  )
) {}
/**
 * Current legal/journal semantics and occurrence-ordered edition lookup results.
 * Stable abbreviation sorting retains order among ties and all duplicates.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationPublicationResourceHashInput extends S.Opaque<
  CitationPublicationResourceHashInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    citation: S.Union([FullLawCitation, FullJournalCitation]),
    editions: S.Array(CitationRuntimeEdition),
  }).pipe(
    $I.annoteSchema("CitationPublicationResourceHashInput", {
      description: "Private publication hash input; edition occurrences must match semantic reference order exactly.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-input", "missing-edition", "digest-failed"]);
/**
 * Closed publication-hash failure without citation data or adapter causes.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationPublicationResourceHashFailure extends S.TaggedError<
  CitationPublicationResourceHashFailure,
  { readonly brand: unique symbol }
>($I`CitationPublicationResourceHashFailure`)(
  "CitationPublicationResourceHashFailure",
  { reason: Reason },
  $I.annoteError<CitationPublicationResourceHashFailure>("CitationPublicationResourceHashFailure", {
    description: "Sanitized private publication hash failure.",
  })
) {}
const failure = (reason: typeof Reason.Type) => CitationPublicationResourceHashFailure.make({ reason });
const quote = Effect.fn("Citation.publicationHashString")((value: string) =>
  encodeCitationRuntimeString(value).pipe(Effect.mapError((error) => failure(error.reason)))
);
const nullable = (value: string | null) => (value === null ? Effect.succeed("null") : quote(value));
/**
 * Exact source sorted-key JSON for one complete edition/reporter payload.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const encodeCitationRuntimeEdition = Effect.fn("Citation.runtimeEditionJson")(function* (
  value: typeof Edition.Type
) {
  const reporter = value.reporter;
  return `{"end": ${yield* nullable(value.end)}, "reporter": {"cite_type": ${yield* quote(reporter.cite_type)}, "is_scotus": ${reporter.is_scotus ? "true" : "false"}, "name": ${yield* quote(reporter.name)}, "short_name": ${yield* quote(reporter.short_name)}, "source": ${yield* quote(reporter.source)}}, "short_name": ${yield* quote(value.short_name)}, "start": ${yield* nullable(value.start)}}`;
});
const stringOrder = makeCitationRuntimeStringOrder();
const editionOrder = Order.mapInput(stringOrder, (value: typeof Edition.Type) => value.short_name);
const fieldOrder = Order.mapInput(stringOrder, (field: readonly [string, string]) => field[0]);
/**
 * Hash every legal group and the source's complete edition payloads, using a
 * stable Unicode-code-point abbreviation sort. Selected edition and metadata
 * do not enter the source hash. Reserved group names are overwritten as upstream.
 * All preimage fields are copied before the first asynchronous digest.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const makeCitationPublicationResourceHash = Effect.fn("Citation.makePublicationResourceHash")(function* (
  input: unknown
): Effect.fn.Return<CitationCaseResourceHash, CitationPublicationResourceHashFailure, Digest.Digest> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(CitationPublicationResourceHashInput))(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const refs = decoded.citation.publication.editions;
  if (
    A.length(refs) !== A.length(decoded.editions) ||
    !A.every(decoded.editions, (edition, index) => edition.edition === A.getUnsafe(refs, index))
  )
    return yield* failure("missing-edition");
  const groups = yield* S.encodeEffect(CitationComponents)(decoded.citation.components).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const editions = yield* Effect.forEach(
    A.sort(
      A.map(decoded.editions, (row) => row.value),
      editionOrder
    ),
    encodeCitationRuntimeEdition,
    { concurrency: 1 }
  );
  let fields = yield* Effect.forEach(
    A.filter(R.toEntries(groups), ([name]) => name !== "class" && name !== "all_editions"),
    ([name, value]) => nullable(value).pipe(Effect.map((json): readonly [string, string] => [name, json])),
    { concurrency: 1 }
  );
  fields = A.appendAll(fields, [
    ["all_editions", `[${A.join(editions, ", ")}]`],
    ["class", yield* quote(decoded.citation.type === "law" ? "FullLawCitation" : "FullJournalCitation")],
  ]);
  const encodedFields = yield* Effect.forEach(
    A.sort(fields, fieldOrder),
    ([name, json]) => quote(name).pipe(Effect.map((name) => `${name}: ${json}`)),
    { concurrency: 1 }
  );
  const citationHash = yield* hashCitationRuntimePreimage(`{${A.join(encodedFields, ", ")}}`).pipe(
    Effect.mapError((error) => failure(error.reason))
  );
  const decimal = yield* S.encodeEffect(S.BigIntFromString)(citationHash).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const resourceHash = yield* hashCitationRuntimePreimage(`{"citation": ${decimal}, "class": "Resource"}`).pipe(
    Effect.mapError((error) => failure(error.reason))
  );
  return CitationCaseResourceHash.make({ citationHash, resourceHash });
});
