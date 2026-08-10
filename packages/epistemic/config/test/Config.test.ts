import { EpistemicConfigLive } from "@beep/epistemic-config/layer";
import { defaultPolicyRevision, EpistemicConfig, resolveSinkAudience } from "@beep/epistemic-config/server";
import { fixtureFrozenAt, fixtureFrozenGrantSet, testEpistemicConfig } from "@beep/epistemic-config/test";
import { ExecutionGrant, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  addGrant,
  emptyDraftGrantSet,
  freezeGrantSet,
  verifyFrozenGrantSetDigest,
} from "@beep/epistemic-domain/values/GrantSet";
import { describe, expect, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Exit, Layer } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const configLayer = (configuration: Readonly<Record<string, string>>) =>
  EpistemicConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("EpistemicConfigLive", () => {
  it.effect(
    "defaults to the empty allowlist, which denies every destination",
    Effect.fnUntraced(function* () {
      const config = yield* EpistemicConfig.pipe(provideScopedLayer(configLayer({})));

      expect(config.destinationAllowlist).toEqual([]);
      expect(config.policyRevision).toBe(defaultPolicyRevision);
    })
  );

  it.effect(
    "parses a comma-separated destination allowlist",
    Effect.fnUntraced(function* () {
      const config = yield* EpistemicConfig.pipe(
        provideScopedLayer(
          configLayer({
            EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST: "https://a.example,https://b.example",
            EPISTEMIC_POLICY_REVISION: "2.1.0",
          })
        )
      );

      expect(config.destinationAllowlist).toEqual(["https://a.example", "https://b.example"]);
      expect(config.policyRevision).toBe("2.1.0");
    })
  );

  it.effect(
    "reads an explicitly empty allowlist as deny-all rather than as an error",
    Effect.fnUntraced(function* () {
      const config = yield* EpistemicConfig.pipe(
        provideScopedLayer(configLayer({ EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST: "" }))
      );

      expect(config.destinationAllowlist).toEqual([]);
    })
  );

  it.effect(
    "keeps malformed configuration in the typed failure channel",
    Effect.fnUntraced(function* () {
      const configurations = [
        // A blank entry between commas is dropped silently by a naive split;
        // here it must fail, so an operator typo cannot quietly shrink the
        // allowlist into a denial they did not intend.
        { EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST: "https://a.example," },
        { EPISTEMIC_POLICY_REVISION: "not-a-semver" },
      ];

      for (const configuration of configurations) {
        const exit = yield* Effect.exit(EpistemicConfig.pipe(provideScopedLayer(configLayer(configuration))));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          expect(Cause.hasFails(exit.cause)).toBe(true);
          expect(Cause.hasDies(exit.cause)).toBe(false);
        }
      }
    })
  );
});

describe("resolveSinkAudience", () => {
  it("classifies loopback destinations as local-workspace", () => {
    const loopback = [
      "http://localhost:3939",
      "http://127.0.0.1:3939",
      "https://LOCALHOST/mcp",
      "http://[::1]:3939",
      "http://0.0.0.0:3939",
    ];

    for (const destination of loopback) {
      expect(resolveSinkAudience(SinkDestination.fromUnknown(destination))).toBe("local-workspace");
    }
  });

  it("classifies every other destination as external-network", () => {
    const external = ["https://registry.example", "http://192.168.1.10/api", "https://localhost.attacker.example"];

    for (const destination of external) {
      expect(resolveSinkAudience(SinkDestination.fromUnknown(destination))).toBe("external-network");
    }
  });

  it("takes the stricter branch for unparseable destinations", () => {
    expect(resolveSinkAudience(SinkDestination.fromUnknown("not a url"))).toBe("external-network");
  });
});

describe("grant fixtures", () => {
  it("seals a verifiable grant set", () => {
    expect(verifyFrozenGrantSetDigest(fixtureFrozenGrantSet)).toBe(true);
  });

  it("produces a byte-stable digest across reconstructions", () => {
    // The acceptance test chains ledger rows against this digest, so a fixture
    // that drifts between runs would make the chain unreproducible.
    const grant = S.decodeSync(ExecutionGrant)({
      budget: { maxToolCalls: null },
      expiresAt: 86_400_000,
      operation: "ontology_publish_provenance",
      policyRevision: defaultPolicyRevision,
      principal: { component: "Runtime", kind: "System" },
      purpose: "provenance-publication",
      resource: "ontology-workspace",
      sink: {
        audience: "external-network",
        destination: "https://registry.example",
        sinkClass: "network-egress",
      },
    });
    const rebuilt = freezeGrantSet(
      Result.getOrThrow(addGrant(emptyDraftGrantSet(defaultPolicyRevision), grant)),
      fixtureFrozenAt
    );

    expect(rebuilt.digest).toBe(fixtureFrozenGrantSet.digest);
  });

  it("allowlists exactly the destination the fixture grant names", () => {
    expect(testEpistemicConfig.destinationAllowlist).toEqual([fixtureFrozenGrantSet.grants[0]?.sink.destination]);
  });
});
