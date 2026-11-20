import { $I } from "@beep/identity/packages";
import { $BeepId } from "@beep/identity/Root";
import { describe, expect, it } from "@effect/vitest";

describe("@beep/identity/Root", () => {
  it("builds the same root composer as the registry's $I", () => {
    expect({
      identifier: $BeepId.identifier,
      iri: $BeepId.iri,
      curie: $BeepId.curie,
      made: $BeepId.make("Probe"),
      child: $BeepId.create("schema").make("Probe"),
      childIri: $BeepId.create("schema").iri,
    }).toStrictEqual({
      identifier: $I.identifier,
      iri: $I.iri,
      curie: $I.curie,
      made: $I.make("Probe"),
      child: $I.create("schema").make("Probe"),
      childIri: $I.create("schema").iri,
    });
  });
});
