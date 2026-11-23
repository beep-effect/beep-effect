import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as S from "effect/Schema";
import { Claims } from "./support/Claims.ts";

const OwnerSubject = S.Struct({ subject: S.Int });
const equivalent = S.toEquivalence(OwnerSubject);
const Subject = S.Int.check(S.isBetween({ minimum: -100, maximum: 100 }));

it.prop(
  "L4-5 owner proposition equivalence agrees exactly with logical key equality",
  [S.Tuple([Subject, S.NonEmptyString, S.Boolean])],
  ([[subject, text, same]]) => {
    const left = { subject, text };
    const right = { subject: same ? subject : subject + 1, text: "a different assertion about this subject" };
    expect(equivalent(left, right)).toBe(Claims.logicalKey(left) === Claims.logicalKey(right));
    expect(equivalent(left, right)).toBe(same);
  }
);
