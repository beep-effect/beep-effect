/** get_court_by_paren from eyecite 2.7.6 helpers.py, BSD-2-Clause.
 * Frozen courts-db 0.10.22 order; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CourtId,
  findCourtById,
  isCurrentCourtReporterArtifactVersion,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationPythonLower } from "./PythonCase.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { filterCitationPythonStorage, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { citationRegexCellFor } from "./RegexAlphabet.ts";
import { makeCitationRegexPointSets } from "./RegexPointSets.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTextBudget, makeCitationTextBudget } from "./TextBudget.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CourtLookup");
const Reason = LiteralKit(["invalid-policy", "invalid-table", "incompatible-vocabulary"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed court installation failures without source values." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationCourtLookupFailure extends S.TaggedError<
  CitationCourtLookupFailure,
  { readonly brand: unique symbol }
>($I`CitationCourtLookupFailure`)(
  "CitationCourtLookupFailure",
  { reason: Reason },
  $I.annoteError<CitationCourtLookupFailure>("CitationCourtLookupFailure", {
    description: "Court normalization installation failed without retaining source values or causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationCourtLookupFailure.make({ reason });
const Key = S.String.check(S.isMaxLength(256), S.isPattern(/^[a-z0-9_]*$/)).pipe(
  $I.annoteSchema("Key", { description: "Authenticated ASCII key in the pinned ordered court table." })
);
const Payload = S.String.check(S.isBetweenLength(81475, 81475));
const Table = S.fromJsonString(S.Array(S.Tuple([CourtId, Key])).check(S.isBetweenLength(2798, 2798)));
/** Native normalization and vocabulary identity are data, never verified spans.
 * @internal @category models @since 0.0.0
 */
export class CitationCourtLookupResult extends S.Opaque<CitationCourtLookupResult, { readonly brand: unique symbol }>()(
  S.Struct({
    normalized: CitationPythonUnicodeStorage,
    court: S.Option(CourtId),
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationCourtLookupResult", {
      description: "Native filtered/lowercase word, optional known CourtId, and cumulative invocation reservation.",
    })
  )
) {}
const authenticateTable = Effect.fn("Citation.authenticateCourtTable")(function* (input: unknown) {
  const payload = yield* S.decodeUnknownEffect(Payload)(input).pipe(Effect.mapError(() => fail("invalid-table")));
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(payload)).pipe(
    Effect.mapError(() => fail("invalid-table"))
  );
  if (hash !== "22a917e998d65b6e4edf7990ef79dd2f2affa74702c9be1068b7f30f33ce2831") return yield* fail("invalid-table");
  const table = yield* S.decodeEffect(Table)(payload).pipe(Effect.mapError(() => fail("invalid-table")));
  if (!isCurrentCourtReporterArtifactVersion("crv1:f353e51400a5:fad63b383b92"))
    return yield* fail("incompatible-vocabulary");
  if (A.some(table, ([id]) => O.isNone(findCourtById(id)))) return yield* fail("incompatible-vocabulary");
  return table;
});
/** Authenticate the exact frozen court order and capture Clock/optional parent
 * budget once. Each standalone call owns a fresh budget. All methods have R = never.
 * lookupNormalized is a trusted pure composition helper for an already normalized
 * string; raw native words must enter lookup. No host regex or lowercase is used.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCourtLookup = Effect.fn("Citation.makeCourtLookup")(function* (
  policy: unknown,
  payload: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const table = yield* authenticateTable(payload);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const unicode = yield* makeCitationPythonUnicode({ ...limits, cleanDeadline: timing.deadline });
  const lower = yield* makeCitationPythonLower({ ...limits, cleanDeadline: timing.deadline });
  const { word } = yield* makeCitationRegexPointSets("python-regex-v0");
  const starts = [...A.map(word, (row) => row.start), 0x110000];
  const keep = (point: number) => {
    const range = A.getUnsafe(word, citationRegexCellFor(starts, point));
    return range.start <= point && point <= range.end;
  };
  const enclosing = yield* Effect.serviceOption(CitationTextBudget);
  if (O.isSome(enclosing) && enclosing.value.maximum > limits.producedTextUtf16) return yield* fail("invalid-policy");
  const lookupNormalized = (key: string): O.Option<CourtId> => {
    if (Str.isEmpty(key)) return O.none();
    let result = O.none<CourtId>();
    for (const [id, candidate] of table) {
      if (candidate === key) return O.some(id);
      if (Str.startsWith(key)(candidate)) result = O.some(id);
    }
    return result;
  };
  const lookup = Effect.fn("Citation.lookupCourt")(
    function* (raw: unknown) {
      const budget = O.isSome(enclosing) ? enclosing.value : yield* makeCitationTextBudget(limits);
      const source = yield* unicode.fromStorageReserved(raw, (units) =>
        units > limits.sourceUtf16
          ? Effect.fail(CitationSafetyLimitExceeded.make({ operation: "extract", limit: "sourceUtf16" }))
          : budget.reserve(units)
      );
      const filtered = yield* filterCitationPythonStorage(source.storage, keep, (layout) =>
        budget.reserve(layout.utf16Units)
      );
      const lowered = yield* lower.lowerReserved(filtered, budget.reserve);
      const normalized = yield* unicode.fromStorageReserved(lowered, budget.reserve);
      const reservedUnits = yield* budget.snapshot;
      return CitationCourtLookupResult.make({
        normalized: normalized.storage,
        court: lookupNormalized(normalized.text),
        reservedUnits,
      });
    },
    (body) =>
      body.pipe(
        Effect.mapError((failure) =>
          failure._tag === "CitationPythonUnicodeFailure" && failure.reason === "deadline-exceeded"
            ? CitationSafetyLimitExceeded.make({ operation: "extract", limit: timing.deadlineLimit })
            : failure
        ),
        timing.timed
      )
  );
  return { lookup, lookupNormalized };
});
