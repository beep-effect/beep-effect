import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Core from "@beep/repo-docgen/Core";
import * as Domain from "@beep/repo-docgen/Domain";
import * as Printer from "@beep/repo-docgen/Printer";
import * as ProofManifest from "@beep/repo-docgen/ProofManifest";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeConfigurationConfigurationSchemaResult = S.decodeResult(Configuration.ConfigurationSchema);
const encodeUnknownDomainFileResult = S.encodeUnknownResult(Domain.File);
const encodeUnknownDomainPositionResult = S.encodeUnknownResult(Domain.Position);
const encodeUnknownProofManifestDocgenProofManifestFileResult = S.encodeUnknownResult(
  ProofManifest.DocgenProofManifestFile
);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, runs = 12): void => {
  const arbitrary = Arbitrary.schema(schema);
  const encode = S.encodeUnknownResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.all([arbitrary]),
        ([value]) => equivalent(Result.getOrThrow(decode(Result.getOrThrow(encode(value)))), value),
        { runs }
      )
    )._tag
  ).toBe("Passed");
};

describe("schema parity", () => {
  it("preserves encoded domain wire shapes for branded/defaulted fields", () => {
    const position = Domain.Position.new(8, 4);
    expect(Result.getOrThrow(encodeUnknownDomainPositionResult(position))).toEqual({
      column: 4,
      line: 8,
    });

    expect(Result.getOrThrow(encodeUnknownDomainFileResult(Domain.File.new("docs/index.md", "# Docs", {})))).toEqual({
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

    expect(Result.getOrThrow(encodeUnknownProofManifestDocgenProofManifestFileResult(file))).toEqual({
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
    expect(Result.getOrThrow(decodeConfigurationConfigurationSchemaResult({}))).toMatchObject({
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
