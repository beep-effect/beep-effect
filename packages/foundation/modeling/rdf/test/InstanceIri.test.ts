import { IRI } from "@beep/identity/Iri";
import { instanceHash, instanceIri } from "@beep/rdf/InstanceIri";
import { ContentHash } from "@beep/schema/ContentHash";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Str from "effect/String";

const hash = ContentHash.make(`sha256:${Str.repeat(64)("a")}`);

describe("@beep/rdf/InstanceIri", () => {
  it("prints a content id under the instance namespace", () => {
    expect(instanceIri(hash)).toBe(`https://beep-effect.com/ns/instance/sha256-${Str.repeat(64)("a")}`);
  });

  it("parses the content id back from its instance IRI", () => {
    assertSome(instanceHash(instanceIri(hash)), hash);
  });

  it("parses no content id from any other IRI", () => {
    assertNone(instanceHash(IRI.make("https://example.org/activity/1")));
    assertNone(instanceHash(IRI.make(`${instanceIri(hash)}/position`)));
  });
});
