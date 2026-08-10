# Opportunities

## Generated-path exclusions need one source of truth

- **Work:** Landing the generated Pulumi bridge SDK at
  `infra/ci-runners/sdks/ghaRunners`.
- **Friction:** The generated tree required nine separate per-tool exclusions:
  `biome.jsonc`, `_typos.toml`, `knip.jsonc`, `.fallowrc.jsonc`
  `ignorePatterns`, removal of dead Sherif config, the tsconfig-sync collector
  ignore, a SAST lane filter in `Quality.command.ts` because explicit targets
  bypass `.semgrepignore`, `isExcludedTypeScriptSourcePath` for the
  schema-first and native-runtime laws, and `DocsESLintConfig` globs.
- **Evidence:** PR #632.
- **Proposal:** Add one generated-path registry (a single JSON or TypeScript
  source of truth) consumed by every quality tool, so generated or vendored
  trees require one entry instead of nine.

## Ephemeral workers ship no boot log, so every defect is inferred

- **Work:** P1 shadow acceptance — proving one-job-one-VM birth and teardown on
  the `beep-ec2-heavy-shadow` label.
- **Friction:** Three stacked defects each presented as the same symptom — a
  runner registering `offline` and vanishing about five minutes later — because
  a controller worker emits no readable log anywhere. `enable_cloudwatch_agent`
  is `false` in `infra/src/CiFleetController.ts`, so no log group exists;
  `aws ec2 get-console-output` returned empty for every instance, including
  with `--latest`; and the worker self-terminates at the boot timeout, so there
  is no live host to inspect. Each defect cost a full launch-to-reap cycle to
  surface, and the decisive evidence for the last one was not a log at all — it
  was reading VPC flow logs and noticing sustained HTTPS to S3 and SSM with
  **zero** packets to GitHub, which localized the failure to the window between
  config-fetch and agent-start.
- **Evidence:** Instances `i-0533baf5ee9a2a6d1` (02:53:12Z→02:58:34Z) and
  `i-08678a0d59c0ed39a` (03:12:12Z→03:17:34Z), both terminated
  `Client.UserInitiatedShutdown` having never come online. Defects: boundary
  `iam:PassRole` pattern `*gha*` vs actual role `beep-ci/beep-ci-runner-*`;
  Ubuntu AMI under a `dnf`-only user-data template; `runner_run_as: ubuntu` on
  an image whose only user is `ec2-user`. Roughly an hour of inference for
  findings a boot log would have stated outright.
- **Proposal (P2):** Ship runner logs. Set `enable_cloudwatch_agent: true` and
  configure `runner_log_files` to carry the user-data log and the runner's
  `_diag` output into a dedicated log group.

  Two constraints that make this a design task rather than a flag flip:

  1. **Do not reach for `enable_user_data_debug_logging_runner`.** It turns on
     `set -x` in the boot script, which echoes the JIT registration config — a
     live credential — into the instance console log, readable by anyone
     holding `ec2:GetConsoleOutput`. If boot tracing is ever needed, enable it
     for a single diagnostic run and revert in the same session.
  2. **The CloudWatch agent expands the worker's IAM**, which cuts against the
     boundary work this packet exists to prove. The runner role currently holds
     five narrowly scoped inline policies; log shipping adds
     `logs:CreateLogStream` and `logs:PutLogEvents`. Scope those to the single
     runner log-group ARN — never `logs:*` on `*` — and re-run the red-team
     gates afterwards, since the trust claim changes.

  Validate on the shadow label before the `beep-ec2-heavy` cutover, and confirm
  the shipped logs contain no JIT config before treating the group as durable.
