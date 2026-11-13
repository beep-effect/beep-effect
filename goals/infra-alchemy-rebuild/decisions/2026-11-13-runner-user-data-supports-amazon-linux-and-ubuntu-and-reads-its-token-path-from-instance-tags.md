---
title: "Runner user data supports Amazon Linux and Ubuntu and reads its token path from instance tags"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners-composite"
reversal: "Bake run_as, token path and agent mode back into SSM config parameters read by the user data, as upstream's start-runner.sh does."
---

The user data ports upstream's `user-data.sh`, `install-runner.sh` and `start-runner.sh` without X-Ray, the CloudWatch agent or the SSM config-path lookup: scale-up tags each instance with `ghr:token_path` and `ghr:runner_name_prefix`, and the script reads them through IMDSv2 metadata tags, so a pool needs no SSM config parameters. The live fleet controller pins `ciFleetController:amiId` (`infra/ci-runners/Pulumi.production.yaml`; the AL2023 default parameter in `infra/src/CiFleetController.ts`; boot-time `dnf upgrade-minimal`), while the Ubuntu 24.04 parameter in `infra/ci-runners/Pulumi.yaml` configures the `CiRunners` groundwork stack. The script picks dnf or apt-get from `/etc/os-release` (installing AWS CLI v2 on Ubuntu), so either image works; the runner still starts with `./run.sh` from `/opt/actions-runner`, which keeps the live post-install shim working.
