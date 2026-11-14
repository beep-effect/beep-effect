import { RunnerUserDataInput, renderRunnerUserData } from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import * as Str from "effect/String";

describe("renderRunnerUserData", () => {
  const script = renderRunnerUserData(
    RunnerUserDataInput.make({
      runnerTarballS3Url: "s3://binaries/actions-runner-linux.tar.gz",
      postInstall: "echo post",
    })
  );

  it("installs from the S3 mirror, consumes the one-use JIT config and terminates when done", () => {
    const has = (fragment: string) => Str.includes(fragment)(script);
    expect([
      has('aws s3 cp "s3://binaries/actions-runner-linux.tar.gz"'),
      has('aws ssm get-parameter --name "$token_path/$instance_id" --with-decryption'),
      has('aws ssm delete-parameter --name "$token_path/$instance_id"'),
      has('./run.sh --jitconfig "$config"'),
      has('aws ec2 terminate-instances --instance-ids "$instance_id"'),
      has("meta-data/tags/instance/ghr:token_path"),
      has("echo post"),
    ]).toStrictEqual([true, true, true, true, true, true, true]);
  });

  it("supports Amazon Linux and Ubuntu images and keeps post-install before the runner starts", () => {
    expect([Str.includes("dnf upgrade-minimal")(script), Str.includes("apt-get update")(script)]).toStrictEqual([
      true,
      true,
    ]);
    expect(/echo post[\s\S]*\.\/run\.sh/u.test(script)).toBe(true);
  });

  it("registers with config.sh and keeps the instance for non-ephemeral, non-JIT pools", () => {
    const persistent = renderRunnerUserData(
      RunnerUserDataInput.make({ runnerTarballS3Url: "s3://b/r.tar.gz", ephemeral: false, jitConfig: false })
    );
    expect([
      Str.includes("./config.sh --unattended")(persistent),
      Str.includes("terminate-instances")(persistent),
    ]).toStrictEqual([true, false]);
  });
});
