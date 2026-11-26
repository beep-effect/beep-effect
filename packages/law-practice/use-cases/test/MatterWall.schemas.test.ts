import { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim";
import { GrantedScopes, LawPrincipal, MatterAccess, MatterDenialReason } from "@beep/law-practice-use-cases/MatterWall";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const decodeAccess = S.decodeUnknownEffect(MatterAccess);

const decodeGranted = S.decodeUnknownEffect(GrantedScopes);

describe("MatterWall schemas", () => {
  it.effect("round-trips a granted and a denied access", () =>
    Effect.gen(function* () {
      const granted = yield* decodeAccess({ _tag: "Granted", matter: 3 });
      const denied = yield* decodeAccess({ _tag: "Denied", reason: "not-staffed" });
      const encoded = yield* Effect.forEach([granted, denied], (access) => S.encodeEffect(MatterAccess)(access), {
        concurrency: 1,
      });
      expect(encoded).toEqual([
        { _tag: "Granted", matter: 3 },
        { _tag: "Denied", reason: "not-staffed" },
      ]);
      expect(MatterDenialReason.literals).toEqual(["unbound-scope", "not-staffed"]);
    })
  );

  it.effect("refuses a denial without a declared reason", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(decodeAccess({ _tag: "Denied", reason: "hidden" }));
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("encodes granted scopes sorted", () =>
    Effect.gen(function* () {
      const scopes = yield* decodeGranted({
        scopeRefs: ["matter:b", "matter:a"],
        familyKeys: ["zeta.F1", "acme.F2"],
        mailFolders: [
          { archive: "b", folderPrefix: "Inbox" },
          { archive: "a", folderPrefix: "Matters/A" },
        ],
      });
      expect(HashSet.size(scopes.scopeRefs)).toBe(2);
      const encoded = yield* S.encodeEffect(GrantedScopes)(scopes);
      expect(encoded).toEqual({
        scopeRefs: ["matter:a", "matter:b"],
        familyKeys: ["acme.F2", "zeta.F1"],
        mailFolders: [
          { archive: "a", folderPrefix: "Matters/A" },
          { archive: "b", folderPrefix: "Inbox" },
        ],
      });
    })
  );

  it.effect("reads the principal the host provides", () =>
    Effect.gen(function* () {
      const current = yield* LawPrincipal;
      expect(current.principal).toBe(7);
    }).pipe(Effect.provideService(LawPrincipal, { principal: LawPrincipalId.make(7) }))
  );
});

const roundTrips = Effect.fnUntraced(function* <A, I>(schema: S.Codec<A, I>, value: A) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
});

describe("MatterWall schema-derived values", () => {
  it.effect.prop(
    "round-trips every generated MatterAccess through its encoding",
    [Arbitrary.schema(MatterAccess)],
    ([value]) => roundTrips(MatterAccess, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips every generated GrantedScopes through its encoding",
    [Arbitrary.schema(GrantedScopes)],
    ([value]) => roundTrips(GrantedScopes, value),
    { arbitrary: fcRuns(25) }
  );
});
