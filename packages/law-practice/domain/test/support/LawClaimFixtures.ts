import {
  DistinctionProposition,
  LawClaimCore,
  LawPrincipalId,
  logicalKey,
} from "@beep/law-practice-domain/values/LawClaim";
import { ActivityId } from "@beep/schema/ContentHash";
import * as DateTime from "effect/DateTime";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ScopeRef } from "@beep/law-practice-domain/values/LawClaim";

export const proposition = DistinctionProposition.make({
  authority: "office-action",
  applicationNumber: "16/123,456",
  claimNumber: 1,
  ground: "102",
  referenceDocument: "US 9,876,543 B2",
  detail: { kind: "missing_limitation", limitation: "a hinged lid" },
});

const generatedBy = ActivityId.make(`sha256:${Str.repeat(64)("b")}`);

export const coreIn = (scope: ScopeRef): LawClaimCore =>
  LawClaimCore.make({
    proposition,
    logicalKey: logicalKey(proposition),
    supportAtCreation: HashSet.empty(),
    derivedFrom: HashSet.empty(),
    supersedes: O.none(),
    generatedBy,
    assertedBy: { _tag: "Person", principal: LawPrincipalId.make(7) },
    valid: { _tag: "Unknown" },
    knowledgeStart: DateTime.makeUnsafe(1_000),
    scope,
  });
