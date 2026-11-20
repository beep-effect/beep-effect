import { RegistryDeprecations } from "@beep/identity/internal/generated/Registry.data";
import * as Registry from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import retired from "./fixtures/p1-retired-iris.json" with { type: "json" };

// The path-derived IRIs P1 re-published, frozen from the live research-library fold and the
// test-runner pins at the P1 base, each with the registry IRI that replaces it.
const RetiredIris = S.Array(S.Struct({ term: TermIri, replacement: TermIri }));
const deprecated: Readonly<Record<string, unknown>> = RegistryDeprecations;

const isLive = (iri: string): boolean =>
  O.isSome(Registry.contract(iri)) || A.some(R.values(Registry.RegistryVocab), (entry) => entry.iri === iri);

describe("term stability", () => {
  it.effect(
    "L0-3 every re-published path-derived IRI has a deprecation naming its replacement",
    Effect.fnUntraced(function* () {
      const retiredIris = yield* S.decodeEffect(RetiredIris)(retired);
      expect(retiredIris).toHaveLength(113);
      for (const { term, replacement } of retiredIris) {
        expect(R.has(deprecated, term), term).toBe(true);
        assertSome(Registry.replacementOf(term), replacement);
        expect(isLive(replacement), replacement).toBe(true);
        expect(isLive(term), term).toBe(false);
      }
    })
  );
});
