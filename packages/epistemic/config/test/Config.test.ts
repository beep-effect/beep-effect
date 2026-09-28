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
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Cause, ConfigProvider, Effect, Exit, Layer, pipe } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeSinkDestination = S.decodeEffect(SinkDestination);
const decodeExecutionGrant = S.decodeEffect(ExecutionGrant);

const configLayer = (configuration: Readonly<Record<string, string>>) =>
  EpistemicConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))));
describe("EpistemicConfigLive", () => {
  it.layer(configLayer({}), { timeout: "10 seconds" })((it) => {
    it.effect(
      "defaults to the empty allowlist, which denies every destination",
      Effect.fnUntraced(function* () {
        const config = yield* EpistemicConfig;

        expect(config.destinationAllowlist).toEqual([]);
        expect(config.policyRevision).toBe(defaultPolicyRevision);
      })
    );
  });

  it.layer(
    configLayer({
      EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST: "https://a.example,https://b.example",
      EPISTEMIC_POLICY_REVISION: "2.1.0",
    }),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "parses a comma-separated destination allowlist",
      Effect.fnUntraced(function* () {
        const config = yield* EpistemicConfig;

        expect(config.destinationAllowlist).toEqual(["https://a.example", "https://b.example"]);
        expect(config.policyRevision).toBe("2.1.0");
      })
    );
  });

  it.layer(configLayer({ EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST: "" }), { timeout: "10 seconds" })((it) => {
    it.effect(
      "reads an explicitly empty allowlist as deny-all rather than as an error",
      Effect.fnUntraced(function* () {
        const config = yield* EpistemicConfig;

        expect(config.destinationAllowlist).toEqual([]);
      })
    );
  });

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

        pipe(exit, Exit.isFailure, assertTrue);
        if (Exit.isFailure(exit)) {
          pipe(Cause.hasFails(exit.cause), assertTrue);
          pipe(Cause.hasDies(exit.cause), assertFalse);
        }
      }
    })
  );
});

describe("resolveSinkAudience", () => {
  it.effect.each(["localhost", " LOCALHOST ", "127.0.0.1", "[::1]", "::1", "0.0.0.0", "//localhost", "http://[::1"])(
    "takes the stricter audience for malformed loopback-like input %s",
    (destination) =>
      Effect.gen(function* () {
        expect(resolveSinkAudience(yield* decodeSinkDestination(destination))).toBe("external-network");
      })
  );

  it.effect.each(["  HTTP://LOCALHOST:3939/mcp  ", "ftp://localhost/path"])(
    "preserves URL parser semantics for a valid local destination %s",
    (destination) =>
      Effect.gen(function* () {
        expect(resolveSinkAudience(yield* decodeSinkDestination(destination))).toBe("local-workspace");
      })
  );

  it.effect(
    "classifies loopback destinations as local-workspace",
    Effect.fnUntraced(function* () {
      const loopback = [
        "http://localhost:3939",
        "http://127.0.0.1:3939",
        "https://LOCALHOST/mcp",
        "http://[::1]:3939",
        "http://0.0.0.0:3939",
      ];

      for (const destination of loopback) {
        expect(resolveSinkAudience(yield* decodeSinkDestination(destination))).toBe("local-workspace");
      }
    })
  );

  it.effect(
    "classifies every other destination as external-network",
    Effect.fnUntraced(function* () {
      const external = ["https://registry.example", "http://192.168.1.10/api", "https://localhost.attacker.example"];

      for (const destination of external) {
        expect(resolveSinkAudience(yield* decodeSinkDestination(destination))).toBe("external-network");
      }
    })
  );

  it.effect(
    "takes the stricter branch for unparseable destinations",
    Effect.fnUntraced(function* () {
      expect(resolveSinkAudience(yield* decodeSinkDestination("not a url"))).toBe("external-network");
    })
  );
});

describe("grant fixtures", () => {
  it("seals a verifiable grant set", () => {
    pipe(verifyFrozenGrantSetDigest(fixtureFrozenGrantSet), assertTrue);
  });

  it.effect(
    "produces a byte-stable digest across reconstructions",
    Effect.fnUntraced(function* () {
      // The acceptance test chains ledger rows against this digest, so a fixture
      // that drifts between runs would make the chain unreproducible.
      const grant = yield* decodeExecutionGrant({
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
      const rebuilt = Result.getOrThrow(
        addGrant(emptyDraftGrantSet(defaultPolicyRevision), grant).pipe(Result.flatMap(freezeGrantSet(fixtureFrozenAt)))
      );

      expect(rebuilt.digest).toBe(fixtureFrozenGrantSet.digest);
    })
  );

  it("allowlists exactly the destination the fixture grant names", () => {
    expect(testEpistemicConfig.destinationAllowlist).toEqual([fixtureFrozenGrantSet.grants[0]?.sink.destination]);
  });
});
