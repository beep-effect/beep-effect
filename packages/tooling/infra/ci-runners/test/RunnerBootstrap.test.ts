import { RunnerUserDataInput, renderRunnerUserData } from "@beep/alchemy-github-runners/RunnerUserData";
import { packPostInstall, runnerPostInstall, userDataLimitBytes } from "@beep/infra-ci-runners/RunnerBootstrap";
import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
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

const BashSpawner = BunChildProcessSpawner.layer.pipe(Layer.provide([BunFileSystem.layer, BunPath.layer]));

it.layer(BashSpawner)("CiRunners packed post-install in bash", (it) => {
  it.effect("writes the script, sources it into the same shell, and cleans up", () =>
    Effect.gen(function* () {
      const loader = yield* packPostInstall("fixture_value=sourced-into-this-shell\n");
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const output = yield* spawner.string(
        ChildProcess.make("bash", [
          "-e",
          "-c",
          `${loader}printf '%s|' "$fixture_value"; ls "$beep_post_install" 2>/dev/null || printf gone`,
        ])
      );
      expect(output).toBe("sourced-into-this-shell|gone");
    })
  );
});

const trapShimUnderStubbedAws = (postInstall: string) => {
  const snippet = O.getOrElse(
    O.map(
      O.fromNullishOr(/hook_exit_traps=\(\)[\s\S]*?unset -f trap/u.exec(userData(postInstall))),
      (match) => match[0]
    ),
    () => "exit 7"
  );
  return `aws() { echo "aws $*"; }\ninstance_id=i-0test\nregion=us-east-1\n${snippet}\necho body-done\n`;
};

it.layer(BashSpawner)("CiRunners runner EXIT traps in bash", (it) => {
  it.effect("runs every EXIT handler a post-install queues, even a failing one, then terminates the instance", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const run = (postInstall: string) =>
        spawner.string(ChildProcess.make("bash", ["-e", "-c", trapShimUnderStubbedAws(postInstall)]));
      const one = yield* run("trap 'echo hook-one' EXIT");
      expect(Str.split("\n")(Str.trim(one))).toStrictEqual([
        "body-done",
        "hook-one",
        "runner exited with status 0",
        "aws ec2 terminate-instances --instance-ids i-0test --region us-east-1",
      ]);
      const two = yield* run("trap 'echo hook-one; false' EXIT\ntrap 'echo hook-two' EXIT");
      expect(Str.split("\n")(Str.trim(two))).toStrictEqual([
        "body-done",
        "hook-one",
        "hook-two",
        "runner exited with status 0",
        "aws ec2 terminate-instances --instance-ids i-0test --region us-east-1",
      ]);
    })
  );
});

describe("CiRunners runner bootstrap", () => {
  it.effect("keeps the rendered user data under EC2's 16 KiB limit", () =>
    Effect.gen(function* () {
      const loader = yield* packPostInstall(runnerPostInstall);
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
