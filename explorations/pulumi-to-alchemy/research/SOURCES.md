# Pulumi to Alchemy — Sources & Provenance

- **Cluster / origin:** 2026-10-15 research stage following the merged TS7 exit
  #1833; source checkout `b536e1bba7c867c893e687562ece6c3a86536829`.
- **Provenance:** [CAPTURE.md](../CAPTURE.md), [RESEARCH.md](../RESEARCH.md),
  and [public fetch receipts](FETCHES.json). This is source research, not live
  infrastructure verification or an adoption decision. No code was ported.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| ALC-RUNTIME | Release manifest and launcher | alchemy-run/alchemy | `packages/alchemy/package.json`; `packages/alchemy/bin/cli.js:1`; `pnpm-workspace.yaml:212-249`, v2.0.0-beta.83 | Bun/Node, TS7 vs dev compiler exceptions | reference; future port-with-attribution only |
| ALC-STATE | Persistence/Redacted encoding | alchemy-run/alchemy | `packages/alchemy/src/State/StateEncoding.ts:63-83`; `LocalState.ts:150`; `PostgresState.ts:115`, v2.0.0-beta.83 | Secret persistence and locking | reference; future port-with-attribution only |
| ALC-COMMAND | Exec lifecycle | alchemy-run/alchemy | `packages/alchemy/src/Command/Exec.ts:88-127`, v2.0.0-beta.83 | Host-command success vs drift/delete | reference |
| ALC-AWS | Found and missing resource kinds | alchemy-run/alchemy | release recursive tree; individual sources listed in RESEARCH coverage matrix | Property-level parity not yet proven | reference |
| RUNNER-MODULE | Terraform composite wrapped by SDK | github-aws-runners/terraform-aws-github-runner | `infra/ci-runners/Pulumi.yaml:6-13` identifies 7.10.1; generated `module.ts:9-45` | Opaque runner lifecycle expansion | reference; MIT permits future port-with-attribution |
| PULUMI-API | Compiler shim and parser | pulumi/pulumi | `sdk/nodejs/typescript-shim.ts`; `sdk/nodejs/runtime/closure/parseFunction.ts` on fetched master | Isolated compiler dependency | reference |
| SST-PLATFORM | Platform package dependencies | anomalyco/sst | `platform/package.json`, fetched dev branch | Pulumi 3.215.0 and TS 5.7.2 | reference |
| CDKTF-SUNSET | Archived-tool notice | hashicorp/terraform-cdk | `README.md`, fetched main | No fresh migration recommendation | clean-room reference only |

**How these inform this packet:** runtime and manifest evidence qualify the TS7
claim; state and command implementations expose migration constraints that a
provider logo list misses. Resource coverage is checked against local constructors.
The runner module remains a composite gap. No upstream implementation is approved
for copying by this research artifact.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| alchemy-run/alchemy | Apache-2.0; actual LICENSE fetched | port-with-attribution; retain license/notices for any later port | Effect graph/provider/state patterns; no source copied |
| pulumi/pulumi | Apache-2.0; actual LICENSE fetched | port-with-attribution | Runtime/compiler requirement as reference |
| anomalyco/sst (sst/sst redirects) | MIT; LICENSE and canonical API fetched | port-with-attribution | Alternative dependency evidence only |
| github-aws-runners/terraform-aws-github-runner | MIT; API and v7.10.1 LICENSE.md fetched | port-with-attribution, retaining upstream notices | Existing runner composite boundary |
| hashicorp/terraform-cdk | MPL-2.0; actual LICENSE fetched | **clean-room reference only** under packet policy | Sunset/maintenance evidence |
| hashicorp/terraform | BUSL-1.1; actual current LICENSE fetched | **reference-only** pending applicable use-grant assessment | Maintained alternative; do not conflate with CDKTF |

Licenses describe the fetched repositories/files, not a transitive dependency
license audit. A missing or unverified license always falls back to reference-only.
All license-file/API URLs are in the fetched-source table below and cited at the
corresponding [RESEARCH.md](../RESEARCH.md) claims.

## 3. External research sources

Every row was fetched on **2026-10-15 UTC** using curl with a 30/40-second timeout.
The receipt records each full URL, exit code, size and SHA-256 for successful
responses. Mutable main/master/dev pages are dated observations; release-tag
sources and the non-truncated release tree anchor the coverage matrix. Failed
lookups establish no claim and their corrected sources are separately listed.

| ID | Fetched URL / source | curl exit | Use |
| --- | --- | --- | --- |
| E01 | [alchemy.run](https://alchemy.run) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E02 | [alchemy.run/getting-started](https://alchemy.run/getting-started) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E03 | [alchemy.run/state-store](https://alchemy.run/state-store) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E04 | [alchemy.run/environments/secrets](https://alchemy.run/environments/secrets) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E05 | [alchemy.run/command](https://alchemy.run/command) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E06 | [api.github.com/repos/alchemy-run/alchemy](https://api.github.com/repos/alchemy-run/alchemy) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E07 | [api.github.com/repos/alchemy-run/alchemy/releases/latest](https://api.github.com/repos/alchemy-run/alchemy/releases/latest) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E08 | [api.github.com/repos/alchemy-run/alchemy/commits/main](https://api.github.com/repos/alchemy-run/alchemy/commits/main) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E09 | [api.github.com/repos/alchemy-run/alchemy/git/trees/v2.0.0-beta.83?recursive=1](https://api.github.com/repos/alchemy-run/alchemy/git/trees/v2.0.0-beta.83?recursive=1) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E10 | [registry.npmjs.org/alchemy](https://registry.npmjs.org/alchemy) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E11 | [alchemy-run/alchemy/main/LICENSE](https://raw.githubusercontent.com/alchemy-run/alchemy/main/LICENSE) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E12 | [alchemy-run/alchemy/main/package.json](https://raw.githubusercontent.com/alchemy-run/alchemy/main/package.json) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E13 | [alchemy-run/alchemy/main/packages/alchemy/package.json](https://raw.githubusercontent.com/alchemy-run/alchemy/main/packages/alchemy/package.json) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E14 | [alchemy-run/alchemy/main/packages/node-utils/package.json](https://raw.githubusercontent.com/alchemy-run/alchemy/main/packages/node-utils/package.json) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E15 | [alchemy-run/alchemy/main/pnpm-workspace.yaml](https://raw.githubusercontent.com/alchemy-run/alchemy/main/pnpm-workspace.yaml) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E16 | [alchemy-run/alchemy/main/packages/alchemy/bin/cli.js](https://raw.githubusercontent.com/alchemy-run/alchemy/main/packages/alchemy/bin/cli.js) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E17 | [alchemy-run/alchemy/main/packages/alchemy/bin/register-oxc.js](https://raw.githubusercontent.com/alchemy-run/alchemy/main/packages/alchemy/bin/register-oxc.js) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E18 | [alchemy-run/alchemy/main/website/src/content/docs/getting-started.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/getting-started.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E19 | [alchemy-run/alchemy/main/website/src/content/docs/state-store/index.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/state-store/index.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E20 | [alchemy-run/alchemy/main/website/src/content/docs/state-store/custom-state-store.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/state-store/custom-state-store.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E21 | [alchemy-run/alchemy/main/website/src/content/docs/environments/secrets.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/environments/secrets.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E22 | [alchemy-run/alchemy/main/website/src/content/docs/environments/secret-providers.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/environments/secret-providers.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E23 | [alchemy-run/alchemy/main/website/src/content/docs/command/index.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/command/index.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E24 | [alchemy-run/alchemy/main/website/src/content/docs/infrastructure-as-code/resource.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/infrastructure-as-code/resource.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E25 | [alchemy-run/alchemy/main/website/src/content/docs/infrastructure-as-code/custom-provider.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/infrastructure-as-code/custom-provider.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E26 | [alchemy-run/alchemy/main/website/src/content/docs/aws/index.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/aws/index.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E27 | [alchemy-run/alchemy/main/website/src/content/docs/github/index.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/github/index.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E28 | [alchemy-run/alchemy/main/website/src/content/docs/docker/index.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/docker/index.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E29 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/package.json](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/package.json) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E30 | [alchemy-run/alchemy/v2.0.0-beta.83/pnpm-workspace.yaml](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/pnpm-workspace.yaml) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E31 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/bin/cli.js](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/bin/cli.js) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E32 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/StateEncoding.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/StateEncoding.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E33 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/LocalState.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/LocalState.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E34 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/Command/Exec.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/Command/Exec.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E35 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/S3/Bucket.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/S3/Bucket.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E36 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/CloudFront/Distribution.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/CloudFront/Distribution.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E37 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/IAM/Role.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/IAM/Role.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E38 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/AutoScaling/AutoScalingGroup.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/AutoScaling/AutoScalingGroup.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E39 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/SecretsManager/Secret.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/SecretsManager/Secret.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E40 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/Lambda/Function.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/Lambda/Function.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E41 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/Logs/LogGroup.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/Logs/LogGroup.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E42 | [pulumi/pulumi/master/LICENSE](https://raw.githubusercontent.com/pulumi/pulumi/master/LICENSE) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E43 | [pulumi/pulumi/master/sdk/nodejs/package.json](https://raw.githubusercontent.com/pulumi/pulumi/master/sdk/nodejs/package.json) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E44 | [pulumi/pulumi/master/sdk/nodejs/runtime/closure/parseFunction.ts](https://raw.githubusercontent.com/pulumi/pulumi/master/sdk/nodejs/runtime/closure/parseFunction.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E45 | [pulumi/pulumi/master/sdk/nodejs/typescript-shim.ts](https://raw.githubusercontent.com/pulumi/pulumi/master/sdk/nodejs/typescript-shim.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E46 | [sst/sst/dev/LICENSE](https://raw.githubusercontent.com/sst/sst/dev/LICENSE) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E47 | [sst/sst/dev/platform/package.json](https://raw.githubusercontent.com/sst/sst/dev/platform/package.json) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E48 | [api.github.com/repositories/285092252](https://api.github.com/repositories/285092252) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E49 | [hashicorp/terraform-cdk/main/README.md](https://raw.githubusercontent.com/hashicorp/terraform-cdk/main/README.md) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E50 | [hashicorp/terraform-cdk/main/LICENSE](https://raw.githubusercontent.com/hashicorp/terraform-cdk/main/LICENSE) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E51 | [api.github.com/repos/hashicorp/terraform-cdk](https://api.github.com/repos/hashicorp/terraform-cdk) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E52 | [hashicorp/terraform/main/LICENSE](https://raw.githubusercontent.com/hashicorp/terraform/main/LICENSE) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E53 | [api.github.com/repos/hashicorp/terraform/releases/latest](https://api.github.com/repos/hashicorp/terraform/releases/latest) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E54 | [alchemy-run/alchemy/main/alchemy/package.json](https://raw.githubusercontent.com/alchemy-run/alchemy/main/alchemy/package.json) | 22 | Failed lookup; no evidence inferred |
| E55 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/CloudWatchLogs/LogGroup.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/CloudWatchLogs/LogGroup.ts) | 22 | Failed lookup; no evidence inferred |
| E56 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EC2/SecurityGroupRule.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EC2/SecurityGroupRule.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E57 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EventBridge/Rule.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EventBridge/Rule.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E58 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/CostExplorer/UpdateCostAllocationTagsStatus.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/CostExplorer/UpdateCostAllocationTagsStatus.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E59 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EC2/FlowLog.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EC2/FlowLog.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E60 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/AutoScaling/LaunchTemplate.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/AutoScaling/LaunchTemplate.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E61 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/Cloudflare/DNS/Record.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/Cloudflare/DNS/Record.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E62 | [registry.terraform.io/v1/modules/github-aws-runners/github-runner/aws/7.10.1](https://registry.terraform.io/v1/modules/github-aws-runners/github-runner/aws/7.10.1) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E63 | [api.github.com/repos/github-aws-runners/terraform-aws-github-runner](https://api.github.com/repos/github-aws-runners/terraform-aws-github-runner) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E64 | [github-aws-runners/terraform-aws-github-runner/v7.10.1/LICENSE](https://raw.githubusercontent.com/github-aws-runners/terraform-aws-github-runner/v7.10.1/LICENSE) | 22 | Failed lookup; no evidence inferred |
| E65 | [alchemy-run/alchemy/v2.0.0-beta.83/website/src/content/docs/state-store/index.mdx](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/website/src/content/docs/state-store/index.mdx) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E66 | [alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/PostgresState.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/PostgresState.ts) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E67 | [api.github.com/repos/github-aws-runners/terraform-aws-github-runner/contents?ref=v7.10.1](https://api.github.com/repos/github-aws-runners/terraform-aws-github-runner/contents?ref=v7.10.1) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |
| E68 | [github-aws-runners/terraform-aws-github-runner/v7.10.1/LICENSE.md](https://raw.githubusercontent.com/github-aws-runners/terraform-aws-github-runner/v7.10.1/LICENSE.md) | 0 | Public source; see RESEARCH section/matrix and FETCHES.json |

## 4. In-repo capability references

| Package / source | Location | Disposition |
| --- | --- | --- |
| @beep/infra host plans | `infra/src/AIMetrics.ts:97-196`; `infra/src/OpenClaw.ts:710`, `:1205-2382` | **EXTRACT** pure render/generation behavior out of Pulumi-bearing modules |
| @beep/infra cloud declarations | `infra/src/CiRunners.ts:1249-1592`; `CiFleetController.ts:839-1069`; `CiTurboCache.ts:264-679`; `AccountCostControls.ts:138-228`; `OipWeb.ts:651-1123`; `Storybook.ts:323-391` | **REFERENCE** resource identity, behavior, conditions and retention |
| @pulumi/gharunners generated SDK | `infra/ci-runners/sdks/ghaRunners/module.ts:9-45`; `provider.ts:7-55` | **REFERENCE** current custom-resource/module boundary |
| Standalone cache Lambda | `infra/lambda/turbo-cache/README.md:3-26`; `package.json:8`; `build.sh:12-24` | **REUSE** artifact contract separately from IaC |
| @beep/repo-cli StepExec | `packages/tooling/tool/cli/src/internal/process/StepExec.ts:1073-1323` | **REUSE** bounded typed subprocess execution |
| @beep/repo-utils ProcessArgs | `packages/tooling/library/repo-utils/src/ProcessArgs.ts:131-270` | **REUSE** safe argv helpers |
| @beep/repo-cli systemd | `packages/tooling/tool/cli/src/internal/systemd/SystemdUnit.schemas.ts:101-161`; `SystemdUnit.ts:43-305` | **REUSE** validation, reading and parsing |
| @beep/repo-cli unit render/install flows | `commands/Graft/GraftDeep.service.ts:502-553`; `commands/Refs/Refs.service.ts:621-687`; `commands/Research/internal/Timers.ts:86-216` beneath CLI src | **EXTEND/EXTRACT** specialized flows |
| @beep/repo-ai-metrics | `packages/tooling/library/ai-metrics/src/install.ts:370-548`, `:1348-1413`; `forwarder.ts:790-966` | **REUSE** typed plans and pure timer rendering |
| @beep/openclaw | `packages/drivers/openclaw/src/OpenclawSystemd.service.ts:86-94`, `:229-252` | **REUSE/EXTEND** Effect systemctl boundary |
| @beep/repo-cli runners | `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:206-238`, `:821-911`; `Runners.command.ts:72-82` | **REUSE** AMI bake; config-pin suggestion is not deploy |
| @beep/repo-cli AI metrics | `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:1159` | **REFERENCE** existing apply remains dry-run-only |
| Compiler compatibility | `docs/runbooks/typescript-toolchain.md:185-211`; `syncpack.config.ts:174-212`; `patches/@pulumi%2Fpulumi@3.268.0.patch:10-33`; `package.json:419`, `:434` | **REFERENCE** remove only after runtime/build replacements |
| Independent classic consumers | `goals/schema-opaque-default/ops/codemod/codemod.ts:11`; `fixup.ts:35`; `scratchpad/.jsdoc-loop/census.ts:8` | **REFERENCE** separate TS6 exit obligation |
| Deployment/state receipts | `docs/runbooks/ci-runner-reliability.md:205-288`; `goals/oip-web-production-hardening/history/outputs/oip-state-bucket-rename-evidence.md:41-60`; `goals/ai-metrics-stack/history/outputs/p6a-closeout-proof-restart.md:34-44`; `goals/storybook-app/history/2026-06-07-implementation-verification.md:40-66`; `goals/openclaw-workstation-agent/README.md:51-54`, `:130-140` | **REFERENCE** dated proof, never current liveness |

**NOT FOUND / potentially NET-NEW:** first-party Alchemy integration, generic
reconciliation engine, generic shared systemd renderer package, Vercel Alchemy
provider, equivalent runner composite, cost-enrollment resources, managed KMS
grants, managed cost-tag resource, and Pulumi-to-Alchemy state migration proof.
See RESEARCH for the scope of each negative search; this ledger does not make
implementation choices.

## 5. Cross-links & provenance

- [Packet README](../README.md), [append-only capture](../CAPTURE.md),
  [research](../RESEARCH.md), [manifest](../ops/manifest.json).
- Trigger: merged TS7 migration #1833, source head recorded above. No goal has
  graduated from this packet; `links.goals` remains empty.
- The manifest `exploration.sources` registers this ledger. Its open questions
  mirror the unanswered align-stage frontier in RESEARCH.
- Local source search began with Graft and continued with targeted source/barrel,
  manifest/YAML, tracked-text, workflow and git-history inspection. Three bounded
  read-only research lanes covered stacks, TS6/reuse bricks, and alternatives.
- No implementation code, cloud proof, or independent migration review exists
  from this research stage. The source body fetches were summarized, not vendored.

## 6. 2026-11-02 refresh — sources added on reopen

Research reopened on checkout `cda8f0d199` (branch `claude/explore-pulumi-to-alchemy-40ee3a`,
base `main`). Coverage was re-verified against the **local Alchemy reference checkout**, not
from memory or the 10-15 release tree: `$HOME/YeeBois/references/effect/alchemy` at
`450702936d9b8e759f834da161cf7bfd1a4fe22f` (2026-11-01, `v2.0.0-beta.84` plus 246 commits;
provisioned by `bun run beep refs provision`, member `alchemy` in `scripts/references.json`).
Paths below are relative to `packages/` in that checkout. The checkout is ahead of the
published `latest` (`2.0.0-beta.84`, 2026-10-24), so any resource present in the checkout but
absent from the tag is **unreleased** until the next beta.

| ID | Source | Fetched / read | Use |
| --- | --- | --- | --- |
| E69 | [alchemy.run/llms.txt](https://alchemy.run/llms.txt) | 2026-11-02, curl 0, 96,940 bytes, sha in FETCHES.json | Provider/guide index: AWS, Cloudflare, GitHub, Docker, Command, state store; **no Vercel section** |
| E70 | [registry.npmjs.org/alchemy](https://registry.npmjs.org/alchemy) dist-tags | 2026-11-02 | `latest` 2.0.0-beta.84 (2026-10-24), `next` 2.0.0-beta.72 |
| E71 | [GitHub issue search: pulumi/pulumi "typescript 7" in title](https://api.github.com/search/issues?q=repo:pulumi/pulumi+typescript+7+in:title&per_page=10) | 2026-11-02 | 6 hits, none about TypeScript 7 support: no upstream TS7 work is tracked under that title |
| E72 | [pulumi/pulumi releases/latest](https://api.github.com/repos/pulumi/pulumi/releases/latest) | 2026-11-02 | v3.273.0, 2026-10-28; equals the repo catalog pin |
| E73 | [pulumi/pulumi sdk/nodejs/package.json (master)](https://raw.githubusercontent.com/pulumi/pulumi/master/sdk/nodejs/package.json) | 2026-11-02 | optional peer `typescript >= 3.8.3 < 7`, `ts-node >= 7.0.1 < 12` |
| L01 | Local checkout `alchemy/src/{State,Command,AdoptPolicy.ts}`, `aws/src/**`, `cloudflare/src/StateStore`, `hetzner/src/Ssh.ts`, `github/src`, `website/src/content/docs/cli/adopting-resources.mdx` | 2026-11-02 | Coverage matrix, state-store and adoption facts in RESEARCH 2026-11-02 |
| L02 | Installed `node_modules/@pulumi/pulumi@3.273.0` (`cmd/run/run.js:234-350`, `tsutils.js:29-60`, `typescript-shim.js`, `runtime/closure/*.js`) | 2026-11-02 | When Pulumi's Node runtime loads TypeScript (option C feasibility) |

Licenses are unchanged from section 2: Alchemy Apache-2.0 (checkout `LICENSE`), Pulumi
Apache-2.0, runner module MIT. No source was copied.

### In-repo capability references added 2026-11-02

| Package / source | Location | Disposition |
| --- | --- | --- |
| `@beep/beep-effect-web` Alchemy stack | `apps/beep-effect-web/alchemy.run.ts`; `.github/workflows/deploy-beep-effect-web.yml`; `goals/beep-effect-web-alchemy/{SPEC.md,history/*}` | **REUSE** the per-package stack shape, `Cloudflare.state()` + CI concurrency group, `op run` credential lane, and the recorded gotchas (workers.dev subdomain, token scopes) |
| r2-cache Alchemy stacks | `infra/r2-cache/alchemy.sh`, `alchemy.run.ts.template`, `alchemy.signed-credentials.ts.template`, `README.md` | **REFERENCE** a second live Alchemy pattern: frozen tool clone, local state under `$HOME/.local/state/beep`, token resources kept out of outputs |
| TS6 isolation | `infra/pulumi-typescript6.cjs`; `infra/*/Pulumi.yaml` `runtime.options.nodeargs`; `syncpack.config.ts:153-163`; root `package.json` `infra:prepare-gha-runners` + `postinstall` | **REFERENCE** what option C removes |
| ghaRunners SDK build guard | `infra/ci-runners/sdks/ghaRunners/scripts/build.js:26-41` (`majorVersion !== 6` throws) | **CHANGE CANDIDATE** repo-authored guard, not an upstream requirement |
| Sixth Pulumi program | `infra/turbo-cache-lab/Pulumi.yaml`, `lab-aws.sh`; `infra/src/internal/turbo-cache-lab-entry.ts` | **REFERENCE** disposable lab reusing `CiTurboCache`; wraps `pulumi stack init/config set` |
| CiTurboCache additions since 10-15 | `infra/src/CiTurboCache.ts` (`aws.sns.Topic`, `aws.sns.TopicSubscription`, `aws.cloudwatch.MetricAlarm`; PR #2252) | **REFERENCE** the 10-15 count of 30 is stale |
