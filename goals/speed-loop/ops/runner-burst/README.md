# Supervised runner burst — retired

The manual launch path was retired on 2026-08-13. Do not use this directory to
create CI capacity. The production `CiFleetController` is the only supported
owner of the `beep-ec2-heavy` runner label.

The retired launcher created non-ephemeral repository runners and carried a
reusable registration token in instance user-data. A pull-request job could
therefore read registration material or persist state for a later trusted job.
Those properties are incompatible with the controller's one-job-one-VM and JIT
registration contract, so there is no break-glass launch exception.

## Cleanup only

`teardown-burst-runners.sh` remains solely to remove workers and runner
registrations left by the retired path. It deliberately excludes controller
instances that carry the fleet module's environment tag.

Run it only when legacy `beep-ec2-i-*` registrations or untagged burst workers
still exist:

```sh
bash teardown-burst-runners.sh
```

The script requires authenticated AWS and repository-admin GitHub sessions. It
terminates matching legacy instances, removes their registrations, and prints
the steady-state reaper-TTL restore command. Any failed cleanup step aborts the
script.
