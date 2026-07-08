import { describe, expect, it } from "vitest";
import { emitIrisModule } from "../ontology/emitIrisModule.ts";
import { ClassRecord, ClassTable } from "../ontology/parseTtl.ts";

describe("emitIrisModule", () => {
  it("emits ontology terms as data-safe TypeScript literals", () => {
    const maliciousTerm = 'bad-key");\nexport const injected = true;\n//';
    const maliciousIri = `https://w3id.org/energy-intel/${maliciousTerm}`;
    const source = emitIrisModule(
      ClassTable.make({
        classes: [
          ClassRecord.make({
            iri: "https://w3id.org/energy-intel/Carrier",
            label: "Malicious",
            superClasses: [],
            disjointWith: [],
            equivalentClassRestrictions: [],
            properties: [],
          }),
        ],
        declaredProperties: [maliciousIri],
        prefixes: {},
      })
    );

    expect(source).toContain(`${JSON.stringify(maliciousTerm)}: namedNode(${JSON.stringify(maliciousIri)})`);
    expect(source).not.toContain("\nexport const injected = true;");
  });
});
