import { RunnerUserDataInput, renderRunnerUserData } from "@beep/alchemy-github-runners/RunnerUserData";
import { packPostInstall, runnerPostInstall, userDataLimitBytes } from "@beep/infra-ci-runners/RunnerBootstrap";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Str from "effect/String";

const userData = (postInstall: string) =>
  renderRunnerUserData(
    RunnerUserDataInput.make({
      runnerTarballS3Url: "s3://beep-fleet-prod-binaries-832907639880/actions-runner-linux.tar.gz",
      runAs: "ec2-user",
      postInstall,
      ephemeral: true,
      jitConfig: true,
    })
  );

const bytes = (text: string) => new TextEncoder().encode(text).length;

const gunzip = (data: Uint8Array) =>
  Effect.promise(() => new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"))).text());

describe("CiRunners runner bootstrap", () => {
  it.effect("keeps the rendered user data under EC2's 16 KiB limit, which the inline script exceeds", () =>
    Effect.gen(function* () {
      const loader = yield* packPostInstall(runnerPostInstall);
      expect(bytes(userData(runnerPostInstall))).toBeGreaterThan(userDataLimitBytes);
      expect(bytes(userData(loader))).toBeLessThan(userDataLimitBytes);
    })
  );

  it.effect("unpacks to the exact post-install and sources it in the user data shell", () =>
    Effect.gen(function* () {
      const loader = yield* packPostInstall(runnerPostInstall);
      const lines = Str.split("\n")(loader);
      const payload = yield* Effect.fromOption(A.get(lines, 2));
      const packed = yield* Effect.fromResult(Base64.decode(payload));
      const unpacked = yield* gunzip(packed);
      expect(unpacked).toBe(runnerPostInstall);
      assertSome(A.get(lines, 5), '. "$beep_post_install"');
      const again = yield* packPostInstall(runnerPostInstall);
      expect(again).toBe(loader);
    })
  );
});
