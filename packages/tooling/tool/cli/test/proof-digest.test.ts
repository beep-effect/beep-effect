import { collectProofEpoch, proofEpochDigest, proofInputKey } from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Path } from "effect";

const CryptoLayer = NodeCrypto.layer;
const PlatformLayer = Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer);

describe("proof digest derivation", () => {
  it.live("pins the proof input key golden value", () =>
    proofInputKey({
      laneId: "coverage",
      commandDigest: "command-digest",
      envProfile: "local",
      inputDigest: "input-digest",
      epochDigest: "epoch-digest",
    }).pipe(
      Effect.tap((key) =>
        Effect.sync(() => {
          expect(key).toBe("8bdd88f9d6be41b8b6785ed9c1b1ec83636b9fdf8b82c4cc5aff2c0cf5c02be3");
        })
      ),
      provideScopedLayer(CryptoLayer)
    )
  );

  it.live("pins the six-component epoch digest golden value", () =>
    proofEpochDigest({
      lockfileDigest: "lock-digest",
      bunVersion: "1.4.0",
      nodeVersion: "24",
      rootTurboConfigDigest: "turbo-digest",
      rootTsconfigDigest: "tsconfig-digest",
      policyPackVersion: "0.1.0",
    }).pipe(
      Effect.tap((digest) =>
        Effect.sync(() => {
          expect(digest).toBe("f11ba5b46cc83373b84f72aacf4a129037cfbfcd0f3c3d295e6a55bd4378ee49");
        })
      ),
      provideScopedLayer(CryptoLayer)
    )
  );

  it.live("collects the epoch from fixture files and pins its combined digest", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fixtureRoot = path.join(import.meta.dirname, "fixtures", "proof-epoch");
      const epoch = yield* collectProofEpoch(fixtureRoot);

      expect(epoch).toMatchObject({
        lockfileDigest: "36b9964bfced2054d1de53dd66eadaf6e5ec964fdea3289cfb664f6abd490952",
        bunVersion: "1.4.0",
        nodeVersion: "24",
        rootTurboConfigDigest: "2ef47f50a33dccec36bb7d308ebc132669fa410c7562c85edaaa50b22660ed2e",
        rootTsconfigDigest: "fc9fc38c21441b7f67a91280ed28b8ca4ad67fc69d713db441f5c0fd9a6abf9f",
        policyPackVersion: "9.8.7",
        digest: "c7882af3d329abacab659646adb399fca1f00a7af44e8fac5c9713e5ce50f799",
      });
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});
