#!/usr/bin/env bash
# Supervised-burst CI runners on the deployed ci-runners fleet groundwork.
# Launches N spot workers from launch template beep-ci-runner, each registering
# as a NON-ephemeral repo runner labeled beep-ec2-heavy, named beep-ec2-<id>
# (the beep- prefix keeps the workflows' disk-cleanup guard off them).
#
# INTERIM POSTURE (pre-controller), operator-supervised:
#  - registration tokens are minted here (repo admin gh session), single-use,
#    expire in 1h, and never persist on the instance beyond config time
#  - runners are non-ephemeral for the burst; the reaper TTL is the hard cap —
#    RAISE IT TO 360 BEFORE LAUNCH and restore 90 after (commands at bottom)
#  - do NOT approve outside-collaborator workflow runs while burst runners live
set -euo pipefail
export AWS_PAGER=""
export GH_PAGER=cat
REPO="beep-effect/beep-effect"
COUNT="${1:-2}"
RUNNER_VERSION="2.336.0"
LABEL="beep-ec2-heavy"
# The launch template leaves subnet placement to launch time (controller's job
# later); without an explicit subnet EC2 falls back to the default VPC, which
# mismatches the worker SG. Alternate across the fleet's two public subnets.
SUBNETS=("subnet-078ddb80baeea06c3" "subnet-0bc46726b34c5fc3b")

cat <<'NOTES'
== SECURITY (P1, accepted for break-glass use only)
The registration token rides in instance user-data, readable by ANY job on
the worker (IMDSv2 -> /latest/user-data) for the token's 1-hour life — and
registration tokens are REUSABLE until expiry, so a malicious job could
register a rogue runner that outlives teardown. Guards while this runbook
exists: never approve outside-collaborator runs during a burst, and after
teardown audit the runner list and deregister ANY runner you did not launch
(teardown-burst-runners.sh prints the list). The ci-fleet-endgame controller
uses single-use JIT configs and retires this exposure class entirely.

== preflight: confirm the reaper TTL is 360 minutes before launching
WARNING: this script cannot inspect the Pulumi stack; abort now if the TTL has not been raised.
From infra/ci-runners:
  PULUMI_CONFIG_PASSPHRASE="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE')" \
    pulumi config set ciRunners:reaperTtlMinutes 360 && \
  PULUMI_CONFIG_PASSPHRASE="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE')" pulumi up --yes
NOTES

for i in $(seq 1 "$COUNT"); do
  echo "== minting registration token for runner $i/$COUNT"
  token="$(gh api -X POST "repos/${REPO}/actions/runners/registration-token" --jq .token)"

  umask 077
  userdata_file="$(mktemp)"
  trap 'rm -f "$userdata_file"' EXIT
  cat >"$userdata_file" <<EOF
#!/usr/bin/env bash
set -euo pipefail
# Backstop first (mirrors the template default): poweroff terminates the VM.
shutdown -P +350
# Hosted-image parity baseline: the minimal server AMI lacks unzip (setup-bun
# extraction died with exit 127 on the first fleet run), plus the rest of the
# toolbelt actions and lanes assume.
apt-get update -qq
apt-get install -y -qq libicu74 jq git unzip zip tar curl build-essential python3 docker.io >/dev/null
# Test Integration builds its PGLite database via Testcontainers -> needs a
# running Docker daemon and a runner user in the docker group BEFORE the
# runner service starts (group membership binds at service start).
systemctl enable --now docker
instance_id="\$(TOKEN=\$(curl -fsS -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token) && curl -fsS -H "X-aws-ec2-metadata-token: \$TOKEN" http://169.254.169.254/latest/meta-data/instance-id)"
hostnamectl set-hostname "beep-ec2-\${instance_id}"
mkdir -p /opt/actions-runner && cd /opt/actions-runner
curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar xzf runner.tar.gz && rm runner.tar.gz
useradd -m runner || true
usermod -aG docker runner
# Hosted-runner parity: jobs on GitHub-hosted images get passwordless sudo and
# some actions assume it. Interim posture for trusted-code bursts only.
echo 'runner ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/runner
chmod 0440 /etc/sudoers.d/runner
chown -R runner:runner /opt/actions-runner
sudo -u runner ./config.sh --unattended \
  --url "https://github.com/${REPO}" \
  --token "${token}" \
  --name "beep-ec2-\${instance_id}" \
  --labels "${LABEL}" \
  --replace
./svc.sh install runner
./svc.sh start
EOF

  echo "== launching worker $i/$COUNT from template beep-ci-runner (as beep-ci-runner-launcher)"
  # The admin user carries a legacy t2.micro-only RunInstances deny
  # (FreedomFramework-CI), so launches use the dedicated launcher identity —
  # which is the designed path: its policy + guardrail Denies make non-compliant
  # launches impossible. Values resolve via op and are never echoed.
  # The template declares the NIC (public IP + worker SG); a request-level
  # subnet must ride the same structure and re-state the full interface,
  # because the request block replaces the template's per device index.
  unset AWS_SESSION_TOKEN AWS_SECURITY_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE
  AWS_ACCESS_KEY_ID="$(op read 'op://BEEP_CI/aws-runner-launcher/access-key-id')" \
  AWS_SECRET_ACCESS_KEY="$(op read 'op://BEEP_CI/aws-runner-launcher/secret-access-key')" \
  aws ec2 run-instances \
    --launch-template 'LaunchTemplateName=beep-ci-runner,Version=$Latest' \
    --network-interfaces "DeviceIndex=0,SubnetId=${SUBNETS[$((i % 2))]},Groups=sg-0ec4816fcd2af2d4b,AssociatePublicIpAddress=true,DeleteOnTermination=true" \
    --user-data "file://${userdata_file}" \
    --count 1 \
    --query 'Instances[0].InstanceId' --output text
  rm -f "$userdata_file"
  trap - EXIT
  unset token
done

echo "== waiting ~90s for registration, then listing runners"
sleep 90
gh api --paginate "repos/${REPO}/actions/runners?per_page=100" \
  --jq '.runners[] | [.name, .status, ([.labels[].name] | join(","))] | @tsv'

cat <<'NOTES'
After the burst, run teardown-burst-runners.sh to terminate workers, wait for
termination, remove their registrations, and print the TTL-restore command.
NOTES
