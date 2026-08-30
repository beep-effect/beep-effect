import { IRI } from "@beep/rdf";
import { describe, expect, it } from "@effect/vitest";
import { Entity } from "../../Domain/Model/Entity.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { mergeEntityFields } from "../../Utils/Entity.ts";

const Person = IRI.make("https://schema.org/Person");

describe("mergeEntityFields", () => {
  it("selects the longest mention and preserves its preferred attributes", () => {
    const merged = mergeEntityFields([
      Entity.make({
        id: EntityId.make("ada"),
        mention: "Ada",
        types: [Person],
        attributes: { occupation: "Writer", born: 1815 },
      }),
      Entity.make({
        id: EntityId.make("ada_lovelace"),
        mention: "Ada Lovelace",
        types: [Person],
        attributes: { occupation: "Mathematician" },
      }),
    ]);

    expect(merged.canonical.id).toBe("ada_lovelace");
    expect(merged.types).toContain(Person);
    expect(merged.attributes).toEqual({ occupation: "Mathematician", born: 1815 });
  });
});
