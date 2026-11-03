// Derivation from a package.json manifest.
//
// Half of the hand-rolled predecessor is DEAD here rather than ported:
// `parseAuthor` is `Person.FromValue`, and `parseRepository`'s four-substitution
// git-URL normalization is `Repository.browseUrl` — both in
// `@beep/package-json`, both with wire fidelity the hand-roll lacked. What
// remains is the part that is genuinely CycloneDX vocabulary: which manifest
// field becomes which external-reference type, how a supplier resolves, and
// what a purl looks like.
//
// The purl expectations are the package-url spec's own test vectors
// (`tests/types/npm-test.json`): a scoped package is `pkg:npm/%40angular/animation@12.3.1`
// — the scope is the NAMESPACE with its `@` percent-encoded and the separating
// slash kept literal. The predecessor emitted `encodeURIComponent(name)`, which
// collapses that slash to `%2F` and is not a canonical purl.

import { Package } from "@beep/package-json/Package";
import {
  ComponentInput,
  Contact,
  CopyrightYears,
  SbomMetadata,
  SbomMetadataOptions,
  SbomMetadataSource,
  Supplier,
} from "@beep/sbom";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ExternalReference } from "@beep/sbom";

/** The first external reference of one type, or `undefined`. */
const referenceOf = (
  references: ReadonlyArray<ExternalReference>,
  type: ExternalReference["type"]
): ExternalReference | undefined => O.getOrUndefined(A.findFirst(references, (reference) => reference.type === type));

const manifest = {
  name: "@effected/sbom",
  version: "0.1.0",
  description: "supply-chain artifacts",
  license: "MIT",
  author: "Dee <dee@example.com> (https://dee.example)",
  maintainers: ["Ray <ray@example.com>", { name: "Vee", email: "vee@example.com" }],
  keywords: ["sbom", "cyclonedx"],
  repository: { type: "git", url: "git+https://github.com/effected/kit.git", directory: "packages/sbom" },
  bugs: { url: "https://github.com/effected/kit/issues" },
  homepage: "https://effected.dev",
};

const decode = (value: Record<string, unknown> = manifest) => Package.decode(value);

describe("SbomMetadataSource.npmPurl", () => {
  it("encodes an unscoped package as the spec's canonical form", () => {
    assert.strictEqual(SbomMetadataSource.npmPurl("foobar", "12.3.1"), "pkg:npm/foobar@12.3.1");
  });

  it("keeps the scope a namespace: %40scope/name, not %40scope%2Fname", () => {
    // The package-url spec's own roundtrip vector. `encodeURIComponent(name)`
    // — what the predecessor did — produces `pkg:npm/%40angular%2Fanimation`,
    // which parses as a namespace-less name and is not canonical.
    assert.strictEqual(
      SbomMetadataSource.npmPurl("@angular/animation", "12.3.1"),
      "pkg:npm/%40angular/animation@12.3.1"
    );
  });

  it("omits the version segment when there is no version", () => {
    assert.strictEqual(SbomMetadataSource.npmPurl("foobar"), "pkg:npm/foobar");
  });
});

describe("SbomMetadataSource.componentFor", () => {
  it("derives purl and bom-ref from name and version", () => {
    const component = SbomMetadataSource.componentFor({ name: "lodash", version: "4.17.21" });
    assert.strictEqual(component.type, "library");
    assert.strictEqual(component.purl, "pkg:npm/lodash@4.17.21");
    assert.strictEqual(component.bomRef, "lodash@4.17.21");
  });

  it("carries license and description when supplied, and omits them when not", () => {
    const rich = SbomMetadataSource.componentFor({
      name: "left-pad",
      version: "1.0.0",
      license: "WTFPL",
      description: "pads",
    });
    assert.deepStrictEqual(rich.licenses, ["WTFPL"]);
    assert.strictEqual(rich.description, "pads");

    const bare = SbomMetadataSource.componentFor({ name: "left-pad", version: "1.0.0" });
    assert.strictEqual(bare.licenses, undefined);
    assert.strictEqual(bare.description, undefined);
  });

  it("omits the bom-ref of a nameless, unversioned input instead of failing its admission", () => {
    const nameless = SbomMetadataSource.componentFor({ name: "" });
    assert.strictEqual(nameless.bomRef, undefined);
    assert.strictEqual(nameless.purl, "pkg:npm/");
    assert.strictEqual(SbomMetadataSource.componentFor({ name: "", version: "1.0.0" }).bomRef, "@1.0.0");
  });

  it("honours an explicit component type", () => {
    assert.strictEqual(SbomMetadataSource.componentFor({ name: "app", type: "application" }).type, "application");
  });

  it("rejects explicit undefined optional fields (EF-40 exact optional keys)", () => {
    // The #664 widening is retired: `ComponentInput`'s optional fields are
    // exact keys, so a caller with no version omits the key. A present key
    // holding `undefined` fails validation...
    assert.isFalse(S.is(ComponentInput)({ name: "left-pad", version: undefined }));
    assert.isFalse(S.is(ComponentInput)({ name: "left-pad", license: undefined }));
    assert.isFalse(S.is(ComponentInput)({ name: "left-pad", description: undefined }));
    assert.isFalse(S.is(ComponentInput)({ name: "left-pad", type: undefined }));
    assert.isTrue(S.is(ComponentInput)({ name: "left-pad" }));
    // ...and does not type-check: this file is compiled with
    // exactOptionalPropertyTypes: true.
    const pkg: { name: string; version: string | undefined } = { name: "left-pad", version: undefined };
    // @ts-expect-error: `version` is an exact optional key; `undefined` is not a value for it.
    const input: ComponentInput.Encoded = pkg;
    assert.isDefined(input);
  });
});

describe("SbomMetadataSource.rootComponent", () => {
  it.effect("maps the manifest's identity fields", () =>
    Effect.gen(function* () {
      const decoded = yield* decode();
      const component = SbomMetadataSource.rootComponent(decoded);
      assert.strictEqual(component.name, "@effected/sbom");
      assert.strictEqual(component.version, "0.1.0");
      assert.strictEqual(component.description, "supply-chain artifacts");
      assert.strictEqual(component.purl, "pkg:npm/%40effected/sbom@0.1.0");
      assert.strictEqual(component.bomRef, "@effected/sbom@0.1.0");
      assert.deepStrictEqual(component.licenses, ["MIT"]);
    })
  );

  it.effect("maps keywords onto CycloneDX 1.6 tags", () =>
    Effect.gen(function* () {
      // `tags` is 1.6-only, which is part of what the 1.6-only ruling bought.
      const decoded1 = yield* decode();
      assert.deepStrictEqual(SbomMetadataSource.rootComponent(decoded1).tags, ["sbom", "cyclonedx"]);
    })
  );

  it.effect("maps maintainers onto component authors", () =>
    Effect.gen(function* () {
      const decoded2 = yield* decode();
      const authors = SbomMetadataSource.rootComponent(decoded2).authors ?? [];
      assert.deepStrictEqual(
        A.map(authors, (author) => author.name),
        ["Ray", "Vee"]
      );
      assert.strictEqual(authors[0]?.email, "ray@example.com");
    })
  );

  it.effect("falls back to the author when the manifest lists no maintainers", () =>
    Effect.gen(function* () {
      const { maintainers: _maintainers, ...withoutMaintainers } = manifest;
      const decoded3 = yield* decode(withoutMaintainers);
      const authors = SbomMetadataSource.rootComponent(decoded3).authors ?? [];
      assert.deepStrictEqual(
        A.map(authors, (author) => author.name),
        ["Dee"]
      );
    })
  );

  it.effect("resolves the publisher: explicit, then supplier, then the manifest author", () =>
    Effect.gen(function* () {
      const pkg = yield* decode();
      const supplier = Supplier.make({ name: "Acme" });
      assert.strictEqual(
        SbomMetadataSource.rootComponent(pkg, { publisher: "Explicit", supplier }).publisher,
        "Explicit"
      );
      assert.strictEqual(SbomMetadataSource.rootComponent(pkg, { supplier }).publisher, "Acme");
      assert.strictEqual(SbomMetadataSource.rootComponent(pkg).publisher, "Dee");
    })
  );

  it.effect("carries an explicit copyright and omits it otherwise", () =>
    Effect.gen(function* () {
      const pkg = yield* decode();
      assert.strictEqual(SbomMetadataSource.rootComponent(pkg).copyright, undefined);
      assert.strictEqual(
        SbomMetadataSource.rootComponent(pkg, { copyright: "Copyright 2026 Acme" }).copyright,
        "Copyright 2026 Acme"
      );
    })
  );

  it.effect("omits the licenses array entirely for an unlicensed manifest", () =>
    Effect.gen(function* () {
      const pkg = yield* decode({ name: "bare", version: "1.0.0" });
      const component = SbomMetadataSource.rootComponent(pkg);
      assert.strictEqual(component.licenses, undefined);
      assert.strictEqual(component.description, undefined);
      assert.strictEqual(component.tags, undefined);
      assert.strictEqual(component.authors, undefined);
      assert.strictEqual(component.publisher, undefined);
    })
  );
});

describe("SbomMetadataSource.externalReferences", () => {
  it.effect("normalizes the repository through the package-json model, not a regex", () =>
    Effect.gen(function* () {
      // `git+https://github.com/effected/kit.git` browses at
      // `https://github.com/effected/kit`. The normalization is
      // `Repository.browseUrl`'s; this package only chooses the reference type.
      const decoded4 = yield* decode();
      const references = SbomMetadataSource.externalReferences(decoded4);
      const vcs = referenceOf(references, "vcs");
      assert.strictEqual(vcs?.url, "https://github.com/effected/kit");
    })
  );

  it.effect("normalizes the scp-like git form the predecessor's regex chain also handled", () =>
    Effect.gen(function* () {
      const pkg = yield* decode({ ...manifest, repository: "git@github.com:effected/kit.git" });
      const vcs = referenceOf(SbomMetadataSource.externalReferences(pkg), "vcs");
      assert.strictEqual(vcs?.url, "https://github.com/effected/kit");
    })
  );

  it.effect("emits no vcs reference when the repository value is not a URL the model recognizes", () =>
    Effect.gen(function* () {
      // The discriminating negative: an externalReference.url that is not a URL
      // is a document that validates and misleads.
      const pkg = yield* decode({ ...manifest, repository: "  " });
      assert.isUndefined(referenceOf(SbomMetadataSource.externalReferences(pkg), "vcs"));
    })
  );

  it.effect("maps bugs onto issue-tracker and homepage onto documentation", () =>
    Effect.gen(function* () {
      const decoded5 = yield* decode();
      const references = SbomMetadataSource.externalReferences(decoded5);
      assert.strictEqual(referenceOf(references, "issue-tracker")?.url, "https://github.com/effected/kit/issues");
      assert.strictEqual(referenceOf(references, "documentation")?.url, "https://effected.dev");
    })
  );

  it.effect("emits no issue-tracker reference for an email-only bugs entry", () =>
    Effect.gen(function* () {
      const pkg = yield* decode({ ...manifest, bugs: { email: "bugs@example.com" } });
      assert.isUndefined(referenceOf(SbomMetadataSource.externalReferences(pkg), "issue-tracker"));
    })
  );

  it.effect("lets an explicit documentation URL win over the manifest's homepage", () =>
    Effect.gen(function* () {
      const decoded6 = yield* decode();
      const references = SbomMetadataSource.externalReferences(decoded6, {
        documentationUrl: "https://docs.example",
      });
      assert.strictEqual(referenceOf(references, "documentation")?.url, "https://docs.example");
    })
  );

  it.effect("adds the supplier's first URL as a website when it differs from the documentation URL", () =>
    Effect.gen(function* () {
      const pkg = yield* decode();
      const supplier = Supplier.make({ name: "Acme", url: ["https://acme.example"] });
      assert.strictEqual(
        referenceOf(SbomMetadataSource.externalReferences(pkg, { supplier }), "website")?.url,
        "https://acme.example"
      );

      // Same URL twice is one reference, not two rows saying the same thing.
      const same = Supplier.make({ name: "Acme", url: ["https://effected.dev"] });
      assert.isUndefined(referenceOf(SbomMetadataSource.externalReferences(pkg, { supplier: same }), "website"));
    })
  );

  it.effect("emits nothing at all for a manifest carrying none of the four fields", () =>
    Effect.gen(function* () {
      const decoded7 = yield* decode({ name: "bare", version: "1.0.0" });
      assert.lengthOf(SbomMetadataSource.externalReferences(decoded7), 0);
    })
  );
});

describe("SbomMetadataSource.fromPackage", () => {
  it.effect("threads an explicit supplier and timestamp onto the metadata", () =>
    Effect.gen(function* () {
      const decoded8 = yield* decode();
      const metadata = SbomMetadataSource.fromPackage(decoded8, {
        supplier: Supplier.make({ name: "Acme" }),
        timestamp: "2026-07-25T00:00:00.000Z",
      });
      assert.strictEqual(metadata.supplier?.name, "Acme");
      assert.strictEqual(metadata.timestamp, "2026-07-25T00:00:00.000Z");
    })
  );

  it.effect("fills the supplier's contacts from maintainers when it has none", () =>
    Effect.gen(function* () {
      const decoded9 = yield* decode();
      const metadata = SbomMetadataSource.fromPackage(decoded9, { supplier: Supplier.make({ name: "Acme" }) });
      assert.deepStrictEqual(
        A.map(metadata.supplier?.contact ?? [], (contact) => contact.name),
        ["Ray", "Vee"]
      );
    })
  );

  it.effect("never overwrites contacts the caller supplied", () =>
    Effect.gen(function* () {
      const supplier = Supplier.make({ name: "Acme", contact: [Contact.make({ name: "Support" })] });
      const decoded10 = yield* decode();
      const metadata = SbomMetadataSource.fromPackage(decoded10, { supplier });
      assert.deepStrictEqual(
        A.map(metadata.supplier?.contact ?? [], (contact) => contact.name),
        ["Support"]
      );
    })
  );

  it.effect("derives no supplier and no authors from a manifest alone", () =>
    Effect.gen(function* () {
      // A manifest says who wrote the software, never who assembled the SBOM or
      // which organization supplied it. Inventing either would fabricate two of
      // the NTIA elements.
      const decoded11 = yield* decode();
      const metadata = SbomMetadataSource.fromPackage(decoded11);
      assert.isUndefined(metadata.supplier);
      assert.isUndefined(metadata.authors);
      assert.isUndefined(metadata.timestamp);
    })
  );

  it.effect("carries explicit SBOM authors", () =>
    Effect.gen(function* () {
      const decoded12 = yield* decode();
      const metadata = SbomMetadataSource.fromPackage(decoded12, {
        authors: [Contact.make({ name: "release-bot" })],
      });
      assert.strictEqual(metadata.authors?.[0]?.name, "release-bot");
    })
  );

  it("rejects explicit undefined options (EF-40 exact optional keys)", () => {
    // Same exact keys as ComponentInput: an option read out of config as
    // `T | undefined` is omitted at the call site, never forwarded as
    // `undefined`. A present key holding `undefined` fails validation...
    assert.isFalse(S.is(SbomMetadataOptions)({ supplier: undefined }));
    assert.isFalse(S.is(SbomMetadataOptions)({ authors: undefined }));
    assert.isFalse(S.is(SbomMetadataOptions)({ timestamp: undefined }));
    assert.isFalse(S.is(SbomMetadataOptions)({ publisher: undefined }));
    assert.isFalse(S.is(SbomMetadataOptions)({ copyright: undefined }));
    assert.isFalse(S.is(SbomMetadataOptions)({ documentationUrl: undefined }));
    assert.isFalse(S.is(SbomMetadataOptions)({ type: undefined }));
    assert.isTrue(S.is(SbomMetadataOptions)({}));
    // ...and does not type-check.
    const config: { timestamp: string | undefined } = { timestamp: undefined };
    // @ts-expect-error: `timestamp` is an exact optional key; `undefined` is not a value for it.
    const options: SbomMetadataOptions.Encoded = config;
    assert.isDefined(options);
  });
});

describe("SbomMetadataSource.formatCopyright", () => {
  it("names a single year", () => {
    assert.strictEqual(SbomMetadataSource.formatCopyright("Acme", { year: 2026 }), "Copyright 2026 Acme");
  });

  it("spans a range when the start year differs", () => {
    assert.strictEqual(
      SbomMetadataSource.formatCopyright("Acme", { startYear: 2020, year: 2026 }),
      "Copyright 2020-2026 Acme"
    );
  });

  it("collapses a range whose ends are the same year", () => {
    assert.strictEqual(
      SbomMetadataSource.formatCopyright("Acme", { startYear: 2026, year: 2026 }),
      "Copyright 2026 Acme"
    );
  });

  it("rejects an explicit undefined start year (EF-40 exact optional keys)", () => {
    assert.isFalse(S.is(CopyrightYears)({ startYear: undefined, year: 2026 }));
    assert.isTrue(S.is(CopyrightYears)({ year: 2026 }));
    const years: { startYear: number | undefined; year: number } = { startYear: undefined, year: 2026 };
    // @ts-expect-error: `startYear` is an exact optional key; `undefined` is not a value for it.
    const input: CopyrightYears.Encoded = years;
    assert.isDefined(input);
  });

  it("takes the year as an argument, never from an ambient clock", () => {
    // The predecessor defaulted `endYear` to `new Date().getFullYear()`, which
    // made its output untestable and its purity a claim rather than a property.
    // Two calls a year apart must be reproducible from the arguments alone.
    assert.strictEqual(SbomMetadataSource.formatCopyright("Acme", { year: 1999 }), "Copyright 1999 Acme");
  });
});

describe("SbomMetadataSource.merge", () => {
  it("lets the override win on every field, not just the one a test happens to check", () => {
    // Field by field, or a merge that is right about `supplier` and wrong about
    // `timestamp` passes a suite that only ever asserts on suppliers.
    const base = SbomMetadata.make({
      timestamp: "2026-01-01T00:00:00.000Z",
      authors: [Contact.make({ name: "base-author" })],
      component: SbomMetadataSource.componentFor({ name: "base", version: "1.0.0" }),
      supplier: Supplier.make({ name: "Inferred" }),
    });
    const merged = SbomMetadataSource.merge(
      base,
      SbomMetadata.make({
        timestamp: "2026-07-25T00:00:00.000Z",
        authors: [Contact.make({ name: "override-author" })],
        component: SbomMetadataSource.componentFor({ name: "override", version: "2.0.0" }),
        supplier: Supplier.make({ name: "Explicit" }),
      })
    );
    assert.strictEqual(merged.timestamp, "2026-07-25T00:00:00.000Z");
    assert.strictEqual(merged.authors?.[0]?.name, "override-author");
    assert.strictEqual(merged.component?.name, "override");
    assert.strictEqual(merged.supplier?.name, "Explicit");
  });

  it("keeps every base field the override does not carry", () => {
    const base = SbomMetadata.make({
      timestamp: "2026-01-01T00:00:00.000Z",
      authors: [Contact.make({ name: "base-author" })],
      component: SbomMetadataSource.componentFor({ name: "base", version: "1.0.0" }),
      supplier: Supplier.make({ name: "Inferred" }),
    });
    const merged = SbomMetadataSource.merge(base, SbomMetadata.make({}));
    assert.strictEqual(merged.timestamp, "2026-01-01T00:00:00.000Z");
    assert.strictEqual(merged.authors?.[0]?.name, "base-author");
    assert.strictEqual(merged.component?.name, "base");
    assert.strictEqual(merged.supplier?.name, "Inferred");
  });

  it("is a helper, not a policy — the caller decides which side is the override", () => {
    const inferred = SbomMetadata.make({ supplier: Supplier.make({ name: "Inferred" }) });
    const explicit = SbomMetadata.make({ supplier: Supplier.make({ name: "Explicit" }) });
    assert.strictEqual(SbomMetadataSource.merge(explicit, inferred).supplier?.name, "Inferred");
  });

  it("returns an admitted SbomMetadata, structurally — Opaque records have no prototype", () => {
    // Inverted from the lab's `instanceOf` pin (W4-g): `SbomMetadata` is a
    // branded `S.Opaque`, so membership is the schema's structural check, and a
    // merge copies its inputs rather than aliasing them.
    const base = SbomMetadata.make({ timestamp: "2025-01-01T00:00:00Z" });
    const merged = SbomMetadataSource.merge(base, SbomMetadata.make({}));
    assertTrue(S.is(SbomMetadata)(merged));
    assert.notStrictEqual(merged, base);
    assert.deepStrictEqual(merged, base);
  });
});
