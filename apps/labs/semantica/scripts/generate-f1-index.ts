import { $SemanticaId } from "@beep/identity/packages";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Crypto, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  F1Fixture,
  F1FixtureId,
  F1Index,
  FixtureDegradedKind,
  FixtureExpectation,
  FixtureMediaType,
} from "@/fixtures/F1";

const $I = $SemanticaId.create("scripts/generate-f1-index");
const F1_ROOT = "fixtures/f1";

const FixtureSpec = S.Struct({
  id: F1FixtureId,
  relativePath: S.NonEmptyString,
  mediaType: FixtureMediaType,
  expectation: FixtureExpectation,
  degradedKind: S.OptionFromNullOr(FixtureDegradedKind),
  summary: S.NonEmptyString,
}).pipe(
  $I.annoteSchema("FixtureSpec", {
    description: "Generator-owned metadata used to build one content-addressed F1 index row.",
  })
);

type FixtureSpec = typeof FixtureSpec.Type;

const fixtureSpecs: ReadonlyArray<FixtureSpec> = [
  {
    id: F1FixtureId.make("md-structure"),
    relativePath: "documents/md-structure.md",
    mediaType: "text/markdown",
    expectation: "parses",
    degradedKind: O.none(),
    summary: "Structured Markdown paper with headings, lists, a table, a code fence, and references.",
  },
  {
    id: F1FixtureId.make("md-unicode"),
    relativePath: "documents/md-unicode.md",
    mediaType: "text/markdown",
    expectation: "parses",
    degradedKind: O.none(),
    summary: "CRLF Markdown with NFC and NFD text, emoji, RTL content, and a zero-width joiner.",
  },
  {
    id: F1FixtureId.make("md-invalid-utf8"),
    relativePath: "documents/md-invalid-utf8.md",
    mediaType: "text/markdown",
    expectation: "degraded",
    degradedKind: O.some("invalid-utf8"),
    summary: "Valid academic Markdown interrupted by one deliberately invalid UTF-8 byte sequence.",
  },
  {
    id: F1FixtureId.make("html-article"),
    relativePath: "documents/html-article.html",
    mediaType: "text/html",
    expectation: "parses",
    degradedKind: O.none(),
    summary: "Semantic HTML article with headings, paragraphs, affiliations, and a citation.",
  },
  {
    id: F1FixtureId.make("html-entities-tables"),
    relativePath: "documents/html-entities-tables.html",
    mediaType: "text/html",
    expectation: "parses",
    degradedKind: O.none(),
    summary: "HTML entities and nested tables with script and style text that must not leak.",
  },
  {
    id: F1FixtureId.make("html-truncated"),
    relativePath: "documents/html-truncated.html",
    mediaType: "text/html",
    expectation: "degraded",
    degradedKind: O.some("malformed-structure"),
    summary: "Academic HTML cut off inside an attribute after a deliberately bogus charset declaration.",
  },
  {
    id: F1FixtureId.make("pdf-two-column"),
    relativePath: "documents/pdf-two-column.pdf",
    mediaType: "application/pdf",
    expectation: "parses",
    degradedKind: O.none(),
    summary: "Born-digital two-column PDF with a heading and explicit fictional relations.",
  },
  {
    id: F1FixtureId.make("pdf-multipage"),
    relativePath: "documents/pdf-multipage.pdf",
    mediaType: "application/pdf",
    expectation: "parses",
    degradedKind: O.none(),
    summary: "Three-page born-digital PDF with running headers, footers, and a footnote.",
  },
  {
    id: F1FixtureId.make("pdf-truncated"),
    relativePath: "documents/pdf-truncated.pdf",
    mediaType: "application/pdf",
    expectation: "degraded",
    degradedKind: O.some("truncated"),
    summary: "The two-column PDF cut immediately before its explicit xref table.",
  },
];

const F1IndexJson = S.fromJsonString(F1Index, { space: 2 });

const generateF1Index = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fixtures = yield* Effect.forEach(
    fixtureSpecs,
    Effect.fnUntraced(function* (spec) {
      const bytes = yield* fs.readFile(path.join(F1_ROOT, spec.relativePath));
      const sha256 = yield* Sha256HexFromBytes.decodeEffect(bytes).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.orDie
      );
      return F1Fixture.make({
        ...spec,
        sha256,
        bytes: NonNegativeInt.make(bytes.byteLength),
      });
    }),
    { concurrency: 4 }
  );
  if (!A.isReadonlyArrayNonEmpty(fixtures)) {
    return;
  }
  const index = F1Index.make({ schemaVersion: "f1-index/v1", fixtures });
  const json = yield* S.encodeEffect(F1IndexJson)(index).pipe(Effect.orDie);
  yield* fs.writeFileString(path.join(F1_ROOT, "index.json"), `${json}\n`);
});

if (import.meta.main) {
  BunRuntime.runMain(
    Effect.scoped(
      Layer.build(BunServices.layer).pipe(Effect.flatMap((context) => generateF1Index.pipe(Effect.provide(context))))
    )
  );
}
