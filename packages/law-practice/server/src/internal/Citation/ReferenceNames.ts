/** Original reference-name validation from eyecite 2.7.6 utils.py (BSD-2-Clause).
 * Frozen Python character/lowercase services own Unicode behavior.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { makeCitationPythonLower } from "./PythonCase.ts";
import { makeCitationPythonCharacters } from "./PythonCharacters.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import type { CitationCaseMetadataFields } from "./CaseMetadata.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ReferenceNames");
const Field = LiteralKit(["plaintiff", "defendant", "resolved_case_name_short", "resolved_case_name"]).pipe(
  $I.annoteSchema("Field", { description: "Exact original ReferenceCitation.name_fields order and capture names." })
);
const Names = S.Array(S.String.check(S.isBetweenLength(1, 64)))
  .check(S.isBetweenLength(93, 93))
  .pipe(
    $I.annoteSchema("Names", {
      description: "Exact pinned original disallowed-name data; authenticated before installation.",
    })
  );
const NamesJson = S.fromJsonString(Names).pipe(
  $I.annoteSchema("NamesJson", { description: "Canonical compact JSON for the original ordered name-list digest." })
);
const Reason = LiteralKit(["invalid-policy", "invalid-configuration"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed reference-name installation failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationReferenceNamesFailure extends S.TaggedError<
  CitationReferenceNamesFailure,
  { readonly brand: unique symbol }
>($I`CitationReferenceNamesFailure`)(
  "CitationReferenceNamesFailure",
  { reason: Reason },
  $I.annoteError<CitationReferenceNamesFailure>("CitationReferenceNamesFailure", {
    description: "Name validation installation failed without names, list data or nested causes.",
  })
) {}
/** One validated native name, retaining original metadata-field and candidate order.
 * @internal @category models @since 0.0.0
 */
export class CitationReferenceName extends S.Opaque<CitationReferenceName, { readonly brand: unique symbol }>()(
  S.Struct({ field: Field, value: CitationPythonUnicodeStorage }).pipe(
    $I.annoteSchema("CitationReferenceName", {
      description: "Internal validated source-native name before literal pattern construction.",
    })
  )
) {}
const fail = (reason: typeof Reason.Type) => CitationReferenceNamesFailure.make({ reason });
const digits = HashSet.fromIterable(citationPythonTextData.digits);
const onlyDigits = Effect.fn("Citation.referenceNameIsDigit")(function* (source: CitationPythonUnicodeValue) {
  for (let index = 0; index < source.pythonLength; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    if (!HashSet.has(digits, String.fromCodePoint(citationPythonPointAt(source.storage, index)))) return false;
  }
  return source.pythonLength > 0;
});
/** Capture source-authenticated name data and existing Python primitives.
 * Invoke inside the enclosing extraction operation so native copies/lowercase
 * output consume its captured text authority. Methods require R=never; this
 * prepares names and does not grant regex execution or public citation identity.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationReferenceNames = Effect.fn("Citation.makeReferenceNames")(function* (
  policy: unknown,
  namesInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const names = yield* S.decodeUnknownEffect(Names)(namesInput).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const encoded = yield* S.encodeEffect(NamesJson)(names).pipe(Effect.mapError(() => fail("invalid-configuration")));
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(encoded)).pipe(
    Effect.mapError(() => fail("invalid-configuration")),
    Effect.catchDefect(() => Effect.fail(fail("invalid-configuration")))
  );
  if (digest !== "4a6957a33e8862f93f0c45d8a73a27548205b7363ae8524781bbe89a887165c9")
    return yield* fail("invalid-configuration");
  const disallowed = HashSet.fromIterable(names);
  const characters = yield* makeCitationPythonCharacters();
  const lower = yield* makeCitationPythonLower(limits);
  const input = yield* makeCitationRegexInput(limits, "source");
  const budget = yield* CitationTextBudget;
  if (budget.maximum > limits.producedTextUtf16) return yield* fail("invalid-policy");
  const reserve = budget.reserve;
  const timing = yield* makeCitationRegexTiming(limits, true);
  const isValid = Effect.fn("Citation.isValidReferenceName")(function* (source: CitationPythonUnicodeValue | null) {
    if (source === null || source.pythonLength <= 2) return false;
    if (!characters.upper(citationPythonPointAt(source.storage, 0))) return false;
    if (citationPythonPointAt(source.storage, source.pythonLength - 1) === 46) return false;
    if (yield* onlyDigits(source)) return false;
    const lowered = yield* lower.lowerReserved(source.storage, reserve);
    const prepared = yield* input.prepareUnicode(lowered, () => Effect.void);
    // The sealed list contains no surrogate or non-BMP characters, so native
    // projection ambiguity cannot alias an entry. Lowercase remains Python-native.
    return !HashSet.has(disallowed, prepared.value.text);
  }, timing.timed);
  const collect = Effect.fn("Citation.collectReferenceNames")(function* (metadata: CitationCaseMetadataFields) {
    const candidates = [
      Tuple.make(Field.Enum.plaintiff, metadata.plaintiff),
      Tuple.make(Field.Enum.defendant, metadata.defendant),
      Tuple.make(Field.Enum.resolved_case_name_short, metadata.resolvedCaseNameShort),
      Tuple.make(Field.Enum.resolved_case_name, metadata.resolvedCaseName),
    ];
    const result = A.empty<CitationReferenceName>();
    for (const [field, value] of candidates) {
      if (value === null) continue;
      const source = yield* input.prepareUnicode(value, () => Effect.void);
      if (yield* isValid(source.value)) result.push(CitationReferenceName.make({ field, value: source.value.storage }));
    }
    return result;
  }, timing.timed);
  return { isValid, collect };
});
