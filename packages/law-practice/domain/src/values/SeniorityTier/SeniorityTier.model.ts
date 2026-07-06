import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/SeniorityTier.model");

export const SeniorityTier = LiteralKit([
  "partner",
  "senior-associate",
  "associate",
  "junior",
  "specialist",
  "counsel",
]).pipe(
  $I.annoteSchema("SeniorityTier", {
    description: "The seniority tier of a lawyer.",
  })
);

export type SeniorityTier = typeof SeniorityTier.Type;
