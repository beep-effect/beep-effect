import {
  makeStorybookStackArgsFromConfigValues,
  StorybookPulumiConfigValues,
  StorybookStackArgs,
  StorybookVercelAuthenticationDeploymentType,
  StorybookVercelProjectConfig,
} from "@beep/infra";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { expectSchemaRoundTrip } from "./schemaParity.ts";

describe("@beep/infra Storybook", () => {
  it("applies Vercel-only defaults for the public Storybook app", () => {
    const args = makeStorybookStackArgsFromConfigValues();

    expect(args.vercel.projectName).toBe("beep-storybook");
    expect(args.vercel.repository).toBe("beep-effect/beep-effect");
    expect(args.vercel.rootDirectory).toBe("apps/storybook");
    expect(args.vercel.outputDirectory).toBe("storybook-static");
    expect(args.vercel.installCommand).toBe("cd ../.. && bun install");
    expect(args.vercel.buildCommand).toBe("cd ../.. && bun run storybook:build");
    expect(args.vercel.productionBranch).toBe("main");
    expect(args.vercel.vercelAuthenticationDeploymentType).toBe("none");
    expect(O.isNone(args.vercel.teamId)).toBe(true);
  });

  it("maps Pulumi config overrides into Storybook Vercel args", () => {
    const args = makeStorybookStackArgsFromConfigValues({
      buildCommand: "cd ../.. && bun run storybook:build -- --force",
      installCommand: "cd ../.. && bun install --frozen-lockfile",
      outputDirectory: "storybook-static-preview",
      productionBranch: "staging",
      projectName: "beep-storybook-preview",
      repository: "beep-effect/beep-effect-preview",
      rootDirectory: "apps/storybook-preview",
      vercelAuthenticationDeploymentType: "onlyPreviewDeployments",
      vercelTeamId: "team_123",
    });

    expect(args.vercel.projectName).toBe("beep-storybook-preview");
    expect(args.vercel.repository).toBe("beep-effect/beep-effect-preview");
    expect(args.vercel.rootDirectory).toBe("apps/storybook-preview");
    expect(args.vercel.outputDirectory).toBe("storybook-static-preview");
    expect(args.vercel.installCommand).toBe("cd ../.. && bun install --frozen-lockfile");
    expect(args.vercel.buildCommand).toBe("cd ../.. && bun run storybook:build -- --force");
    expect(args.vercel.productionBranch).toBe("staging");
    expect(O.getOrUndefined(args.vercel.teamId)).toBe("team_123");
    expect(args.vercel.vercelAuthenticationDeploymentType).toBe("onlyPreviewDeployments");
  });

  it("rejects invalid Vercel authentication deployment config values", () => {
    expect(() =>
      makeStorybookStackArgsFromConfigValues({
        vercelAuthenticationDeploymentType: "invalid",
      })
    ).toThrow(/Invalid storybook:vercelAuthenticationDeploymentType/u);
  });

  it("keeps stack args import-safe", () => {
    const args = StorybookStackArgs.make({});

    expect(args.vercel.projectName).toBe("beep-storybook");
    expect(args.vercel.rootDirectory).toBe("apps/storybook");
  });

  it("decodes optional Pulumi config shape", () => {
    const decoded = Effect.runSync(
      StorybookPulumiConfigValues.decodeEffect({
        outputDirectory: "storybook-static-preview",
        projectName: "beep-storybook-preview",
        vercelAuthenticationDeploymentType: "none",
      })
    );

    expect(decoded.outputDirectory).toBe("storybook-static-preview");
    expect(decoded.projectName).toBe("beep-storybook-preview");
    expect(decoded.vercelAuthenticationDeploymentType).toBe("none");
  });

  it("encodes Storybook Vercel config with the same optional team-id wire shape", () => {
    const encodedWithTeam = Effect.runSync(
      S.encodeUnknownEffect(StorybookVercelProjectConfig)(
        StorybookVercelProjectConfig.make({ teamId: O.some("team_123") })
      )
    );
    const encodedWithoutTeam = Effect.runSync(
      S.encodeUnknownEffect(StorybookVercelProjectConfig)(StorybookVercelProjectConfig.make({}))
    );

    expect(encodedWithTeam).toEqual({
      buildCommand: "cd ../.. && bun run storybook:build",
      installCommand: "cd ../.. && bun install",
      outputDirectory: "storybook-static",
      productionBranch: "main",
      projectName: "beep-storybook",
      repository: "beep-effect/beep-effect",
      rootDirectory: "apps/storybook",
      teamId: "team_123",
      vercelAuthenticationDeploymentType: "none",
    });
    expect(encodedWithoutTeam).toEqual({
      buildCommand: "cd ../.. && bun run storybook:build",
      installCommand: "cd ../.. && bun install",
      outputDirectory: "storybook-static",
      productionBranch: "main",
      projectName: "beep-storybook",
      repository: "beep-effect/beep-effect",
      rootDirectory: "apps/storybook",
      vercelAuthenticationDeploymentType: "none",
    });
  });

  it("round-trips Storybook config schemas through encoded wire values", () => {
    assertSchemaArbitraryDecodesToSelf(StorybookPulumiConfigValues, { numRuns: 25 });
    expectSchemaRoundTrip(StorybookVercelAuthenticationDeploymentType);
    expectSchemaRoundTrip(StorybookPulumiConfigValues);
    expectSchemaRoundTrip(StorybookVercelProjectConfig);
  });
});
