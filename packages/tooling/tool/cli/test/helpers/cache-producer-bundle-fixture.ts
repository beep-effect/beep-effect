import * as A from "effect/Array";
import { executionInput } from "./cache-protocol-fixture.ts";
import { signedPilotInput } from "./cache-signed-pilot-fixture.ts";

const protect = (pair: (typeof signedPilotInput.pairs)[number]) => ({
  ...pair,
  protection: { ...pair.protection, issuerMaterialDenied: true },
});
export const pilot = {
  ...signedPilotInput,
  pairs: A.map(signedPilotInput.pairs, protect),
  shadows: A.map(signedPilotInput.shadows, (shadow) => ({ ...shadow, comparison: protect(shadow.comparison) })),
  mutations: A.map(signedPilotInput.mutations, (mutation) => ({
    ...mutation,
    comparison: protect(mutation.comparison),
  })),
};
export const protocol = { ...executionInput, bunSha256: pilot.bun.sha256 };
export const input = { schemaVersion: "cache-producer-bundle/v1", pilot, protocol };

export const contractInput = {
  key: pilot.key,
  pins: {
    contract: pilot.configurationDigest,
    configuration: pilot.signedConfigurationDigest,
    toolchain: pilot.runtimeKeyDigest,
    fixtures: pilot.configurationDigest,
    backend: pilot.configurationDigest,
  },
  activation: {
    path: "packages/identity/turbo.json",
    before: { path: "before.json", sha256: pilot.configurationDigest },
    after: { path: "after.json", sha256: pilot.activatedConfigurationDigest },
    sourceConfiguration: pilot.configurationDigest,
  },
  signedExecution: {
    schemaVersion: "cache-signed-execution-profile/v1",
    sourceKey: pilot.baseKey,
    sourceConfiguration: pilot.configurationDigest,
    sourceToolchain: pilot.toolchainDigest,
    activatedConfiguration: pilot.activatedConfigurationDigest,
    activationRequest: pilot.activation,
    signedRootConfiguration: { path: "signed-root.json", sha256: pilot.signedRootConfiguration },
    runtimeKeys: { stable: pilot.runtimeKeyDigest, canary: pilot.runtimeKeyDigest },
  },
  commands: ["bun run beep:lint"],
  commandDigest: pilot.configurationDigest,
  dependencies: ["@beep/types#lint"],
  clients: {
    stable: pilot.client,
    canary: { ...pilot.client, version: "2.11.5-canary.2", namespace: "team_canary_contract" },
  },
  semanticInputClasses: ["source"],
  orchestrationInputClasses: ["locale"],
  negativeCases: ["missing-child-config"],
  crossRoot: true,
  configuration: { ...pilot.policyRefusal.configuration, env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"] },
};

const canaryClient = contractInput.clients.canary;
const canaryPair = (pair: (typeof pilot.pairs)[number]) => ({
  ...pair,
  client: { ...canaryClient, namespace: `canary-${pair.client.namespace}` },
});
const canaryProtocolClient = { ...canaryClient, namespace: "protocol-canary" };
export const canaryInput = {
  ...input,
  pilot: {
    ...pilot,
    channel: "canary",
    client: canaryClient,
    pairs: A.map(pilot.pairs, canaryPair),
    shadows: A.map(pilot.shadows, (shadow) => ({ ...shadow, comparison: canaryPair(shadow.comparison) })),
    mutations: A.map(pilot.mutations, (mutation) => ({ ...mutation, comparison: canaryPair(mutation.comparison) })),
  },
  protocol: {
    ...protocol,
    observation: {
      ...protocol.observation,
      channel: "canary",
      client: canaryProtocolClient,
      runs: A.map(protocol.observation.runs, (run) => ({ ...run, client: canaryProtocolClient })),
    },
  },
};
