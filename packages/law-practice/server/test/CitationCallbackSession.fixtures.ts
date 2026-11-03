/**
 * Shared callback test witnesses and deliberately finite resource adapters.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { fileURLToPath } from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation } from "@beep/law-practice-domain/values";
import { CitationCallbackResource } from "@beep/law-practice-server/internal/Citation/CallbackSession";
import { CitationResourceIdentity } from "@beep/law-practice-server/internal/Citation/ResourceIdentity";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationResolutionContext, prepareCitationResolutionContext as prepare } from "./CitationResolve.fixtures.ts";
import type * as Digest from "effect/crypto/Digest";

const CorpusJson = S.fromJsonString(S.Struct({ cases: S.Array(CitationResolutionContext) }));

const $I = $LawPracticeServerId.create("test/CitationCallbackSession.fixtures");
/**
 * Shared test-only callback observation input and captured source outcome.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export class CitationCallbackObservation extends S.Opaque<
  CitationCallbackObservation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    name: S.NonEmptyString,
    kinds: S.Array(S.Literals(["case", "law", "journal", "short", "supra", "reference", "id", "unknown"])),
    pages: S.Record(S.String, S.Natural),
    bindings: S.Record(S.String, S.Json),
    events: S.Array(S.Json),
    outcome: S.Union([
      S.Struct({
        status: S.tag("value"),
        groups: S.Array(S.Struct({ resource: S.Json, members: S.Array(S.Natural) })),
      }),
      S.Struct({ status: S.tag("error"), kind: S.String }),
    ]).pipe(S.toTaggedUnion("status")),
  }).pipe(
    $I.annoteSchema("CitationCallbackObservation", {
      description: "Test-only source callback context; original-source extraction proof remains separate.",
    })
  )
) {}
const Json = S.fromJsonString(S.Json);
const scope = Sha256Hex.make(Str.repeat(64)("a"));
/**
 * Construct the fixture adapter's None result.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const callbackNoneResource = () => CitationCallbackResource.cases.None.make({});
/**
 * Project the fixture resource presentation independently of equality.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const callbackResourcePresentation = (resource: CitationCallbackResource): S.Json =>
  resource._tag === "None" ? { kind: "NoneType", value: null } : resource.value;
// Focused fixture adapter, not a production Python hashable implementation.
/**
 * Normalize only the finite primitive values used in these source fixtures.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const normalizeCallbackFixtureResource = Effect.fn("CallbackTest.resource")(function* (
  raw: S.Json
): Effect.fn.Return<CitationCallbackResource, S.SchemaError, Digest.Digest> {
  if (raw === null) return callbackNoneResource();
  if (A.isArray(raw) && A.length(raw) > 0)
    return CitationCallbackResource.cases.Unhashable.make({ truthy: true, value: { kind: "list", value: raw } });
  let token: S.Json;
  let value: S.Json;
  let truthy: boolean;
  if (P.isBoolean(raw)) {
    token = ["numeric", raw ? 1 : 0];
    value = { kind: "bool", value: raw };
    truthy = raw;
  } else if (P.isNumber(raw)) {
    token = ["numeric", raw];
    value = { kind: "int", value: raw };
    truthy = raw !== 0;
  } else if (P.isString(raw)) {
    token = ["str", raw];
    value = { kind: "str", value: raw };
    truthy = Str.isNonEmpty(raw);
  } else {
    token = ["tuple", []];
    value = { kind: "tuple", value: [] };
    truthy = false;
  }
  const key = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(yield* S.encodeEffect(Json)(token)));
  return CitationCallbackResource.cases.Hashable.make({
    identity: CitationResourceIdentity.cases.External.make({ scope, key }),
    truthy,
    value,
  });
});
const templates = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/default-resolution-cases.json", import.meta.url))
  );
  const data = yield* S.decodeEffect(CorpusJson)(raw);
  return HashMap.fromIterable(
    A.flatMap(data.cases, (row) =>
      A.map(row.mentions, (mention) => Tuple.make(mention.citation.type, mention.citation))
    )
  );
});
const kinds = {
  case: "case",
  law: "law",
  journal: "journal",
  short: "shortFormCase",
  supra: "supra",
  reference: "reference",
  id: "id",
  unknown: "unknown",
} satisfies Record<string, Citation["type"]>;
/**
 * Construct genuine source/anchor witnesses around a semantic callback scene.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const prepareCallbackObservation = Effect.fn("CallbackTest.context")(function* (
  row: CitationCallbackObservation
) {
  const models = yield* templates;
  let text = "";
  let mentions = A.empty<CitationResolutionContext["mentions"][number]>();
  for (const [index, kind] of A.map(row.kinds, (kind, index) => Tuple.make(index, kind))) {
    const tag = yield* Effect.fromOption(R.get(kinds, kind));
    const template = yield* Effect.fromOption(HashMap.get(models, tag));
    const wire = yield* S.encodeEffect(Citation)(template);
    const indexKey = yield* S.encodeEffect(S.FiniteFromString)(index);
    const page = yield* S.encodeEffect(S.FiniteFromString)(O.getOrElse(R.get(row.pages, indexKey), () => 1));
    let metadata: S.JsonObject = wire.metadata;
    if (wire.type === "case") metadata = { ...metadata, plaintiff: "Smith", defendant: null };
    if (wire.type === "supra" || wire.type === "shortFormCase") metadata = { ...metadata, antecedentGuess: "Smith" };
    if (wire.type === "id") metadata = { ...metadata, pinCite: "2" };
    const publication =
      "publication" in wire ? { ...wire.publication, editions: [], selectedEdition: null } : undefined;
    const citation = yield* S.decodeUnknownEffect(Citation)({
      ...wire,
      components: { volume: "1", reporter: "U.S.", page },
      metadata,
      ...(publication === undefined ? {} : { publication }),
    });
    const quote = `witness-${index}`;
    const start = Str.length(text);
    text += `${quote}; `;
    mentions = A.append(mentions, { citation, start, end: start + Str.length(quote), quote });
  }
  return yield* prepare(
    CitationResolutionContext.make({
      name: row.name,
      text,
      editions: [],
      mentions,
      outcome: { status: "value", groups: [] },
    })
  );
});
