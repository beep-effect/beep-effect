import { IdentityAuthority } from "@beep/identity/Authority";
import { namespaceOf, RegistryVocab } from "@beep/identity/Registry";
import { NamespacePins, namespacePins } from "@beep/rdf/NamespacePin";
import { NamespacePinRows } from "@beep/rdf/Vocab/generated/NamespacePins.data";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// P1 ruling 3 (decision 2026-11-19-p1-pin-scope-eight-namespaces): these external namespaces
// stay unpinned until P5, whose exit test asserts a pin for every external namespace.
const unpinnedUntilP5 = ["dcat", "dcterms", "owl", "rdf", "rdfs", "schema", "sh", "void"];

const pins = Result.getOrThrow(namespacePins());

const termsDigest = Effect.fn("termsDigest")(function* (terms: ReadonlyArray<string>) {
  const crypto = yield* Digest.Digest;
  const bytes = new TextEncoder().encode(A.join(A.sort(terms, Str.Order), "\n"));
  const digest = yield* crypto.digest(Digest.sha256, bytes);
  return `sha256:${Hex.encode(digest)}`;
});

it.layer(Digest.layerWebCrypto)("namespace pin digests", (it) => {
  it.effect("matches each pin's terms digest to the registry terms of its namespace", () =>
    Effect.gen(function* () {
      for (const pin of pins) {
        const [, entry] = O.getOrThrow(A.findFirst(R.toEntries(RegistryVocab), ([prefix]) => prefix === pin.prefix));
        const digest = yield* termsDigest(entry.terms);
        expect(digest, pin.prefix).toBe(pin.termsDigest);
      }
    })
  );
});

describe("namespace pins", () => {
  it("pins exactly the P1 namespaces, each a registry namespace with the same IRI", () => {
    expect(A.map(pins, (pin) => pin.prefix)).toStrictEqual([
      "as",
      "cito",
      "deo",
      "doco",
      "fabio",
      "gufo",
      "nif",
      "oa",
      "prov",
      "skos",
      "xsd",
    ]);
    for (const pin of pins) {
      const namespace = O.getOrThrow(namespaceOf(pin.prefix));
      expect(namespace.iri, pin.prefix).toBe(pin.namespace);
      expect(pin.license.toString().length, pin.prefix).toBeGreaterThan(0);
      expect(pin.digest, pin.prefix).toMatch(/^sha256:[a-f0-9]{64}$/u);
    }
  });

  it("leaves only the P5 namespaces of the registry unpinned", () => {
    const external = A.filter(
      R.keys(RegistryVocab),
      (prefix) => !Str.startsWith(IdentityAuthority)(RegistryVocab[prefix].iri)
    );
    const unpinned = A.filter(external, (prefix) => !A.some(pins, (pin) => pin.prefix === prefix));
    expect(A.sort(unpinned, Str.Order)).toStrictEqual(unpinnedUntilP5);
  });

  it("refuses unsorted or duplicate prefixes and an invalid license", () => {
    const decode = S.decodeUnknownResult(NamespacePins);
    const [first, second] = NamespacePinRows;
    assertTrue(decode([first, second]).pipe(Result.isSuccess));
    assertTrue(decode([second, first]).pipe(Result.isFailure));
    assertTrue(decode([first, first]).pipe(Result.isFailure));
    assertTrue(decode([{ ...first, license: "Not A License" }]).pipe(Result.isFailure));
  });
});
