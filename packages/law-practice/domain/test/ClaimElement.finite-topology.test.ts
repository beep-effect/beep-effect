import { TestCrypto } from "@beep/law-practice-domain/test";
import { it } from "@beep/test-runner";
import controls from "./fixtures/claim-element/finite-clause-source-plans.json" with { type: "json" };
import { assertFiniteSourceConformance } from "./helpers/ClaimElementFiniteConformance.ts";

it.layer(TestCrypto)("finite source-led clause topology and exact public projection", (it) => {
  for (const control of controls.cases) it.effect(control.case, () => assertFiniteSourceConformance(control));
});
