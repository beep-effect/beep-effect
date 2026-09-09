> **Operational policy superseded September 9, 2026.** The heavy pool uses
> On-Demand capacity, 64 GiB instances and a cap of 14. The approved account guardrail is $500/month;
> alerts never stop CI. Historical Spot, budget and manual teardown
> instructions below are retained as evidence, not current operating policy.
> Follow [runner reliability](../../../../docs/runbooks/ci-runner-reliability.md)
> and [cost operations](../../../../docs/runbooks/aws-cost-operations.md).

# Supervised runner burst — retired

The manual launch path was retired on 2026-08-13. Do not use this directory to
create CI capacity. The production `CiFleetController` is the only supported
owner of the `beep-ec2-heavy` runner label.

The retired launcher created non-ephemeral repository runners and carried a
reusable registration token in instance user-data. A pull-request job could
therefore read registration material or persist state for a later trusted job.
Those properties are incompatible with the controller's one-job-one-VM and JIT
registration contract, so there is no break-glass launch exception.

## Retired cleanup entry point

`teardown-burst-runners.sh` now prints a retirement notice and exits with status 1.
It performs no AWS or GitHub mutations. Its former tag selector also matched
active AMI builders, so executing it must never be treated as completed cleanup.

For remaining legacy workers, follow the exact-resource review and attended
cleanup procedure in [AWS cost operations](../../../../docs/runbooks/aws-cost-operations.md).
Verify account, region, instance identity, ownership and current job activity;
exclude active builders and controller workers. Record terminal absence after
any approved removal. Current capacity changes belong to the controller's
bounded-burst procedure, which restores the captured On-Demand baseline.
