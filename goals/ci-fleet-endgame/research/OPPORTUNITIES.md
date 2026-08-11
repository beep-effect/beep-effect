# Opportunities

## AL2023 does not guarantee iptables in the standard AMI

- **Work:** Adding the post-install host-IMDS OWNER rule to the AL2023 runner.
- **Friction:** The AL2023 package repository provides the nft-backed
  `iptables-nft` compatibility package, but the standard-AMI package comparison
  does not list `iptables` as preinstalled. Relying on another installer to
  pull it transitively would make this security control image-dependent.
- **Evidence:** Amazon Linux's package inventory lists `iptables-nft` for x86_64,
  while its standard AL2-to-AL2023 AMI comparison shows `iptables` only on the
  AL2 side.
- **Proposal:** Security userdata that needs the compatibility command should
  conditionally install `iptables-nft` before applying rules, as this controller
  hook now does.

## Interactive zsh startup noise obscures verification output

- **Work:** Running the P2 controller hardening's four required verification
  commands through `zsh -ic`.
- **Friction:** Every command emitted non-fatal interactive-shell diagnostics
  before the actual tool output, making clean pass/fail evidence harder to read.
- **Evidence:** The repeated startup output included `can't change option: zle`,
  `can't change option: monitor`, and `gitstatus failed to initialize`; all four
  requested commands nevertheless exited 0.
- **Proposal:** Skip prompt and gitstatus initialization when interactive zsh
  has no TTY, so automation using the repository's documented `zsh -ic`
  commands produces only verification output.

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

## Commitlint on the PR merge ref inherits every base-range violation

- **Work:** PR #654 second review round — the hosted Commitlint check went red
  immediately after the first fix-round push.
- **Friction:** the lane lints `--from <merge-base> --to HEAD` on the synthetic
  PR merge ref, so its range contains every `main` commit merged since the
  branch forked. The red run's only violations were on `main`'s own #651
  squash header (102 chars) plus its footer line — commits this branch never
  authored and cannot rewrite. Attribution cost a log dig through interleaved
  commit bodies before it was clear nothing local was wrong; the only fix is
  merging `origin/main` so the merge-base advances past the offender, which
  couples an unrelated sync commit to check greenness.
- **Evidence:** run 31443081050 (`header must not be longer than 100
  characters, current length is 102` against `e92b8b7d9d`, PR #651's squash
  header) on a branch whose own commits all pass.
- **Proposal:** two candidate fixes, either sufficient: (a) lint only the
  PR-authored range — on the synthetic merge commit the FIRST parent is the
  updated base and the PR head is the SECOND parent, so `--first-parent`
  traversal would keep the inherited `main` commits and drop the authored
  ones; select the second parent explicitly and lint
  `merge-base..<head-parent>`; (b) enforce the squash-header length
  server-side at merge time (the repo already treats merge messages as
  commitlint input in prose, but #651 proves nothing gates it), so `main` can
  never carry a header that poisons downstream PR ranges.

## Host IMDS block shares the runner-agent uid — deploy needs a probe gate

- **Work:** P2 controller hardening — adding the CSF-003 host IMDS mitigation.
- **Risk (not yet friction):** the OWNER-match DROP keys on the `ec2-user`
  uid, and the runner AGENT also runs as `ec2-user` (`runner_run_as`). The
  mitigation is safe only because the instance-profile role is consumed by
  boot-time root steps (AMI SSM resolution, binary sync) and runtime IMDS
  consumers are off (`enable_cloudwatch_agent: false`,
  `enable_ssm_on_runners: false`), so the agent's poll loop uses its JIT token,
  not IMDS. This is the canonical github-aws-runners pattern, but it is a
  runtime property the code cannot prove.
- **Required deploy gate (red-team Gate E):** the first `pulumi up` carrying
  this change must be followed by a probe job on the shadow label that proves
  ALL of: (a) job pickup still works — the agent was not cut off from anything
  it needs; (b) a NON-sudo IMDSv2 probe from a job step fails/times out —
  crucially, request a token first (`curl -X PUT
  http://169.254.169.254/latest/api/token -H
  'X-aws-ec2-metadata-token-ttl-seconds: 60'`) and require the TOKEN REQUEST
  itself to be blocked, because with `http_tokens: required` a tokenless GET
  already returns 401 even without the firewall rule and would pass a hollow
  probe; and (c) the instance-profile role is
  minimal. Note (c) is the real control, not the DROP: the runner user keeps
  passwordless sudo for hosted parity, so `sudo curl` to IMDS is EXPECTED to
  still succeed and is not itself a blocker — a host firewall rule cannot
  contain root-capable job code. Instead enumerate the runner role's policies
  and permissions boundary and confirm it grants only boot-time needs (AMI SSM
  read, runner-binary S3 read); a non-minimal role IS a blocker. If (a)
  regresses, the agent needed IMDS at runtime and the rule must move to a
  post-agent-start hook or a path-scoped local proxy. Do not flip the
  heavy-lane cutover until Gate E passes.

## The host IMDS DROP starved the runner agent — deployed and rolled back same day

- **Work:** P2 deploy (PR #660) — `pulumi up` of the 64 GB types + the CSF-003
  host IMDS `iptables` OWNER-match DROP, then the Gate E probe.
- **What happened:** the DROP keys on the `ec2-user` uid, but `runner_run_as`
  is `ec2-user` too, so the *agent* is that uid. The shadow worker booted on a
  64 GB `m7a.4xlarge`, fetched its SSM/JIT config as root (root IMDS still
  worked), then `runner-start-failed with exit code 1` when the agent started
  as `ec2-user`. It never registered; the Gate E job hung queued until the
  instance self-terminated. Confirmed from `ec2:GetConsoleOutput`: iptables-nft
  installed at boot, then the runner start failed as ec2-user.
- **Recovery:** cancelled the stuck run, rolled back ONLY `userdata_post_install`
  via a targeted `pulumi up` (kept the 64 GB types), and a plain shadow probe
  confirmed the fleet registered and ran again.
- **Why it wasn't caught earlier:** it is a runtime property — the code
  compiles, tests pass, and the canonical github-aws-runners uid-DROP pattern
  looks right on paper. Only a live boot on the shadow label exposes that the
  agent shares the job uid. This is exactly why Gate E gates the deploy, and
  why "job pickup still works" is its first criterion.
- **Proposal / rework:** a boot-time firewall rule is the wrong shape when the
  agent and jobs share a uid. Move the DROP to a per-job
  `ACTIONS_RUNNER_HOOK_JOB_STARTED` hook (runs after the agent started the job,
  before the job's steps, as the runner user via sudo), so agent start-up is
  untouched while job steps are blocked. Re-validate through Gate E — including
  the token-PUT probe and role-minimality enumeration — before any redeploy.
  Until then, main must NOT carry an active `userdata_post_install` DROP, or a
  redeploy re-breaks the fleet.

## Turbo "remote cache on push" was a mirage

- **Work:** cutover review — activating the P3 remote cache for the ephemeral
  fleet.
- **What happened:** `check.yml` push lanes set `TURBO_TOKEN`/`TURBO_TEAM`
  secrets but no `TURBO_API`, which points turbo at Vercel's hosted API, and a
  main `Check` job log shows no remote-cache banner at all — remote caching has
  never been active in this repo's CI. Main's perceived cache speed came from
  warm burst-worker local disks, which one-job-one-VM removes entirely.
- **Prevention:** treat "cache enabled" as unproven until a run log shows the
  remote-cache banner and a hit; any activation must wire `TURBO_API` alongside
  the tokens, and acceptance is a logged cold/warm hit pair, not env presence.

## Fleet no-pickup dispatches are fully attributed — control plane is healthy

- **Work:** pre-cutover reliability audit of the 6-of-10 shadow dispatches that
  were never picked up (one waited 33.6 minutes on 2026-08-11).
- **What happened:** traced the 2026-08-11 case (run 31487753179) through the
  webhook → dispatcher → scale-up CloudWatch logs: accepted at 11:41:36,
  queued to SQS at :37, instance launched at :42 — six seconds end-to-end. The
  instance was born with the since-rolled-back IMDS DROP userdata, i.e. this
  was the Gate E incident itself, not a scale-up defect. The other five date to
  the Aug 9–10 bring-up windows.
- **Prevention:** attribute a no-pickup from the lambda chain (webhook →
  dispatch-to-runner → scale-up → instance console) before suspecting the
  module; keep a 10/10 consecutive-pickup gate as cutover acceptance.

## enable_job_queued_check strands queued jobs on GitHub API lag

- **Work:** the pre-cutover 10/10 pickup gate — seven probe dispatches against
  the ephemeral fleet.
- **What happened:** five picked up in 84–174s; two sat queued 25+ minutes.
  Scale-up logged "No runner will be created, job is not queued." for both —
  GitHub's jobs API reported not-queued for genuinely queued jobs (the same
  API had 404'd a fresh job fail-open earlier the same day). In the module
  source the not-queued branch `continue`s without adding the message to the
  retry set, and only launched instances publish job-retry checks, so the
  message is consumed and nothing ever revisits the job.
- **Prevention:** `enable_job_queued_check: false` (the module's own ephemeral
  default). With one-job-one-VM economics a cancelled job costs one
  self-reaping VM for cents; a stranded production lane costs an operator.
  General law: a pre-launch state check that consumes its message on a
  negative answer must have a retry path, or it converts transient API lies
  into permanent hangs.
