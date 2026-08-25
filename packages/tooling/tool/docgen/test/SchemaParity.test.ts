import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Core from "@beep/repo-docgen/Core";
import * as Domain from "@beep/repo-docgen/Domain";
import * as Printer from "@beep/repo-docgen/Printer";
import * as ProofManifest from "@beep/repo-docgen/ProofManifest";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, numRuns = 12): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const encode = S.encodeUnknownResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => equivalent(Result.getOrThrow(decode(Result.getOrThrow(encode(value)))), value)),
    { numRuns }
  );
};

describe("schema parity", () => {
  it("preserves encoded domain wire shapes for branded/defaulted fields", () => {
    const position = Domain.Position.new(8, 4);
    expect(Result.getOrThrow(S.encodeUnknownResult(Domain.Position)(position))).toEqual({
      column: 4,
      line: 8,
    });

    expect(
      Result.getOrThrow(S.encodeUnknownResult(Domain.File)(Domain.File.new("docs/index.md", "# Docs", {})))
    ).toEqual({
      content: "# Docs",
      isOverwritable: false,
      path: "docs/index.md",
    });
  });

  it("preserves encoded proof-manifest wire shapes for branded digest and count fields", () => {
    const file = ProofManifest.DocgenProofManifestFile.make({
      path: "src/index.ts",
      sha256: Sha256Hex.make("0".repeat(64)),
      bytes: NonNegativeInt.make(128),
    });

    expect(Result.getOrThrow(S.encodeUnknownResult(ProofManifest.DocgenProofManifestFile)(file))).toEqual({
      path: "src/index.ts",
      sha256: "0".repeat(64),
      bytes: 128,
    });
  });

  it("keeps extracted fenced-code block output shape stable", () => {
    const [examples] = Core.extractFencedCodeBlocks("```tsx\nconst view = <div />\n```");

    expect(examples).toEqual([
      {
        code: "const view = <div />",
        extension: ".tsx",
      },
    ]);
  });

  it("applies docgen.json constant defaults at the schema boundary", () => {
    expect(Result.getOrThrow(S.decodeResult(Configuration.ConfigurationSchema)({}))).toMatchObject({
      enableSearch: true,
      enforceDescriptions: false,
      enforceExamples: false,
      enforceVersion: true,
      exclude: [],
      include: [],
      outDir: "docs",
      srcDir: "src",
      theme: Configuration.DEFAULT_THEME,
      tscExecutable: "tsc",
    });
  });

  it("round-trips schema-derived docgen families", () => {
    assertSchemaRoundTrip(Domain.Position);
    assertSchemaRoundTrip(Domain.Doc);
    assertSchemaRoundTrip(Domain.DocEntry);
    assertSchemaRoundTrip(Domain.File);
    assertSchemaRoundTrip(Configuration.ConfigurationSchema);
    assertSchemaRoundTrip(Configuration.ConfigurationShape);
    assertSchemaRoundTrip(ProofManifest.DocgenProofManifestFile);
    assertSchemaRoundTrip(ProofManifest.DocgenProofManifestFingerprint);
    assertSchemaRoundTrip(Printer.Printable, 4);
  });
});
