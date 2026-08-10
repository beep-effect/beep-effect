# Opportunities

## Burst reaper kills busy workers mid-job

- **Work:** Post-merge main run for PR #633 on the manual burst fleet.
- **Friction:** The TTL reaper terminates on age alone, without checking
  whether the runner is executing a job. All three burst workers launched
  04:33Z were terminated at 06:05:19Z (TTL-90 plus reaper period) exactly 90
  seconds after the heavy lanes started on them: main run `31360612950` lost
  Check and Coverage Regression mid-step and cancelled Test Integration,
  turning an infrastructure event into a red main run needing manual
  relaunch-and-rerun.
- **Evidence:** Instances `i-047e8aef0ce1cb51b`, `i-0e13088d0c37de391`,
  `i-0b32615510035c84e`, all `User initiated (2026-08-10 06:05:19 GMT)`; job
  steps `Run verification lane` conclusion `cancelled` at 06:05:2x.
- **Proposal:** Retire the class via P2 cutover — the controller's scale-down
  only retires idle runners, and ephemeral one-job-one-VM workers cannot be
  reaped mid-job by design. If the burst path must live longer, teach the
  reaper to skip runners whose GitHub registration reports `busy` and sweep
  them on the next cycle instead.

## Prove worker east-west isolation with two live workers

- **Work:** P1 red-team review of the worker network-isolation evidence.
- **Friction:** A single worker probing an address with no known listener cannot
  distinguish security-group denial from the absence of a service, so it cannot
  honestly prove intra-VPC east-west isolation.
- **Evidence:** Gate C proves only tailnet/LAN denial; the P1 acceptance evidence
  records the worker security group's empty ingress list as the current
  east-west control evidence.
- **Proposal (P2):** Dispatch two workers concurrently. Have one open a listener
  and publish its private address through a per-run coordination channel, then
  have the second attempt to connect and require the connection to fail. Tear
  down both workers and the coordination record after the probe.

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

## The resource-weight ratchet inherits the beta.104 epistemic kill set

- **Work:** PR #607 (effect `4.0.0-beta.104` subtree refresh) — keeping the
  hosted heavy lanes alive on 16 GB runners while the fleet work landed.
- **Friction:** single cold compiles exceeded runner memory. Turbo concurrency
  was walked 4 → 3 → 2 → 1 across five heads and fully serial still died:
  `packages/epistemic/server` `tsc -b` alone killed a runner. Only the CLI-side
  advisory swap step plus serial lane caps (both stopgaps, landed in #607) got
  the PR green.
- **Evidence:** `explorations/graphnosis-prior-art/research/OPPORTUNITIES.md`
  (the beta.104 heavy-lane receipt, lines 35–52). The recurring kill set:
  `epistemic/server`, `epistemic/client`, `epistemic/ui`, `db-admin`,
  `ontology/client`, `tooling/tool/cli`, `apps/storybook`.
- **Proposal:** the resource-weight ratchet work (SPEC.md target surfaces,
  PLAN.md P5) should inherit this kill set as its first ranked target list —
  re-run the instantiation census post-beta.104 and drive the epistemic slice
  down first. This is the real fix behind the #607 stopgaps; the swap step and
  serial caps should be retired once the slice fits cold in runner memory.
