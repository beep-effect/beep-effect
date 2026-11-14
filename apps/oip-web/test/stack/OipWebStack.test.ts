// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configForStage, liveStageConfig, OipWebStackConfig, zoneIdOf } from "../../stack/OipWebConfig.ts";
import { dnsRecordComment, oipWebResources, requireCiForLiveStage, servedHostnames } from "../../stack/OipWebStack.ts";
import { FakeCloud, liveHubSpotSecret, liveIds } from "./FakeCloud.ts";
import { failureTag, makeHarness, persistedStrings, stageProgram, typed, withConfig } from "./Harness.ts";

const { test } = makeHarness();

const liveSecret = { CRM_HUBSPOT_SERVICE_KEY: liveHubSpotSecret };

const noDeletes = (writes: ReadonlyArray<string>) => A.filter(writes, Str.endsWith(" delete"));

// The cloud fake is one in-memory store that each test resets; these tests share it, so they
// run one at a time even though the suite runs concurrently.
describe("OipWeb stack", { concurrent: false }, () => {
  test.provider("prod adopts every live object in place and creates only the new assets bucket", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      FakeCloud.reset();
      FakeCloud.seedLive();
      const outputs = yield* stack.deploy(stageProgram("prod")).pipe(withConfig(liveSecret));

      expect(outputs.projectId).toBe(liveIds.prodProjectId);
      expect(FakeCloud.projectCount()).toBe(2);
      expect(outputs.domains).toEqual(["oip.law", "www.oip.law", "opip.law", "www.opip.law"]);
      for (const domain of liveStageConfig.prod.domains) {
        expect(O.getOrThrow(FakeCloud.domain(domain.name)).projectId).toBe(liveIds.prodProjectId);
        const record = O.getOrThrow(FakeCloud.record(zoneIdOf(domain), domain.name, domain.record));
        expect(record.recordId).toMatch(/^rec_live_/);
        expect(record.comment).toBe(dnsRecordComment);
      }
      expect(O.getOrThrow(FakeCloud.env(liveIds.prodProjectId, "CRM_HUBSPOT_SERVICE_KEY")).envId).toMatch(/^env_live_/);
      expect(O.getOrThrow(FakeCloud.env(liveIds.prodProjectId, "CRM_HUBSPOT_SERVICE_KEY")).value).toBe(
        liveHubSpotSecret
      );
      expect(O.getOrThrow(FakeCloud.env(liveIds.prodProjectId, "NEXT_DISABLE_PWA")).value).toBe("0");
      expect(outputs.assetsBucketName).toBe("oip-law-web-assets-prod");
      expect(O.isSome(FakeCloud.bucket("assets.oip.law"))).toBe(true);
      expect(noDeletes(FakeCloud.writes())).toEqual([]);
      // The staging stage's objects are untouched.
      expect(O.getOrThrow(FakeCloud.domain("staging.oip.law")).projectId).toBe(liveIds.stagingProjectId);
    })
  );

  test.provider("staging adopts its project, two domains and two records", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      FakeCloud.reset();
      FakeCloud.seedLive();
      const outputs = yield* stack.deploy(stageProgram("staging")).pipe(withConfig(liveSecret));

      expect(outputs.projectId).toBe(liveIds.stagingProjectId);
      expect(outputs.domains).toEqual(["staging.oip.law", "staging.opip.law"]);
      expect(O.getOrThrow(FakeCloud.domain("staging.opip.law")).redirectStatusCode).toBe(307);
      expect(outputs.assetsBucketName).toBe("oip-law-web-assets-staging");
      expect(O.getOrThrow(FakeCloud.domain("oip.law")).projectId).toBe(liveIds.prodProjectId);
      expect(noDeletes(FakeCloud.writes())).toEqual([]);
    })
  );

  test.provider("a personal stage creates its own project and bucket and touches nothing live", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      FakeCloud.reset();
      FakeCloud.seedLive();
      const outputs = yield* stack.deploy(stageProgram("dev_alice"));

      expect(outputs.domains).toEqual([]);
      expect(outputs.assetsBucketName).toBe("oip-law-web-assets-dev-alice");
      expect(O.isSome(FakeCloud.project("oip-web-dev-alice"))).toBe(true);
      const touched = A.filter(FakeCloud.writes(), (write) =>
        A.some(["oip-web ", "oip-web-staging ", ".law ", "assets.oip.law"], (live) => Str.includes(live)(write))
      );
      expect(touched).toEqual([]);
      expect(A.some(FakeCloud.writes(), Str.includes("CRM_HUBSPOT_SERVICE_KEY"))).toBe(false);
      yield* stack.destroy();
      expect(O.isNone(FakeCloud.project("oip-web-dev-alice"))).toBe(true);
      expect(O.isSome(FakeCloud.project("oip-web"))).toBe(true);
    })
  );

  test.provider("keeps the HubSpot secret out of state, before and after a rotation", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      FakeCloud.reset();
      FakeCloud.seedLive();
      yield* stack.deploy(stageProgram("prod")).pipe(withConfig(liveSecret));
      const first = yield* persistedStrings;
      expect(A.some(first, Str.includes(liveHubSpotSecret))).toBe(false);
      expect(A.contains(first, "CRM_HUBSPOT_SERVICE_KEY")).toBe(true);

      yield* stack.deploy(stageProgram("prod")).pipe(withConfig({ CRM_HUBSPOT_SERVICE_KEY: "rotated-secret-value" }));
      const second = yield* persistedStrings;
      expect(A.some(second, Str.includes("rotated-secret-value"))).toBe(false);
    })
  );

  test.provider("refuses a plan that would replace a protected live object", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      FakeCloud.reset();
      FakeCloud.seedLive();
      yield* stack.deploy(stageProgram("prod")).pipe(withConfig(liveSecret));
      const renamed = yield* S.decodeEffect(OipWebStackConfig)({
        ...liveStageConfig.prod,
        assetsBucketName: "oip-law-web-assets-renamed",
      });
      const replaced = yield* Effect.exit(stack.deploy(oipWebResources(renamed)).pipe(withConfig(liveSecret)));
      expect(failureTag(replaced)).toEqual(O.some("ProtectedResource"));
      const destroyed = yield* Effect.exit(stack.destroy());
      expect(failureTag(destroyed)).toEqual(O.some("ProtectedResource"));
      expect(O.isSome(FakeCloud.project("oip-web"))).toBe(true);
      expect(O.isSome(FakeCloud.bucket("oip-law-web-assets-prod"))).toBe(true);
      expect(noDeletes(FakeCloud.writes())).toEqual([]);
    })
  );

  test.provider("fails a live stage that cannot read the HubSpot secret before writing anything", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      FakeCloud.reset();
      FakeCloud.seedLive();
      const exit = yield* Effect.exit(stack.deploy(stageProgram("prod")).pipe(withConfig({})));
      expect(failureTag(exit)).toEqual(O.some("ConfigError"));
      expect(O.getOrThrow(FakeCloud.env(liveIds.prodProjectId, "CRM_HUBSPOT_SERVICE_KEY")).value).toBe(
        liveHubSpotSecret
      );
    })
  );
});

describe("requireCiForLiveStage", () => {
  it.effect("refuses prod and staging outside CI and passes a personal stage", () =>
    Effect.gen(function* () {
      const local = withConfig({});
      const prodLocal = yield* Effect.exit(requireCiForLiveStage("prod").pipe(local));
      const stagingLocal = yield* Effect.exit(requireCiForLiveStage("staging").pipe(local));
      const personal = yield* Effect.exit(requireCiForLiveStage("dev_alice").pipe(local));
      const prodCi = yield* Effect.exit(requireCiForLiveStage("prod").pipe(withConfig({ CI: "true" })));
      expect(failureTag(prodLocal)).toEqual(O.some("ConfigError"));
      expect(failureTag(stagingLocal)).toEqual(O.some("ConfigError"));
      expect(Exit.isSuccess(personal)).toBe(true);
      expect(Exit.isSuccess(prodCi)).toBe(true);
    })
  );
});

describe("servedHostnames", () => {
  it.effect("lists only non-redirecting domains", () =>
    Effect.gen(function* () {
      const prod = yield* configForStage("prod");
      const staging = yield* configForStage("staging");
      expect(servedHostnames(prod)).toEqual(["oip.law"]);
      expect(servedHostnames(staging)).toEqual(["staging.oip.law"]);
    })
  );
});
