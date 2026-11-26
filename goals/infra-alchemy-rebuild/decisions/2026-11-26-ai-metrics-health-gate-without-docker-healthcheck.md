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
- The data volume is `external: true` in the live Compose file and carries no `com.docker.compose.project` label (Pulumi created it 2026-08-06). The first prod apply (02:27Z) stopped at Preflight on that label, with nothing retired; the unit was restarted at once (74 s down). Preflight now accepts an unlabelled volume and still refuses one labelled with another project.
- The live unit's `ExecStop` is `docker compose stop`, not `down`. The cutover runs `docker compose down` without `-v` after stopping the unit, because RetireCompose refuses while a container of the Compose project survives.

Attempt 2 (02:40:36Z, from f0c12fcf150) deployed, but a field-by-field audit against the retired Compose service found three deltas the stack had never carried. All three now ride the stack:
- Seven Phoenix settings in the Compose `environment`: `PHOENIX_ENABLE_AUTH=false`, `PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER=false`, `PHOENIX_ENABLE_MCP_SERVER=true`, `PHOENIX_ENABLE_MCP_CODE_MODE=false`, `PHOENIX_DISABLE_AGENT_ASSISTANT=true`, `PHOENIX_ALLOWED_SANDBOX_PROVIDERS=NONE` and `PHOENIX_TELEMETRY_ENABLED=false`. Without them, 22.0.1's defaults turned auth on (`/v1/projects` answered 401) and enabled telemetry and the agent assistant.
- The external network `beep-ai-metrics-dankserver_default` (`<composeProject>_default`). The host's OTLP collector exports to `http://beep-ai-metrics-phoenix:6006/v1/traces` on that network, so it could no longer resolve Phoenix. The prod container now joins it, and Preflight refuses when it is missing.
- `stop_grace_period: 2m`, now `stopTimeout: "2 minutes"`, so a stop does not kill Phoenix's SQLite writer at Docker's 10 s default.

The same audit found the image, port binding, volume and restart policy matching. The healthcheck is dropped on purpose (above).

Outcome of the cutover, applied as attempt 3 from `f096be4dca8`:
- The export-failure window was 02:27:04Z (the attempt-1 stop) to 02:54:35Z, and ingestion was degraded from 02:40:46Z to 02:54:35Z.
- The collector's persistent queue drained from 42 batches to 0 after attempt 3. Between 02:44:41Z and 02:54:09Z, 22 batches ran out of retries and 91 spans were dropped. The driver accepted that as the cost of the cutover.
- Phoenix was down about 74 s, 52 s and 20 s across the three attempts.
- The live state was proven at `f096be4dca8`; later commits on the P4 PR change only documentation.

Rollback for the prod cutover (also in the runbook):
- RetireCompose deletes nothing. It disables the unit and moves the unit file into `<legacy config root>/retired-compose/`; the Compose root and its files stay on disk.
- To return to Compose, run `alchemy destroy --stage prod`, which keeps the looked-up volume, then the stack's `operatorCommands.rollbackToCompose`, which restores the unit and starts it on the same volume.
- If the data is damaged, stop the unit, restore the pre-cutover snapshot tarball into the volume with a throwaway container, and start the unit.
