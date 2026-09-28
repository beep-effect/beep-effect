import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Core from "@beep/repo-docgen/Core";
import * as Domain from "@beep/repo-docgen/Domain";
import * as Printer from "@beep/repo-docgen/Printer";
import * as ProofManifest from "@beep/repo-docgen/ProofManifest";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeConfigurationConfigurationSchemaResult = S.decodeResult(Configuration.ConfigurationSchema);
const encodeUnknownDomainFileResult = S.encodeUnknownResult(Domain.File);
const encodeUnknownDomainPositionResult = S.encodeUnknownResult(Domain.Position);
const encodeUnknownProofManifestDocgenProofManifestFileResult = S.encodeUnknownResult(
  ProofManifest.DocgenProofManifestFile
);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encode = S.encodeUnknownResult(schema);
  const decode = S.decodeUnknownResult(schema);
  expect(S.toEquivalence(schema)(Result.getOrThrow(decode(Result.getOrThrow(encode(value)))), value)).toBe(true);
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

  it.prop(
    "round-trips schema-derived docgen families",
    {
      position: Arbitrary.schema(Domain.Position),
      doc: Arbitrary.schema(Domain.Doc),
      docEntry: Arbitrary.schema(Domain.DocEntry),
      file: Arbitrary.schema(Domain.File),
      configuration: Arbitrary.schema(Configuration.ConfigurationSchema),
      configurationShape: Arbitrary.schema(Configuration.ConfigurationShape),
      manifestFile: Arbitrary.schema(ProofManifest.DocgenProofManifestFile),
      fingerprint: Arbitrary.schema(ProofManifest.DocgenProofManifestFingerprint),
      printable: Arbitrary.schema(Printer.Printable),
    },
    (values) => {
      assertSchemaRoundTrip(Domain.Position, values.position);
      assertSchemaRoundTrip(Domain.Doc, values.doc);
      assertSchemaRoundTrip(Domain.DocEntry, values.docEntry);
      assertSchemaRoundTrip(Domain.File, values.file);
      assertSchemaRoundTrip(Configuration.ConfigurationSchema, values.configuration);
      assertSchemaRoundTrip(Configuration.ConfigurationShape, values.configurationShape);
      assertSchemaRoundTrip(ProofManifest.DocgenProofManifestFile, values.manifestFile);
      assertSchemaRoundTrip(ProofManifest.DocgenProofManifestFingerprint, values.fingerprint);
      assertSchemaRoundTrip(Printer.Printable, values.printable);
    },
    { arbitrary: fcRuns(12) }
  );
});
