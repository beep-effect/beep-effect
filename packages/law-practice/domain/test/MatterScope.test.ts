import { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim";
import {
  MailFolderBinding,
  MatterAccessKind,
  MatterGrant,
  MatterScope,
  PracticeKgFamilyKey,
} from "@beep/law-practice-domain/values/MatterScope";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const decodeKey = S.decodeUnknownEffect(PracticeKgFamilyKey);

const decodeScope = S.decodeUnknownEffect(MatterScope);

describe("MatterScope", () => {
  it.effect("round-trips a family key spelled client.family, splitting at the first dot", () =>
    Effect.gen(function* () {
      const key = yield* decodeKey("acme.US-2024.001");
      expect(key.client).toBe("acme");
      expect(key.family).toBe("US-2024.001");
      const spelled = yield* S.encodeEffect(PracticeKgFamilyKey)(key);
      expect(spelled).toBe("acme.US-2024.001");
    })
  );

  it.effect("refuses a family key with a missing client or family part", () =>
    Effect.gen(function* () {
      for (const spelled of ["acme", ".US-2024-001", "acme.", ""]) {
        const exit = yield* Effect.exit(decodeKey(spelled));
        exit.pipe(Exit.isFailure, assertTrue);
      }
    })
  );

  it.effect("refuses a matter scope that binds no key", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(decodeScope({ matter: 1, scopeRefs: [], familyKeys: [], mailFolders: [] }));
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("encodes every key set sorted", () =>
    Effect.gen(function* () {
      const scope = yield* decodeScope({
        matter: 1,
        scopeRefs: ["matter:b", "matter:a"],
        familyKeys: ["zeta.F1", "acme.F2"],
        mailFolders: [
          { archive: "b", folderPrefix: "Inbox" },
          { archive: "a", folderPrefix: "Matters/Z" },
          { archive: "a", folderPrefix: "Matters/A" },
        ],
      });
      const encoded = yield* S.encodeEffect(MatterScope)(scope);
      expect(encoded.scopeRefs).toEqual(["matter:a", "matter:b"]);
      expect(encoded.familyKeys).toEqual(["acme.F2", "zeta.F1"]);
      expect(encoded.mailFolders).toEqual([
        { archive: "a", folderPrefix: "Matters/A" },
        { archive: "a", folderPrefix: "Matters/Z" },
        { archive: "b", folderPrefix: "Inbox" },
      ]);
    })
  );

  it.effect("staffs a principal on matters, encoded sorted", () =>
    Effect.gen(function* () {
      const grant = MatterGrant.make({
        principal: LawPrincipalId.make(7),
        matters: HashSet.make(LawPractice.MatterId.make(3), LawPractice.MatterId.make(1)),
      });
      const encoded = yield* S.encodeEffect(MatterGrant)(grant);
      expect(encoded.matters).toEqual([1, 3]);
    })
  );

  it("binds a mail folder and names the nine access kinds", () => {
    const binding = MailFolderBinding.make({ archive: "a", folderPrefix: "Matters/A" });
    expect(binding.folderPrefix).toBe("Matters/A");
    expect(MatterAccessKind.literals.length).toBe(9);
  });
});
