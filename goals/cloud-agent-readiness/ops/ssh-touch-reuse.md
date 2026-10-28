# SSH touch notification reuse check

The workstation wrappers previously announced a pending touch before every SSH
invocation. OpenSSH multiplexed invocations reuse an authenticated master and
never ask the device to sign, so these produced notifications without a blinking
key.

The wrappers now inspect the effective ControlPath with `ssh -G` and verify a
live master with `ssh -O check`. Both are authentication-free probes. A reused
channel suppresses the proactive alert and disables a fallback dial: if the
master disappears, the command fails instead of silently beginning authentication.
Fresh connections retain the canonical alert and exact-source cleanup. Config
queries stay quiet; a `-G` passed to a remote command is not a config query.

Run the inert fixture against each wrapper before installation:

```sh
python3 goals/cloud-agent-readiness/ops/ssh-touch-reuse-check.py \
  goals/cloud-agent-readiness/ops/ssh-beep-worker-yubi.sh \
  goals/cloud-agent-readiness/ops/ssh-tbk-worker.sh \
  goals/cloud-agent-readiness/ops/ssh-tbk-ubuntu.sh
```

It substitutes SSH, agent/key inspection and the alert consumer. It does not
connect to a host, open a device or display a notification. Keep the previous
installed wrapper as a private recovery copy; replace only the corresponding
script. The dankserver worker wrapper's durable source lives in the dankserver
control repository and uses the same tests.
