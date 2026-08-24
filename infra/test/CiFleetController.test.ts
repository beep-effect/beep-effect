import { CiFleetController, CiFleetControllerPulumiConfigValues, makeCiFleetControllerConfig } from "@beep/infra";
import { O, Str } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import * as pulumi from "@pulumi/pulumi";
import { Effect, MutableHashMap, pipe, Result } from "effect";
import * as S from "effect/Schema";

const validConfigValues = {
  githubAppIdSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/id",
  githubAppKeyBase64SsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/key",
  githubAppKmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
  githubAppWebhookSecretSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/webhook-secret",
  runnerBinariesSyncerLambdaZip: "/artifacts/runner-binaries-syncer.zip",
  runnerRolePermissionsBoundaryArn: "arn:aws:iam::123456789012:policy/beep-ci-fleet-boundary",
  runnersLambdaZip: "/artifacts/runners.zip",
  terminationWatcherLambdaZip: "/artifacts/termination-watcher.zip",
  webhookLambdaZip: "/artifacts/webhook.zip",
};

const decodeConfigValues = S.decodeUnknownResult(CiFleetControllerPulumiConfigValues);
const decodePolicyDocument = S.decodeUnknownResult(S.fromJsonString(S.Unknown));
const isString = S.is(S.String);

const assertSubstringBefore = (text: string, before: string, after: string): void => {
  const beforeIndex = Str.indexOf(before)(text);
  const afterIndex = Str.indexOf(after)(text);
  assert.isTrue(O.isSome(beforeIndex));
  assert.isTrue(O.isSome(afterIndex));
  if (O.isSome(beforeIndex) && O.isSome(afterIndex)) {
    assert.isTrue(beforeIndex.value < afterIndex.value);
  }
};

describe("@beep/infra CiFleetController", () => {
  it("accepts AWS ARNs and rejects malformed values", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, githubAppKmsKeyArn: "not-an-arn" }))).toBe(true);
  });

  it("accepts SSM parameter ARNs and rejects other ARN kinds", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          githubAppIdSsmParameterArn: "arn:aws:iam::123456789012:role/not-an-ssm-parameter",
        })
      )
    ).toBe(true);
  });

  it("accepts absolute ZIP paths and rejects relative or non-ZIP paths", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({ ...validConfigValues, runnerBinariesSyncerLambdaZip: "artifacts/syncer.zip" })
      )
    ).toBe(true);
    expect(
      Result.isFailure(decodeConfigValues({ ...validConfigValues, runnerBinariesSyncerLambdaZip: "/artifacts/syncer" }))
    ).toBe(true);
  });

  it("accepts runner labels and rejects empty, spaced, or overlong labels", () => {
    expect(Result.isSuccess(decodeConfigValues({ ...validConfigValues, runnerLabel: "beep_runner-shadow" }))).toBe(
      true
    );
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, runnerLabel: "" }))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, runnerLabel: "beep runner" }))).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          runnerLabel: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        })
      )
    ).toBe(true);
  });

  it("accepts absolute AMI SSM parameter paths and rejects relative paths", () => {
    expect(
      Result.isSuccess(
        decodeConfigValues({
          ...validConfigValues,
          amiSsmParameterName: "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          amiSsmParameterName: "aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
        })
      )
    ).toBe(true);
  });

  it("decodes complete Pulumi config values", () => {
    const result = decodeConfigValues({ ...validConfigValues, runnerLabel: "beep-custom-shadow" });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.githubAppKmsKeyArn).toBe(validConfigValues.githubAppKmsKeyArn);
      expect(result.success.runnerLabel).toBe("beep-custom-shadow");
      expect(result.success.webhookLambdaZip).toBe(validConfigValues.webhookLambdaZip);
    }
  });

  it("defaults the runner label when absent and honors an explicit label", () => {
    const withoutLabel = decodeConfigValues(validConfigValues);
    const withLabel = decodeConfigValues({ ...validConfigValues, runnerLabel: "beep-custom-shadow" });

    expect(Result.isSuccess(withoutLabel)).toBe(true);
    expect(Result.isSuccess(withLabel)).toBe(true);
    if (Result.isSuccess(withoutLabel) && Result.isSuccess(withLabel)) {
      expect(makeCiFleetControllerConfig(withoutLabel.success).runnerLabel).toBe("beep-ec2-heavy");
      expect(makeCiFleetControllerConfig(withLabel.success).runnerLabel).toBe("beep-custom-shadow");
    }
  });

  it("defaults the controller AMI SSM parameter when absent", () => {
    const result = decodeConfigValues(validConfigValues);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const config = makeCiFleetControllerConfig(result.success);
      expect(O.isNone(config.amiId)).toBe(true);
      expect(config.amiSsmParameterName).toBe("/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64");
    }
  });

  it("honors an explicit controller AMI id instead of the SSM default", () => {
    const result = decodeConfigValues({ ...validConfigValues, amiId: "ami-07a5b367e8dc8bd92" });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(O.getOrUndefined(makeCiFleetControllerConfig(result.success).amiId)).toBe("ami-07a5b367e8dc8bd92");
    }
  });

  it("rejects malformed controller AMI ids", () => {
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, amiId: "latest" }))).toBe(true);
  });

  it.effect(
    "wires the fail-closed workload identity boundary before runner startup",
    Effect.fnUntraced(function* () {
      const modulePostInstall = MutableHashMap.empty<string, string>();
      const moduleManagedPolicyArns = MutableHashMap.empty<string, unknown>();
      const moduleMetadataOptions = MutableHashMap.empty<string, unknown>();
      const policyDocuments = MutableHashMap.empty<string, string>();

      yield* Effect.acquireUseRelease(
        Effect.tryPromise(() =>
          pulumi.runtime.setMocks(
            {
              call: () => ({ accountId: "123456789012", partition: "aws" }),
              newResource: (args) => {
                const postInstall = args.inputs.userdata_post_install;
                if (args.type === "ghaRunners:index:Module" && isString(postInstall)) {
                  MutableHashMap.set(modulePostInstall, args.name, postInstall);
                  MutableHashMap.set(
                    moduleManagedPolicyArns,
                    args.name,
                    args.inputs.runner_iam_role_managed_policy_arns
                  );
                  MutableHashMap.set(moduleMetadataOptions, args.name, args.inputs.runner_metadata_options);
                }
                const policy = args.inputs.policy;
                if (args.type === "aws:iam/policy:Policy" && isString(policy)) {
                  MutableHashMap.set(policyDocuments, args.name, policy);
                  return {
                    id: `${args.name}-id`,
                    state: {
                      ...args.inputs,
                      arn: "arn:aws:iam::123456789012:policy/beep-ci-runner-imds-disable",
                    },
                  };
                }
                return { id: `${args.name}-id`, state: args.inputs };
              },
            },
            "beep-effect",
            "test"
          )
        ),
        () =>
          Effect.sync(() => {
            new CiFleetController("ci-fleet-controller-test", {
              config: makeCiFleetControllerConfig(
                CiFleetControllerPulumiConfigValues.make({
                  ...validConfigValues,
                  amiId: "ami-07a5b367e8dc8bd92",
                })
              ),
              region: "us-east-1",
              subnetIds: ["subnet-abc"],
              vpcId: "vpc-123",
              workerSecurityGroupId: "sg-456",
            });
          }),
        () => Effect.tryPromise(() => pulumi.runtime.disconnect())
      );

      const captured = MutableHashMap.get(modulePostInstall, "ci-fleet-controller-test");
      const capturedManagedPolicyArns = MutableHashMap.get(moduleManagedPolicyArns, "ci-fleet-controller-test");
      const capturedMetadataOptions = MutableHashMap.get(moduleMetadataOptions, "ci-fleet-controller-test");
      const capturedPolicy = MutableHashMap.get(policyDocuments, "ci-fleet-controller-test-runner-imds-disable");
      assert.isTrue(O.isSome(captured));
      assert.isTrue(O.isSome(capturedManagedPolicyArns));
      assert.isTrue(O.isSome(capturedMetadataOptions));
      assert.isTrue(O.isSome(capturedPolicy));
      if (
        O.isNone(captured) ||
        O.isNone(capturedManagedPolicyArns) ||
        O.isNone(capturedMetadataOptions) ||
        O.isNone(capturedPolicy)
      ) {
        return;
      }

      const postInstall = captured.value;
      expect(capturedManagedPolicyArns.value).toEqual(["arn:aws:iam::123456789012:policy/beep-ci-runner-imds-disable"]);
      expect(capturedMetadataOptions.value).toEqual({
        http_endpoint: "enabled",
        http_put_response_hop_limit: 1,
        http_tokens: "required",
        instance_metadata_tags: "enabled",
      });
      const decodedPolicy = decodePolicyDocument(capturedPolicy.value);
      assert.isTrue(Result.isSuccess(decodedPolicy));
      if (Result.isSuccess(decodedPolicy)) {
        expect(decodedPolicy.success).toEqual({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "DisableOwnMetadataEndpointWhileEnabled",
              Effect: "Allow",
              Action: "ec2:ModifyInstanceMetadataOptions",
              Resource: "arn:aws:ec2:*:*:instance/*",
              Condition: {
                ArnEquals: {
                  "ec2:SourceInstanceARN": "arn:aws:ec2:*:*:instance/${ec2:InstanceID}",
                },
                StringEquals: {
                  "ec2:MetadataHttpEndpoint": "enabled",
                },
              },
            },
          ],
        });
      }
      // The toolbelt install must stay marker-gated and fail open: the baked
      // image stamps /etc/beep-ci/baked-runner, an unbaked boot installs.
      assert.isTrue(Str.includes("if [ -f /etc/beep-ci/baked-runner ]; then")(postInstall));
      assertSubstringBefore(
        postInstall,
        "if [ -f /etc/beep-ci/baked-runner ]; then",
        "dnf install -y git unzip zip jq"
      );
      assertSubstringBefore(postInstall, "baked runner image; toolbelt already present", "else");
      assert.isTrue(Str.includes("(\n  set -eu\n  dnf install -y iptables-nft")(postInstall));
      assertSubstringBefore(postInstall, "dnf install -y iptables-nft", "command -v iptables");
      assertSubstringBefore(postInstall, "command -v iptables", "iptables --version | grep -Fq 'nf_tables'");
      assertSubstringBefore(postInstall, "iptables -m owner --help", "cat > /opt/beep/imds-job-started.sh");
      assertSubstringBefore(
        postInstall,
        "cat > /opt/beep/imds-job-started.sh",
        "ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/beep/imds-job-started-hook.sh"
      );
      assert.isTrue(Str.includes("#!/usr/bin/env bash\nset -eu\nrunner_uid=")(postInstall));
      assert.isTrue(Str.includes("exec sudo /opt/beep/imds-job-started.sh")(postInstall));
      assert.isTrue(Str.includes("ec2-user ALL=(root) NOPASSWD: /opt/beep/imds-job-started.sh")(postInstall));
      assert.isTrue(Str.includes("ec2-user ALL=(root) NOPASSWD: /opt/beep/imds-disable.sh")(postInstall));
      assert.isTrue(Str.includes("ec2-user ALL=(root) NOPASSWD: /opt/beep/self-poweroff.sh")(postInstall));
      assertSubstringBefore(
        postInstall,
        "chmod 0440 /etc/sudoers.d/beep-imds-boundary",
        "visudo -cf /etc/sudoers.d/beep-imds-boundary"
      );
      assertSubstringBefore(
        postInstall,
        "aws ec2 modify-instance-metadata-options",
        "IPv4 and IPv6 IMDS probes both failed for $denial_streak consecutive checks; testing metadata-options lock"
      );
      assertSubstringBefore(
        postInstall,
        "mv /opt/actions-runner/run.sh /opt/actions-runner/run.module.sh",
        "cat > /opt/actions-runner/run.sh"
      );
      assertSubstringBefore(postInstall, "sudo /opt/beep/imds-disable.sh", 'if ./run.module.sh "$@"; then');
      assert.isTrue(
        Str.includes(
          'beep_log beep-runner-shim "module runner exited with status $runner_status; powering off"\n' +
            "if ! sudo /opt/beep/self-poweroff.sh; then\n" +
            '  beep_log beep-runner-shim "poweroff failed after runner exit"'
        )(postInstall)
      );
      assert.isTrue(
        Str.includes('iptables -C OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "$${runner_uid}" -j DROP')(
          postInstall
        )
      );
      assert.isTrue(
        Str.includes('|| iptables -A OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "$${runner_uid}" -j DROP')(
          postInstall
        )
      );
      // Terraform parses `.tf.json` strings as HCL templates: the module-bound
      // value may carry no unescaped `${`/`%{`, and rendering `$${` back to
      // `${` must reproduce the original bash byte-identically.
      expect(postInstall).not.toMatch(/(?<!\$)\$\{/u);
      expect(postInstall).not.toMatch(/(?<!%)%\{/u);
      const rendered = pipe(postInstall, Str.replaceAll("$${", "${"), Str.replaceAll("%%{", "%{"));
      const beepLogFunction =
        'beep_log() { logger -t "$1" -- "$2"; printf \'%s %s: %s\\n\' "$(date -u +%FT%TZ)" "$1" "$2" > /dev/console 2>/dev/null || true; }';
      assert.isTrue(Str.includes(`(\n  set -eu\n  ${beepLogFunction}`)(rendered));
      assert.isTrue(
        Str.includes(`#!/usr/bin/env bash\nset -eu\n\n${beepLogFunction}\nbeep_exit_reason="helper exited`)(rendered)
      );
      assert.isTrue(
        Str.includes(
          `#!/usr/bin/env bash\nset -eu\n${beepLogFunction}\nbeep_log beep-self-poweroff "powering off ephemeral runner"`
        )(rendered)
      );
      assert.isTrue(
        Str.includes(`#!/usr/bin/env bash\nset -eu\n\n${beepLogFunction}\n\nif ! sudo /opt/beep/imds-disable.sh; then`)(
          rendered
        )
      );
      expect(rendered).not.toMatch(
        /logger -t (?:beep-imds-disable|beep-imds-edges|beep-runner-shim|beep-self-poweroff)/u
      );
      assert.isTrue(
        Str.includes('iptables -C OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "${runner_uid}" -j DROP')(rendered)
      );
      assert.isTrue(Str.includes('if [ -d "${runner_dir}" ]; then')(rendered));
      assert.isTrue(Str.includes('if [ "${hook_armed}" = false ]; then')(rendered));
      assert.isTrue(
        Str.includes(
          'aws ec2 modify-instance-metadata-options \\\n  --instance-id "$instance_id" \\\n  --http-endpoint disabled \\\n  --region "$region"'
        )(rendered)
      );
      assert.isTrue(Str.includes('edge_error_file="$(mktemp /tmp/beep-imds-edges.XXXXXX)"')(rendered));
      assert.isTrue(Str.includes('>/dev/null 2>"$edge_error_file"')(rendered));
      assert.isTrue(Str.includes("grep -oE '\\([A-Za-z0-9._-]+\\)'")(rendered));
      assert.isTrue(Str.includes("aws ec2 modify-instance-metadata-options \\\n    --dry-run")(rendered));
      assert.isTrue(Str.includes('self_disable_code="$(imds_edge_dry_run "$instance_id" disabled)"')(rendered));
      assert.isTrue(Str.includes('other_disable_code="$(imds_edge_dry_run i-0f0f0f0f0f0f0f0f0 disabled)"')(rendered));
      assert.isTrue(
        Str.includes('self_reenable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" enabled)"')(
          rendered
        )
      );
      assert.isTrue(
        Str.includes('self_redisable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" disabled)"')(
          rendered
        )
      );
      assert.isTrue(Str.includes('beep_log beep-imds-edges "IMDS_EDGE self_disable: PASS"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-edges "IMDS_EDGE self_reenable: PASS"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-edges "IMDS_EDGE self_redisable: PASS"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-edges "IMDS_EDGE other_disable: PASS"')(rendered));
      assert.isTrue(
        Str.includes(
          'case "$self_disable_code" in\n' +
            '  DryRunOperation) beep_log beep-imds-edges "IMDS_EDGE self_disable: PASS" ;;\n' +
            '  *) beep_exit_reason="IMDS_EDGE self_disable failed ($self_disable_code)"; beep_log beep-imds-edges "IMDS_EDGE self_disable: FAIL ($self_disable_code)"; exit 1 ;;\n' +
            "esac"
        )(rendered)
      );
      assert.isTrue(
        Str.includes(
          'case "$self_reenable_code" in\n' +
            '  UnauthorizedOperation) beep_log beep-imds-edges "IMDS_EDGE self_reenable: PASS" ;;\n' +
            '  *) beep_exit_reason="IMDS_EDGE self_reenable failed ($self_reenable_code)"; beep_log beep-imds-edges "IMDS_EDGE self_reenable: FAIL ($self_reenable_code)"; discard_cached_credentials; exit 1 ;;\n' +
            "esac"
        )(rendered)
      );
      assert.isTrue(
        Str.includes(
          'case "$self_redisable_code" in\n' +
            '  UnauthorizedOperation) beep_log beep-imds-edges "IMDS_EDGE self_redisable: PASS" ;;\n' +
            '  *) beep_exit_reason="IMDS_EDGE self_redisable failed ($self_redisable_code)"; beep_log beep-imds-edges "IMDS_EDGE self_redisable: FAIL ($self_redisable_code)"; discard_cached_credentials; exit 1 ;;\n' +
            "esac"
        )(rendered)
      );
      assert.isTrue(
        Str.includes(
          'case "$other_disable_code" in\n' +
            '  UnauthorizedOperation) beep_log beep-imds-edges "IMDS_EDGE other_disable: PASS" ;;\n' +
            "  InvalidInstanceID.NotFound|InvalidInstanceID.Malformed)\n" +
            '    beep_log beep-imds-edges "IMDS_EDGE other_disable: INCONCLUSIVE ($other_disable_code)" ;;\n' +
            '  *) beep_exit_reason="IMDS_EDGE other_disable failed ($other_disable_code)"; beep_log beep-imds-edges "IMDS_EDGE other_disable: FAIL ($other_disable_code)"; exit 1 ;;\n' +
            "esac"
        )(rendered)
      );
      assertSubstringBefore(
        rendered,
        'self_disable_code="$(imds_edge_dry_run "$instance_id" disabled)"',
        'aws ec2 modify-instance-metadata-options \\\n  --instance-id "$instance_id"'
      );
      assertSubstringBefore(
        rendered,
        'other_disable_code="$(imds_edge_dry_run i-0f0f0f0f0f0f0f0f0 disabled)"',
        'aws ec2 modify-instance-metadata-options \\\n  --instance-id "$instance_id"'
      );
      assertSubstringBefore(
        rendered,
        'role_name="$(curl --noproxy',
        'aws ec2 modify-instance-metadata-options \\\n  --instance-id "$instance_id"'
      );
      assertSubstringBefore(
        rendered,
        'cached_session_token="$(printf',
        'aws ec2 modify-instance-metadata-options \\\n  --instance-id "$instance_id"'
      );
      assertSubstringBefore(
        rendered,
        "IPv4 and IPv6 IMDS probes both failed for $denial_streak consecutive checks; testing metadata-options lock",
        'self_reenable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" enabled)"'
      );
      assertSubstringBefore(
        rendered,
        "IPv4 and IPv6 IMDS probes both failed for $denial_streak consecutive checks; testing metadata-options lock",
        'self_redisable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" disabled)"'
      );
      assertSubstringBefore(
        rendered,
        'self_reenable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" enabled)"',
        'self_redisable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" disabled)"'
      );
      assert.isTrue(
        Str.includes(
          'env \\\n    AWS_ACCESS_KEY_ID="$cached_access_key_id" \\\n    AWS_SECRET_ACCESS_KEY="$cached_secret_access_key" \\\n    AWS_SESSION_TOKEN="$cached_session_token"'
        )(rendered)
      );
      assert.isTrue(
        Str.includes(
          "unset cached_access_key_id cached_secret_access_key cached_session_token\n" +
            '  beep_log beep-imds-disable "cached credentials discarded"'
        )(rendered)
      );
      expect(rendered).not.toMatch(
        /beep_log[^\n]*\$(?:cached_access_key_id|cached_secret_access_key|cached_session_token|role_credentials_json)/u
      );
      assert.isTrue(Str.includes("modify_exit_code=$?")(rendered));
      assert.isTrue(
        Str.includes(
          "modify_error_code=\"$(grep -oE '\\([A-Za-z0-9._-]+\\)' \"$edge_error_file\" | head -n 1 | tr -d '()' || true)\""
        )(rendered)
      );
      assert.isTrue(
        Str.includes(
          "beep_log beep-imds-disable \\\n" +
            '    "disable request failed ($modify_error_code, exit=$modify_exit_code); failing closed"\n' +
            "  exit 1"
        )(rendered)
      );
      assert.isTrue(Str.includes('beep_log beep-imds-disable "command -v aws: $aws_path"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-disable "aws --version: $aws_version_line"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-disable "command -v jq: $jq_path"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-disable "id -u: $(id -u)"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-disable "IMDSv2 bootstrap token obtained"')(rendered));
      assert.isTrue(
        Str.includes(
          'beep_log beep-imds-disable "instance id + region resolved: instance_id=$instance_id region=$region"'
        )(rendered)
      );
      assert.isTrue(Str.includes('beep_log beep-imds-edges "AWS CLI stderr: $aws_error_line"')(rendered));
      assert.isTrue(Str.includes('beep_log beep-imds-disable "AWS CLI stderr: $aws_error_line"')(rendered));
      assert.isTrue(
        Str.includes('beep_log beep-imds-disable "final exit: status=$exit_code reason=$beep_exit_reason"')(rendered)
      );
      assert.isTrue(Str.includes("http://169.254.169.254/latest/api/token")(rendered));
      assert.isTrue(Str.includes("'http://[fd00:ec2::254]/latest/api/token'")(rendered));
      assert.isTrue(Str.includes("deadline=$(( $(date +%s) + 90 ))")(rendered));
      assert.isTrue(Str.includes("required_denial_streak=5")(rendered));
      assert.isTrue(Str.includes("denial_streak=0")(rendered));
      assert.isTrue(Str.includes('if [ "$ipv4_reachable" = false ] && [ "$ipv6_reachable" = false ]; then')(rendered));
      assert.isTrue(Str.includes("denial_streak=$(( denial_streak + 1 ))\n  else\n    denial_streak=0")(rendered));
      assert.isTrue(
        Str.includes('"IMDS reachability: ipv4=$ipv4_reachable ipv6=$ipv6_reachable streak=$denial_streak"')(rendered)
      );
      assert.isTrue(Str.includes('if [ "$denial_streak" -ge "$required_denial_streak" ]; then')(rendered));
      assertSubstringBefore(
        rendered,
        'if [ "$(date +%s)" -ge "$deadline" ]; then',
        'if [ "$denial_streak" -ge "$required_denial_streak" ]; then'
      );
      assert.isTrue(Str.includes("if ! sudo /opt/beep/imds-disable.sh; then")(rendered));
      assertSubstringBefore(
        rendered,
        'beep_log beep-runner-shim "HOLDING 240s for console capture"\n  sleep 240',
        "sudo /opt/beep/self-poweroff.sh"
      );
      assertSubstringBefore(rendered, "sleep 240", 'if ./run.module.sh "$@"; then');
      assert.isTrue(Str.includes('if ./run.module.sh "$@"; then')(rendered));
      assert.isTrue(Str.includes('exit "$runner_status"')(rendered));
      assert.isTrue(
        Str.includes(
          'beep_log beep-runner-shim "visudo failed for IMDS boundary sudoers (exit=$visudo_status); aborting post-install"'
        )(rendered)
      );
      assert.isTrue(
        Str.includes('logger -t beep-imds-hook "runner directory not found; per-job IMDS hook NOT armed"\n    exit 1')(
          rendered
        )
      );
    })
  );
});
