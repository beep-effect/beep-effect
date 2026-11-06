/**
 * Frozen edition adapter for pinned eyecite 2.7.6 immutable model artifacts.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationRuntimeEdition } from "./PublicationResourceHash.ts";
import { snapshotCitationValue } from "./Snapshot.ts";

const $I = $LawPracticeServerId.create("internal/Citation/FrozenEditions");
const Row = S.Struct({ ref: Sha256Hex, payload: S.String.check(S.isMaxLength(1024)) });
const Bundle = S.Struct({
  reporters: S.Array(Row).check(S.isMinLength(2430), S.isMaxLength(2430)),
  editions: S.Array(Row).check(S.isMinLength(2533), S.isMaxLength(2533)),
});
const Manifest = S.fromJsonString(S.Struct({ editions: S.Array(Sha256Hex), reporters: S.Array(Sha256Hex) }));
const expectedManifest = "b6d3fdd9b6fb4e006c3ede86639c46e7579ff03d39091bdd74ca60919dfe648e";
const Reporter = S.Struct({
  pythonType: S.tag("eyecite.models.Reporter"),
  fields: S.Struct({
    short_name: S.String,
    name: S.String,
    cite_type: S.String,
    source: S.Literals(["reporters", "laws", "journals"]),
    is_scotus: S.Boolean,
  }),
});
const ReporterJson = S.fromJsonString(Reporter);

const DateValue = S.NullOr(S.Struct({ datetime: S.String.check(S.isMaxLength(64)) }));
const Edition = S.Struct({
  pythonType: S.tag("eyecite.models.Edition"),
  fields: S.Struct({
    short_name: S.String,
    reporter: S.Struct({ artifactSha256: Sha256Hex }),
    start: DateValue,
    end: DateValue,
  }),
});
const EditionJson = S.fromJsonString(Edition);

const Family = LiteralKit(["case", "law", "journal"]);
const References = S.Array(CitationEditionRef).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates));
const Reason = LiteralKit([
  "invalid-input",
  "manifest-mismatch",
  "corrupt-artifact",
  "missing-edition",
  "kind-mismatch",
  "digest-failed",
]);
/**
 * Closed immutable-artifact validation or lookup failure.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationFrozenEditionFailure extends S.TaggedError<
  CitationFrozenEditionFailure,
  { readonly brand: unique symbol }
>($I`CitationFrozenEditionFailure`)(
  "CitationFrozenEditionFailure",
  { reason: Reason },
  $I.annoteError<CitationFrozenEditionFailure>("CitationFrozenEditionFailure", {
    description: "Frozen edition failure without payloads, references or nested causes.",
  })
) {}
/**
 * Authenticated edition lookup. Every method captures Crypto and has R = never.
 * Lookup preserves occurrence order and duplicates; returned values are copies.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationFrozenEditions extends Context.Service<
  CitationFrozenEditions,
  {
    readonly source: (reference: CitationEditionRef) => Effect.Effect<string, CitationFrozenEditionFailure>;
    readonly lookup: (
      reference: CitationEditionRef,
      family: typeof Family.Type
    ) => Effect.Effect<CitationRuntimeEdition, CitationFrozenEditionFailure>;
    readonly lookupMany: (
      references: ReadonlyArray<CitationEditionRef>,
      family: typeof Family.Type
    ) => Effect.Effect<ReadonlyArray<CitationRuntimeEdition>, CitationFrozenEditionFailure>;
  }
>()($I`CitationFrozenEditions`) {}
const failure = (reason: typeof Reason.Type) => CitationFrozenEditionFailure.make({ reason });
const RuntimeJson = S.fromJsonString(CitationRuntimeEdition);
const encoder = new TextEncoder();
const dateString = (value: typeof DateValue.Type) => (value === null ? null : Str.replace("T", " ")(value.datetime));
/**
 * Validate the complete frozen manifest and every original payload digest before
 * exposing any lookup. The manifest constant binds all 2,430 reporter and 2,533
 * edition identities to the reviewed source corpus; callers cannot replace it.
 * Payloads retain their original canonical bytes, avoiding a second JSON hash
 * protocol. Construction snapshots input before digesting and is interruptible
 * between bounded digest operations. It does not read the filesystem or Python.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationFrozenEditions = Effect.fn("Citation.makeFrozenEditions")(function* (input: unknown) {
  const decoded = yield* S.decodeUnknownEffect(Bundle)(input).pipe(Effect.mapError(() => failure("invalid-input")));
  const rows = {
    reporters: A.map(decoded.reporters, (row) => ({ ...row })),
    editions: A.map(decoded.editions, (row) => ({ ...row })),
  };
  const crypto = yield* Digest.Digest;
  const digest = Effect.fn("Citation.frozenArtifactDigest")((payload: string) =>
    S.decodeEffect(Sha256HexFromBytes)(encoder.encode(payload)).pipe(
      Effect.provideService(Digest.Digest, crypto),
      Effect.mapError(() => failure("digest-failed")),
      Effect.catchDefect(() => Effect.fail(failure("digest-failed")))
    )
  );
  const manifest = yield* S.encodeEffect(Manifest)({
    editions: A.sort(
      A.map(rows.editions, (row) => row.ref),
      Order.String
    ),
    reporters: A.sort(
      A.map(rows.reporters, (row) => row.ref),
      Order.String
    ),
  }).pipe(Effect.mapError(() => failure("invalid-input")));
  if ((yield* digest(manifest)) !== expectedManifest) return yield* failure("manifest-mismatch");
  let reporters = HashMap.empty<Sha256Hex, typeof Reporter.fields.fields.Type>();
  for (const row of rows.reporters) {
    if ((yield* digest(row.payload)) !== row.ref) return yield* failure("corrupt-artifact");
    const value = yield* S.decodeEffect(ReporterJson)(row.payload).pipe(
      Effect.mapError(() => failure("corrupt-artifact"))
    );
    reporters = HashMap.set(reporters, row.ref, value.fields);
  }
  let editions = HashMap.empty<CitationEditionRef, CitationRuntimeEdition>();
  for (const row of rows.editions) {
    if ((yield* digest(row.payload)) !== row.ref) return yield* failure("corrupt-artifact");
    const value = yield* S.decodeEffect(EditionJson)(row.payload).pipe(
      Effect.mapError(() => failure("corrupt-artifact"))
    );
    const reporter = yield* Effect.fromOption(HashMap.get(reporters, value.fields.reporter.artifactSha256), () =>
      failure("corrupt-artifact")
    );
    const edition = CitationRuntimeEdition.make({
      edition: CitationEditionRef.make(row.ref),
      value: {
        short_name: value.fields.short_name,
        start: dateString(value.fields.start),
        end: dateString(value.fields.end),
        reporter,
      },
    });
    editions = HashMap.set(editions, edition.edition, edition);
  }
  const checkedFamily = (family: typeof Family.Type) =>
    S.decodeEffect(Family)(family).pipe(Effect.mapError(() => failure("invalid-input")));
  const lookup = Effect.fn("Citation.frozenEditionLookup")(function* (
    reference: CitationEditionRef,
    family: typeof Family.Type
  ) {
    const ref = yield* S.decodeEffect(CitationEditionRef)(reference).pipe(
      Effect.mapError(() => failure("invalid-input"))
    );
    const kind = yield* checkedFamily(family);
    const edition = yield* Effect.fromOption(HashMap.get(editions, ref), () => failure("missing-edition"));
    const source = edition.value.reporter.source;
    if (
      (kind === "case" && source !== "reporters") ||
      (kind === "law" && source !== "laws") ||
      (kind === "journal" && source !== "journals")
    )
      return yield* failure("kind-mismatch");
    return yield* snapshotCitationValue(RuntimeJson, edition, () => failure("corrupt-artifact"));
  });
  return CitationFrozenEditions.of({
    source: Effect.fn("Citation.frozenEditionSource")(function* (reference: CitationEditionRef) {
      const ref = yield* S.decodeEffect(CitationEditionRef)(reference).pipe(
        Effect.mapError(() => failure("invalid-input"))
      );
      const edition = yield* Effect.fromOption(HashMap.get(editions, ref), () => failure("missing-edition"));
      return edition.value.reporter.source;
    }),
    lookup,
    lookupMany: Effect.fn("Citation.frozenEditionLookupMany")(function* (
      references: ReadonlyArray<CitationEditionRef>,
      family: typeof Family.Type
    ) {
      const refs = yield* S.decodeEffect(References)(references).pipe(Effect.mapError(() => failure("invalid-input")));
      const kind = yield* checkedFamily(family);
      const captured = A.fromIterable(refs);
      return yield* Effect.forEach(captured, (ref) => lookup(ref, kind), { concurrency: 1 });
    }),
  });
});

/** Route a single authenticated reference through its actual source family.
 * @internal @category operations @since 0.0.0
 */
export const readCitationFrozenEdition = Effect.fn("Citation.readFrozenEdition")(function* (
  owner: CitationFrozenEditions["Service"],
  reference: CitationEditionRef
) {
  const source = yield* owner.source(reference);
  const family = Match.value(source).pipe(
    Match.when("reporters", () => Family.Enum.case),
    Match.when("laws", () => Family.Enum.law),
    Match.when("journals", () => Family.Enum.journal),
    Match.orElse(() => null)
  );
  if (family === null) return yield* failure("corrupt-artifact");
  return yield* owner.lookup(reference, family);
});
