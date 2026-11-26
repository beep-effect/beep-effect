---
title: "AI metrics Phoenix runs without a Docker healthcheck; the Health step probes /healthz"
date: 2026-11-26
lane: "fix/infra-hosts-phoenix-health-gate"
reversal: "Restore a Docker healthcheck on the Phoenix container once the Docker provider can set the exec form or the image ships a shell; the Health step keeps its probe either way."
---

The 2026-11-26 dankserver rehearsal (stage `dev_<user>`) failed at Health: Docker ran the container's healthcheck as `CMD-SHELL`, and every probe ended with `stat /bin/sh: no such file or directory`. `arizephoenix/phoenix:22.0.1`, the image the live Compose deployment runs, ships no shell. `@alchemy.run/docker` sets healthchecks through `docker run --health-cmd`, which always runs its value in `/bin/sh`, so no command form reaches a shell-less image. The live Compose file avoids this with the API's exec form (`CMD /usr/bin/python3.13 -c ...`), which the CLI flag cannot express.

Decision: the Phoenix container carries no Docker healthcheck. The Health Exec step is the gate. It waits up to 36 x 5 s for the container to be running and to answer `/healthz` on its own published loopback port, then keeps the published-port, Serve and public-URL checks. `restart: unless-stopped` acts on exit, not on health, so the only loss is the health column in `docker ps`.

Config facts found live in the same session, now in the runbook:
- The image pin copies the live Compose `image:` line, tag and digest. The `15.5.0` the runbook named would have run an older Phoenix against a volume that 22.0.1 migrated.
- `legacyCompose.configRoot` comes from the unit's `WorkingDirectory`.
- The secret references live in `BEEP_SECRETS`, the only vault the agent service account reads.
