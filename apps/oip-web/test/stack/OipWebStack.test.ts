// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { assertExitSuccess, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  configForStage,
  liveStageConfig,
  OipWebStackConfig,
  vercelTeamId as TEAM,
  zoneIdOf,
} from "../../stack/OipWebConfig.ts";
import { dnsRecordComment, oipWebResources, requireCiForLiveStage, servedHostnames } from "../../stack/OipWebStack.ts";
import { FakeCloud, liveHubSpotSecret, liveIds, liveProjectSettings } from "./FakeCloud.ts";
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
      // The rotation reached Vercel, so the state check below is about a real second write.
      expect(O.getOrThrow(FakeCloud.env(liveIds.prodProjectId, "CRM_HUBSPOT_SERVICE_KEY")).value).toBe(
        "rotated-secret-value"
      );
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
      assertSome(failureTag(replaced), "ProtectedResource");
      const destroyed = yield* Effect.exit(stack.destroy());
      assertSome(failureTag(destroyed), "ProtectedResource");
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
      assertSome(failureTag(exit), "ConfigError");
      // The key is read while planning, so nothing was applied: no project, variable, domain, DNS or bucket write.
      expect(FakeCloud.writes()).toEqual([]);
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
      assertSome(failureTag(prodLocal), "ConfigError");
      assertSome(failureTag(stagingLocal), "ConfigError");
      assertExitSuccess(personal, undefined);
      assertExitSuccess(prodCi, undefined);
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

// Window-5 condition 1: adopting the live projects may change nothing that runs or reports
// on a pull request, and keeps the project ids vercel-deploy.yml hard-codes.
describe("OipWeb leaves the pull-request surface alone", { concurrent: false }, () => {
  const pullRequestSafeKeys = ["name", "teamId"];

  for (const stage of ["prod", "staging"] as const) {
    test.provider(`adopting the ${stage} project declares only name and team and keeps every live setting`, (scratch) =>
      Effect.gen(function* () {
        const stack = typed(scratch);
        FakeCloud.reset();
        FakeCloud.seedLive();
        const config = liveStageConfig[stage];
        const outputs = yield* stack.deploy(stageProgram(stage)).pipe(withConfig(liveSecret));

        expect(outputs.projectId).toBe(stage === "prod" ? liveIds.prodProjectId : liveIds.stagingProjectId);
        expect(A.isReadonlyArrayNonEmpty(FakeCloud.declaredProjectKeys())).toBe(true);
        expect(A.every(FakeCloud.declaredProjectKeys(), (key) => A.contains(pullRequestSafeKeys, key))).toBe(true);
        expect(O.getOrThrow(FakeCloud.project(config.projectName)).props).toEqual({
          name: config.projectName,
          ...liveProjectSettings,
          teamId: TEAM,
        });
        // The live DNS records keep their content and comment, so the deploy only reads them.
        expect(A.filter(FakeCloud.writes(), Str.startsWith("Cloudflare.DNS.Record"))).toEqual(
          A.map(config.domains, (domain) => `Cloudflare.DNS.Record ${domain.name} unchanged`)
        );
      })
    );
  }

  for (const stage of ["prod", "staging"] as const) {
    test.provider(`destroying ${stage} deletes none of its adopted objects`, (scratch) =>
      Effect.gen(function* () {
        const stack = typed(scratch);
        FakeCloud.reset();
        FakeCloud.seedLive();
        const outputs = yield* stack.deploy(stageProgram(stage)).pipe(withConfig(liveSecret));
        const destroyed = yield* Effect.exit(stack.destroy());
        assertSome(failureTag(destroyed), "ProtectedResource");

        const config = liveStageConfig[stage];
        expect(O.isSome(FakeCloud.project(config.projectName))).toBe(true);
        for (const key of ["NEXT_DISABLE_PWA", "CRM_HUBSPOT_ACCOUNT_ID", "CRM_HUBSPOT_SERVICE_KEY"]) {
          expect(O.isSome(FakeCloud.env(outputs.projectId, key))).toBe(true);
        }
        for (const domain of config.domains) {
          expect(O.isSome(FakeCloud.domain(domain.name))).toBe(true);
          expect(O.isSome(FakeCloud.record(zoneIdOf(domain), domain.name, domain.record))).toBe(true);
        }
        expect(O.isSome(FakeCloud.bucket(config.assetsBucketName))).toBe(true);
        expect(noDeletes(FakeCloud.writes())).toEqual([]);
      })
    );
  }
});

declare global {
  interface ImportMeta {
    glob<T>(
      pattern: string,
      options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true }
    ): Readonly<Record<string, T>>;
  }
}

// The committed workflow's text, inlined by Vite at transform time: the subject is the file itself,
// so no filesystem layer stands in for it.
const vercelDeployWorkflow = A.join(
  R.values(
    import.meta.glob<string>("../../../../.github/workflows/vercel-deploy.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    })
  ),
  "\n"
);

describe("vercel-deploy.yml", () => {
  it("hard-codes exactly the project ids the stack adopts", () => {
    const workflow = vercelDeployWorkflow;
    expect(workflow).toContain("VERCEL_APPS");
    const projectIds = A.map(A.fromIterable(Str.matchAll(/"projectId": "(prj_[A-Za-z0-9]+)"/g)(workflow)), (m) => m[1]);
    expect(A.contains(projectIds, liveIds.prodProjectId)).toBe(true);
    expect(A.contains(projectIds, liveIds.stagingProjectId)).toBe(true);
    expect(workflow).toContain(`VERCEL_ORG_ID: ${TEAM}`);
  });
});
