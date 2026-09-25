import { ReferenceMember, ReferenceWorkspaceManifest } from "@beep/repo-cli/commands/Refs";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { testPlatform } from "./refs-test-utils.ts";

describe("reference manifest schemas", () => {
  it.effect(
    "decodes the real S1 manifest",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const file = yield* path.fromFileUrl(new URL("../../../../../scripts/references.json", import.meta.url));
      const manifest = yield* ReferenceWorkspaceManifest.decodeJson(yield* fs.readFileString(file));
      expect(manifest.rootDefault).toBe("$HOME/YeeBois/references/effect");
      expect(manifest.members.map((member) => [member.name, member.tier])).toEqual([
        ["effect", "deep"],
        ["effect-tsgo", "deep"],
      ]);
      expect(O.isNone(manifest.members[0]?.onlyDir ?? O.none())).toBe(true);
    }, testPlatform)
  );
  for (const extra of [{ branch: "main" }, { tier: "unknown" }, { name: "../escape" }, { onlyDir: ["../escape"] }]) {
    it.effect(
      `rejects invalid member ${R.keys(extra)[0]}`,
      Effect.fnUntraced(function* () {
        const result = yield* ReferenceMember.decode({
          name: "effect",
          url: "upstream",
          tier: "deep",
          ...extra,
        }).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
      })
    );
  }
});
