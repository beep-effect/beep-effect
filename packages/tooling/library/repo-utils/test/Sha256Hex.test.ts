import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { NodeCrypto } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";

layer(NodeCrypto.layer)("sha256Hex", (it) => {
  it.effect("hashes UTF-8 text to lowercase SHA-256 hex", () =>
    Effect.gen(function* () {
      const digest = yield* sha256Hex("beep");
      expect(digest).toBe("d01b7ce9154ef0264ce71e457ea81903b87a58d6cf2cd6be474886fdbc6f61d9");
      expect(digest).toHaveLength(64);
      expect(digest).toBe(digest.toLowerCase());
    })
  );
});
