import {
  lookupSliceFile,
  renderSchemaIdiomHintMessage,
  renderSchemaIdiomHints,
  renderSchemaIndexFiles,
  SchemaGetterEntry,
  SchemaIdiomHint,
  SchemaIdiomsLookupTopic,
  SchemaIndex,
  SchemaIndexCheck,
  SchemaIndexCodec,
  SchemaIndexCombinator,
  shortTypeText,
  sliceOfEntry,
} from "@beep/repo-cli/commands/SchemaIdioms";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as SemVer from "effect/SemVer";
import * as Str from "effect/String";

const codec = (name: string, decoded: string, encoded: string, summary = O.some(`${name} summary.`)) =>
  SchemaIndexCodec.make({ kind: "codec", name, decoded, encoded, summary, category: O.some("schemas") });

const check = (name: string, input: string) =>
  SchemaIndexCheck.make({ kind: "check", name, input, summary: O.some(`${name} summary.`), category: O.none() });

const combinator = (name: string, category: O.Option<string>) =>
  SchemaIndexCombinator.make({ kind: "combinator", name, summary: O.none(), category });

const getter = (name: string, category: O.Option<string>) =>
  SchemaGetterEntry.make({ module: "SchemaGetter", name, summary: O.some(`${name} summary.`), category });

const hint = (line: number, wire: "string" | "number") =>
  SchemaIdiomHint.make({
    line,
    field: `field${line}`,
    schemaIdentifier: line === 1 ? O.some("Named") : O.none(),
    kind: wire === "number" ? "port" : "url",
    readsAs: wire === "number" ? "a port" : "a URL",
    wire,
    shipped: wire === "number" ? ["Port"] : ["URLFromString", "Other"],
  });

describe("schema index rendering", () => {
  it("shortens single-member object types and long type text", () => {
    expect(shortTypeText("{ readonly size: number; }")).toBe("has .size");
    expect(shortTypeText("{ readonly length: number }")).toBe("has .length");
    expect(shortTypeText("Duration.Duration")).toBe("Duration.Duration");
    const long = `ReadonlyArray<${Str.repeat(80)("x")}>`;
    expect(shortTypeText(long)).toBe(`${Str.slice(0, 57)(long)}…`);
  });

  it("places each entry kind in its slice", () => {
    assertSome(sliceOfEntry(codec("NumberFromString", "number", "string")), "wire-string");
    assertSome(sliceOfEntry(codec("DurationFromMillis", "Duration.Duration", "number")), "wire-number");
    assertSome(sliceOfEntry(codec("BigInt", "bigint", "bigint")), "wire-bigint");
    assertSome(sliceOfEntry(codec("Date", "Date", "Date")), "wire-date");
    assertSome(sliceOfEntry(codec("Uint8Array", "Uint8Array", "Uint8Array")), "wire-other");
    assertSome(sliceOfEntry(check("isMinLength", "string")), "wire-string");
    assertSome(sliceOfEntry(check("isMinSize", "{ readonly size: number; }")), "checks-collections");
    assertSome(sliceOfEntry(combinator("Struct", O.some("constructors"))), "takes-a-schema");
    assertSome(sliceOfEntry(combinator("brand", O.none())), "takes-a-schema");
    assertNone(sliceOfEntry(combinator("decodeUnknownSync", O.some("decoding"))));
  });

  it("renders the slices and the README in a fixed order", () => {
    const files = renderSchemaIndexFiles(
      SchemaIndex.make({
        effectVersion: SemVer.make({ major: 4, minor: 1, patch: 5 }),
        entries: [
          combinator("Struct", O.some("constructors")),
          check("isMinSize", "{ readonly size: number; }"),
          check("isMinLength", "string"),
          codec("Uint8Array", "Uint8Array", "Uint8Array", O.none()),
          codec("NumberFromString", "number", "string"),
          codec("String", "string", "string"),
          combinator("decodeUnknownSync", O.some("decoding")),
        ],
        getters: [getter("trim", O.some("transforming")), getter("Model", O.some("models"))],
      })
    );
    expect(A.map(files, (file) => [file.file, file.entries])).toEqual([
      ["wire-string.md", 3],
      ["wire-number.md", 0],
      ["wire-bigint.md", 0],
      ["wire-date.md", 0],
      ["wire-other.md", 1],
      ["checks-collections.md", 1],
      ["takes-a-schema.md", 1],
      ["getters.md", 1],
      ["README.md", 0],
    ]);
    const content = (file: string) => O.getOrThrow(A.findFirst(files, (entry) => entry.file === file)).content;
    expect(content("wire-string.md")).toBe(
      A.join(
        [
          "# effect/Schema index: string on the wire",
          "",
          "Generated from effect 4.1.5 by `bun run beep schema-idioms index --write`. Do not edit by hand.",
          "",
          "- S.NumberFromString → number: NumberFromString summary.",
          "- S.String: String summary.",
          "- S.isMinLength (check): isMinLength summary.",
          "",
        ],
        "\n"
      )
    );
    expect(content("wire-other.md")).toContain("- S.Uint8Array (wire Uint8Array)\n");
    expect(content("checks-collections.md")).toContain("- S.isMinSize (check on has .size): isMinSize summary.\n");
    expect(content("takes-a-schema.md")).toContain("- S.Struct\n");
    expect(content("getters.md")).toContain("- SchemaGetter.trim: trim summary.\n");
    expect(content("getters.md")).not.toContain("Model");
    expect(content("README.md")).toContain(
      "| [wire-string.md](wire-string.md) | 3 | Schemas that read a string, and checks on strings. |"
    );
  });

  it("maps every lookup topic to a slice file", () => {
    expect(A.map(SchemaIdiomsLookupTopic.literals, lookupSliceFile)).toEqual([
      "wire-string.md",
      "wire-number.md",
      "wire-bigint.md",
      "wire-date.md",
      "wire-other.md",
      "checks-collections.md",
      "takes-a-schema.md",
      "getters.md",
    ]);
  });
});

describe("schema idiom hint rendering", () => {
  it("renders no message without hints", () => {
    assertNone(renderSchemaIdiomHints([]));
  });

  it("renders hint lines and the lookup commands for each wire", () => {
    assertSome(
      renderSchemaIdiomHints([hint(1, "number"), hint(2, "string")]),
      A.join(
        [
          "[schema-idiom] Advisory: effect/Schema may already ship these. Skip any line that does not fit the domain.",
          "L1 field1 (Named): the name reads as a port but the schema decodes to a primitive. Shipped: S.Port",
          "L2 field2: the name reads as a URL but the schema decodes to a primitive. Shipped: S.URLFromString · S.Other",
          "More by wire type: bun run beep schema-idioms lookup number · bun run beep schema-idioms lookup string",
        ],
        "\n"
      )
    );
  });

  it("caps the listed hints and counts the rest", () => {
    const message = renderSchemaIdiomHintMessage([
      hint(1, "number"),
      ...A.map(A.range(2, 10), (line) => hint(line, "number")),
    ]);
    expect(A.length(Str.split(message, "\n"))).toBe(11);
    expect(message).toContain("\nL8 field8:");
    expect(message).not.toContain("\nL9 field9:");
    expect(message).toContain("\nand 2 more\nMore by wire type: bun run beep schema-idioms lookup number");
  });
});
