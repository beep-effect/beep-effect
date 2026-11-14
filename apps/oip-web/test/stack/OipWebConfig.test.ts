// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  configForStage,
  LiveProjectName,
  liveStageConfig,
  OipDomain,
  OipWebStackConfig,
  OipZone,
  ReservedBucketName,
  zoneIds,
} from "../../stack/OipWebConfig.ts";

const decodes = S.is(OipWebStackConfig);

const personal = {
  live: false,
  projectName: "oip-web-dev-alice",
  assetsBucketName: "oip-law-web-assets-dev-alice",
  domains: [],
  hubSpotAccountId: "246203876",
} as const;

describe("OipWeb configuration", () => {
  it.effect("decodes both live stages as the census recorded them", () =>
    Effect.gen(function* () {
      const prod = yield* configForStage("prod");
      const staging = yield* configForStage("staging");
      expect(prod.projectName).toBe(LiveProjectName.Enum["oip-web"]);
      expect(A.map(prod.domains, (domain) => domain.name)).toEqual([
        "oip.law",
        "www.oip.law",
        "opip.law",
        "www.opip.law",
      ]);
      expect(A.map(prod.domains, (domain) => domain.redirectStatusCode)).toEqual([undefined, 308, 308, 308]);
      expect(staging.projectName).toBe(LiveProjectName.Enum["oip-web-staging"]);
      expect(A.map(staging.domains, (domain) => domain.redirectStatusCode)).toEqual([undefined, 307]);
      expect(prod.hubSpotServiceKey).toEqual({ config: "CRM_HUBSPOT_SERVICE_KEY" });
    })
  );

  it.effect("derives a personal stage's names from the stage and reads no secret", () =>
    Effect.gen(function* () {
      const dev = yield* configForStage("dev_Alice");
      expect(dev).toEqual({ ...personal, hubSpotAccountId: "246203876" });
      expect(dev.live).toBe(false);
      expect(dev.hubSpotServiceKey).toBeUndefined();
    })
  );

  it("pins a zone id for every zone", () => {
    for (const zone of OipZone.literals) {
      expect(HashMap.has(zoneIds, zone)).toBe(true);
    }
  });

  it("keeps a personal stage away from every live object", () => {
    expect(decodes(personal)).toBe(true);
    expect(decodes({ ...personal, projectName: "oip-web" })).toBe(false);
    expect(decodes({ ...personal, projectName: "oip-web-staging" })).toBe(false);
    for (const bucket of ReservedBucketName.literals) {
      expect(decodes({ ...personal, assetsBucketName: bucket })).toBe(false);
    }
    expect(decodes({ ...personal, domains: [{ name: "oip.law", zone: "oip.law", record: "A" }] })).toBe(false);
    expect(decodes({ ...personal, hubSpotServiceKey: { config: "CRM_HUBSPOT_SERVICE_KEY" } })).toBe(false);
  });

  it("requires a live stage to name a live project and the secret source", () => {
    expect(decodes(liveStageConfig.prod)).toBe(true);
    expect(decodes({ ...liveStageConfig.prod, projectName: "oip-web-new" })).toBe(false);
    const { hubSpotServiceKey: _secret, ...withoutSecret } = liveStageConfig.prod;
    expect(decodes(withoutSecret)).toBe(false);
  });

  it("rejects malformed domains and redirects", () => {
    const isDomain = S.is(OipDomain);
    expect(isDomain({ name: "www.oip.law", zone: "oip.law", record: "CNAME" })).toBe(true);
    expect(isDomain({ name: "oip.law", zone: "oip.law", record: "CNAME" })).toBe(false);
    expect(isDomain({ name: "www.oip.law", zone: "opip.law", record: "CNAME" })).toBe(false);
    expect(isDomain({ name: "www.oip.law", zone: "oip.law", record: "CNAME", redirect: "oip.law" })).toBe(false);
    expect(isDomain({ name: "example.com", zone: "oip.law", record: "CNAME" })).toBe(false);
    const redirectsNowhere = {
      ...liveStageConfig.staging,
      domains: [
        { name: "staging.opip.law", zone: "opip.law", record: "CNAME", redirect: "oip.law", redirectStatusCode: 307 },
      ],
    };
    expect(decodes(redirectsNowhere)).toBe(false);
    const duplicated = {
      ...liveStageConfig.prod,
      domains: [...liveStageConfig.prod.domains, liveStageConfig.prod.domains[0]],
    };
    expect(decodes(duplicated)).toBe(false);
  });

  it.effect("fails configForStage with a schema error when a stage name is too long for a bucket", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(configForStage(`dev_${Str.repeat(60)("a")}`));
      expect(exit._tag).toBe("Failure");
    })
  );
});
