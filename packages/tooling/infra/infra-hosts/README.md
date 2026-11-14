# @beep/infra-hosts

Alchemy stacks for the two host deployments the Pulumi programs described:
AI metrics (Arize Phoenix) on dankserver, and the OpenClaw generation
applicator on the operator workstation. The package is composition only: every
resource is an Alchemy primitive (`Docker.Context`, `Docker.Network`,
`Docker.Volume.lookup`, `Docker.Container`, `Command.Exec`); it owns no
resource of its own (goals/infra-alchemy-rebuild D9, D16, D21).

Operating steps (session setup, rehearsal, cutover, rollback):
`docs/runbooks/alchemy-infra.md`, section "Host stacks". The decisions behind
this design are the 2026-11-13 files in `goals/infra-alchemy-rebuild/decisions/`.

## Design order

Schema first, then the stack's typed configuration, then the resource graph.

| Layer | AI metrics | OpenClaw |
| --- | --- | --- |
| Schema | `AiMetricsHostConfig`, `PinnedImage` (`AiMetricsConfig.ts`) | `OpenClawStackArgs` and the generation model (`OpenClawGeneration.ts`) |
| Configuration | JSON file named by `BEEP_AI_METRICS_HOST_CONFIG` | JSON file named by `BEEP_OPENCLAW_HOST_CONFIG` |
| Program | `aiMetricsStackProgram` (`AiMetricsStack.ts`) | `openClawStackProgram` (`OpenClawStack.ts`) |
| Entry | `alchemy.run.ts` (stack `HostsAiMetrics`) | `openclaw.alchemy.run.ts` (stack `HostsOpenClaw`) |

`HostConfigFile.loadHostConfigFile` decodes a config file and turns every
failure (unset variable, unreadable file, bad JSON, a rejected value) into a
`ConfigError`, the only error an `Alchemy.Stack` body may raise, so a bad file
stops the plan before any resource is read. No tracked file carries a host
address, login, path or port; the files live on the workstation and hold
`op://` references only.

## Stages

`HostsStage.stageKind` maps `prod` to `prod` and every other stage name to
`rehearsal`. `prod` yields `HostsStage.WorkstationOnly` first, which fails when
`CI` is true: the host stacks deploy prod from the operator workstation only,
the inverse of the CI-only rule the other stacks follow (D21, SPEC Exception
Ledger). The shared S3 store's stage lease is the overlap guard; there is no
deploy workflow.

## AI metrics

```text
prod:
Docker.Context "Host" (host=ssh://<sshDestination>)
  ├─ Docker.Network "Network"            beep-ai-metrics, bridge, owned
  ├─ Docker.Volume.lookup                beep-ai-metrics-dankserver_phoenix_data, never created or removed
  └─ Docker.Container "Phoenix"          beep-ai-metrics-phoenix, pinned image, restart unless-stopped,
                                         127.0.0.1:6006 -> 6006, /data, healthcheck /healthz
Command.Exec "Preflight"     tools, engine, tailnet, data volume present
Command.Exec "RetireCompose" disable the Compose unit (compose down keeps the volume), archive it
  └─▶ Phoenix (label edge)
Command.Exec "TailscaleServe" HTTPS 8447 -> 127.0.0.1:6006 (after Phoenix)
Command.Exec "Health"        Docker health, loopback, Serve, public URL (after Serve)
```

Mapping from the Pulumi deployment: the Compose service and its
`container_name` become the `Phoenix` container under the same name; the named
Compose volume is looked up, so no plan can delete or replace Phoenix's data;
the `systemd --user` unit that ran `docker compose up` is retired, and Docker's
restart policy takes its place; the Tailscale Serve lines of the Pulumi apply
script become their own step, unchanged; the two secret references (hash salt,
raw archive key) are configuration the stack exports for clients and never
resolves. Cutover stops and replaces the Compose container and keeps the
volume; rollback is `alchemy destroy` followed by the exported
`rollbackToCompose` command, in that order.

A rehearsal stage deploys a throwaway Phoenix on stage-suffixed context,
network, volume and container names, published on loopback port
`phoenix.rehearsalPort` (16006 by default), with no Compose retirement and no
Tailscale Serve. One rehearsal at a time per port: Preflight refuses a port that
another container or process holds and names the holder, and Health checks that
the port it probes is published by this stage's own container. Set
`phoenix.rehearsalPort` to run two.

The data volume name defaults from `legacyCompose.composeProject`
(`<composeProject>_phoenix_data`, Compose's own naming); prod Preflight refuses a
volume that carries another Compose project, and RetireCompose refuses a
surviving container, naming the expected and the found project.

## OpenClaw

```text
prod:
Command.Exec "Preflight" ─▶ "Stage" ─▶ "Apply" ─▶ "Probe" ─▶ "BackupShip" (when backup is configured)
```

Each step's command is the rendered `/bin/bash --noprofile --norc -p -c` script
from `OpenClawGeneration.ts`, moved here from `infra/src/OpenClaw.ts`. The memo
hashes no files, so a step re-runs exactly when its rendered input changes (a
new generation id, a new declared identity). Checks report through exit status:
`Command.Exec` keeps no stdout and deletes nothing. The drift audit, the live
acceptance run and the rollback are operator commands in the stack outputs;
the rollback is the teardown. A rehearsal stage renders the generation and
declares no command.

## Ordering

Alchemy has no `dependsOn`; an edge is an Output one resource reads from
another. Each `Command.Exec` puts the previous step's `hash.input` in its
environment, and the Phoenix container carries a constant label mapped from
`RetireCompose`, so the Compose container is gone before the new one is
created.

## Tests

Hermetic and credential-free, on the `@alchemy.run/test` harness with
in-memory state: fake Docker providers record each resource's props, and
Alchemy's real `Command.Exec` provider runs over a fake executor that records
commands instead of running them (`test/fakes.ts`). The suites cover each
stack's resource graph, the prod guard under `CI=true`, configuration decoding
and rejection, and that state, outputs and step props carry `op://` references
but never a resolved secret.

```bash
bun run check
bun run test
```

## License

MIT
