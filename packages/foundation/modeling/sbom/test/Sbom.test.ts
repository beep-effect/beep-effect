import { identity } from "effect/Function";
// The emitter: an owned CycloneDX 1.6 model and its canonical JSON.
//
// `generate` and `toJson` are TOTAL — no error channel — which is a deliberate
// correction of the package this replaces, where both were typed
// `Effect<_, SbomError>` with `reason: "build" | "serialize"`. Those failures
// could only happen because the CycloneDX library might throw; with an owned
// model over already-validated Schema values, neither can fail.

import { Component, Contact, Sbom, SbomInput, SbomJsonOptions, SbomMetadata, Supplier } from "@beep/sbom";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const UnknownJson = S.fromJsonString(S.Unknown);

const ComponentDocument = S.Struct({
  metadata: S.Struct({ component: S.Record(S.String, S.Unknown) }),
});

const MetadataDocument = S.Struct({
  metadata: S.Struct({
    supplier: S.Struct({ name: S.String }),
    authors: S.Array(S.Struct({ name: S.String })),
    timestamp: S.String,
  }),
});

const root = Component.make({
  type: "library",
  name: "@effected/sbom",
  version: "0.1.0",
  purl: "pkg:npm/%40effected%2Fsbom@0.1.0",
  bomRef: "@effected/sbom@0.1.0",
});

const dep = (name: string, version: string) =>
  Component.make({
    type: "library",
    name,
    version,
    purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
    bomRef: `${name}@${version}`,
  });

describe("Sbom.generate", () => {
  it("takes admitted components, so validation stays with the caller's make and generate cannot throw", () => {
    // The empty bom-ref is rejected where the component is built (CycloneDX
    // `refType` has minLength 1), never inside `generate`.
    assert.throws(() => Component.make({ type: "application", name: "x", bomRef: "" }));
    // A plain record is not an admitted component, so it does not type-check.
    const unadmitted: Parameters<typeof Sbom.generate>[0] = {
      // @ts-expect-error: `root` must be a `Component`, not its encoded shape.
      root: { type: "application", name: "x" },
      components: [],
    };
    assert.strictEqual(unadmitted.components.length, 0);
    const admitted = Component.make({ type: "application", name: "x", bomRef: "x" });
    assert.strictEqual(Sbom.generate({ root: admitted, components: [admitted] }).components.length, 1);
  });

  it("is a plain function — no Effect, no error channel", () => {
    // If this ever needs `yield*`, the pure-tier claim has been lost.
    const document = Sbom.generate({ root, components: [] });
    assert.strictEqual(document.bomFormat, "CycloneDX");
    assert.strictEqual(document.specVersion, "1.6");
  });

  it("carries the root component as metadata.component", () => {
    const document = Sbom.generate({ root, components: [] });
    assert.strictEqual(document.metadata?.component?.name, "@effected/sbom");
  });

  it("sorts components by name for a stable document", () => {
    // Two runs over the same inputs must produce the same bytes, or an SBOM
    // digest changes for no reason and an attestation subject drifts with it.
    const document = Sbom.generate({ root, components: [dep("zulu", "1.0.0"), dep("alpha", "2.0.0")] });
    assert.deepStrictEqual(
      A.map(document.components, (c) => c.name),
      ["alpha", "zulu"]
    );
  });

  it("sorts by code unit, not by locale collation", () => {
    // A locale collation puts "a" before "B" and "é" beside "e"; code-unit
    // order is the same on every host, whatever its locale or ICU data.
    const document = Sbom.generate({
      root,
      components: [dep("a", "1.0.0"), dep("é", "1.0.0"), dep("f", "1.0.0"), dep("B", "1.0.0")],
    });
    assert.deepStrictEqual(
      A.map(document.components, (c) => c.name),
      ["B", "a", "f", "é"]
    );
  });

  it("is deterministic across calls", () => {
    const once = Sbom.toJson(Sbom.generate({ root, components: [dep("a", "1.0.0")] }));
    const twice = Sbom.toJson(Sbom.generate({ root, components: [dep("a", "1.0.0")] }));
    assert.strictEqual(once, twice);
  });
});

describe("Sbom.toJson", () => {
  it("emits the hyphenated `bom-ref` key, not `bomRef`", () => {
    // The one field whose JSON name differs from its TypeScript name. Emitting
    // `bomRef` produces a document that looks right and validates wrong.
    const json: unknown = Result.getOrThrowWith(
      S.decodeResult(UnknownJson)(Sbom.toJson(Sbom.generate({ root, components: [] }))),
      identity
    );
    assertTrue(S.is(ComponentDocument)(json));
    assert.property(json.metadata.component, "bom-ref");
    assert.notProperty(json.metadata.component, "bomRef");
  });

  it("omits absent optional fields rather than emitting null", () => {
    const bare = Component.make({ type: "library", name: "bare" });
    const json: unknown = Result.getOrThrowWith(
      S.decodeResult(UnknownJson)(Sbom.toJson(Sbom.generate({ root: bare, components: [] }))),
      identity
    );
    assertTrue(S.is(ComponentDocument)(json));
    assert.notProperty(json.metadata.component, "version");
    assert.notProperty(json.metadata.component, "purl");
    assert.notProperty(json.metadata.component, "description");
  });

  it("renders licenses in CycloneDX's wrapper shape", () => {
    // `licenses` is an array of single-key wrapper objects, not bare strings.
    const licensed = Component.make({ type: "library", name: "x", licenses: ["MIT"] });
    const json: unknown = Result.getOrThrowWith(
      S.decodeResult(UnknownJson)(Sbom.toJson(Sbom.generate({ root: licensed, components: [] }))),
      identity
    );
    assertTrue(S.is(ComponentDocument)(json));
    assert.deepStrictEqual<unknown>(json.metadata.component.licenses, [{ license: { id: "MIT" } }]);
  });

  it("carries supplier and authors onto metadata", () => {
    const document = Sbom.generate({
      root,
      components: [],
      metadata: SbomMetadata.make({
        timestamp: "2026-07-25T00:00:00.000Z",
        supplier: Supplier.make({ name: "Acme", url: ["https://acme.example"] }),
        authors: [Contact.make({ name: "Dee", email: "dee@example.com" })],
      }),
    });
    const json: unknown = Result.getOrThrowWith(S.decodeResult(UnknownJson)(Sbom.toJson(document)), identity);
    assertTrue(S.is(MetadataDocument)(json));
    assert.strictEqual(json.metadata.supplier.name, "Acme");
    assert.strictEqual(json.metadata.authors[0]?.name, "Dee");
    assert.strictEqual(json.metadata.timestamp, "2026-07-25T00:00:00.000Z");
  });

  it("honours an explicit indent", () => {
    const dense = Sbom.toJson(Sbom.generate({ root, components: [] }), { space: 0 });
    assert.isFalse(Str.includes("\n")(dense));
  });

  it("rejects an explicit undefined metadata or indent (EF-40 exact optional keys)", () => {
    // `metadata` and `space` are exact optional keys: a caller with no value
    // omits the key. A present key holding `undefined` fails validation...
    assert.isFalse(S.is(SbomInput)({ root, components: [], metadata: undefined }));
    assert.isFalse(S.is(SbomJsonOptions)({ space: undefined }));
    assert.isTrue(S.is(SbomJsonOptions)({}));
    // ...and does not type-check under exactOptionalPropertyTypes.
    const input: { metadata: SbomMetadata | undefined; space: number | undefined } = {
      metadata: undefined,
      space: undefined,
    };
    // @ts-expect-error: `metadata` is an exact optional key; `undefined` is not a value for it.
    const generateInput: Parameters<typeof Sbom.generate>[0] = { root, components: [], metadata: input.metadata };
    // @ts-expect-error: `space` is an exact optional key; `undefined` is not a value for it.
    const jsonOptions: SbomJsonOptions.Encoded = { space: input.space };
    assert.isDefined(generateInput);
    assert.isDefined(jsonOptions);
  });
});
