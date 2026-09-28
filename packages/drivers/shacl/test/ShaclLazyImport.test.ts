import { makeDataset } from "@beep/rdf/Rdf";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import { vi } from "vitest";

const engine = vi.hoisted(() => ({ imports: 0, constructions: 0 }));
vi.mock("shacl-engine", (importOriginal) =>
  importOriginal<typeof import("shacl-engine")>().then((actual) => {
    engine.imports += 1;
    return {
      ...actual,
      Validator: class extends actual.Validator {
        constructor(...args: ConstructorParameters<typeof actual.Validator>) {
          super(...args);
          engine.constructions += 1;
        }
      },
    };
  })
);
const importObservation = { imports: engine.imports, constructions: engine.constructions };

it.layer(ShaclValidationServiceLive, { timeout: "30 seconds" })("@beep/shacl lazy service surface", (it) => {
  it.effect(
    "imports the live layer without constructing a SHACL validator",
    Effect.fnUntraced(function* () {
      expect(ShaclValidationServiceLive).toBeDefined();
      expect(importObservation).toEqual({ imports: 0, constructions: 0 });
      const service = yield* ShaclValidationService;
      const result = yield* service.validate(
        ShaclValidationRequest.make({
          dataset: makeDataset([]),
          shapes: [],
          shapesDataset: O.none(),
          maxResults: O.none(),
        })
      );
      expect(engine.imports).toBe(1);
      expect(engine.constructions).toBe(1);
      pipe(result.conforms, assertTrue);
      expect(result.violations).toHaveLength(0);
      pipe(result.truncated, assertFalse);
    })
  );
});
