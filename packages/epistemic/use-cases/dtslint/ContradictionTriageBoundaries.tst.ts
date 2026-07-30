import { ContradictionTriage } from "@beep/epistemic-use-cases/public";
import { expect } from "tstyche";
import type { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import type {
  ContradictionTriage as ContradictionTriageServer,
  EdgeAuthorityError,
} from "@beep/epistemic-use-cases/server";
import type { Effect } from "effect";

expect(ContradictionTriage.ContradictionActionError).type.not.toBe<never>();
expect(ContradictionTriage.ContradictionRpcs).type.not.toBe<never>();
expect<"ContradictionRepositoryUnavailable">().type.not.toBeAssignableTo<keyof typeof ContradictionTriage>();
expect<"ContradictionReviewConflict">().type.not.toBeAssignableTo<keyof typeof ContradictionTriage>();
expect<"ContradictionTriageRepository">().type.not.toBeAssignableTo<keyof typeof ContradictionTriage>();
expect<"ListContradictionCandidates">().type.not.toBeAssignableTo<keyof typeof ContradictionTriage>();

expect<ReturnType<ContradictionTriageServer.ContradictionTriageRepositoryShape["review"]>>().type.toBeAssignableTo<
  Effect.Effect<
    ContradictionDisposition,
    | ContradictionTriageServer.ContradictionRepositoryUnavailable
    | ContradictionTriageServer.ContradictionReviewConflict
    | EdgeAuthorityError,
    never
  >
>();
