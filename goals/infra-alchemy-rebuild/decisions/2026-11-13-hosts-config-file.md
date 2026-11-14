---
title: "Host stack configuration is a schema-decoded JSON file per stack, named by an environment variable"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p4-hosts"
reversal: "Switch loadHostConfigFile to Config.schema over ConfigProvider.fromEnv with nested keys; the schemas stay the same."
---

No tracked file carries a host address, login, path or port. `AiMetricsHostConfig` (`packages/tooling/infra/infra-hosts/src/AiMetricsConfig.ts`) and `OpenClawStackArgs` (`packages/tooling/infra/infra-hosts/src/OpenClawGeneration.ts`) are the stack configuration schemas; `loadHostConfigFile` (`packages/tooling/infra/infra-hosts/src/HostConfigFile.ts`) reads the file named by `BEEP_AI_METRICS_HOST_CONFIG` or `BEEP_OPENCLAW_HOST_CONFIG` and decodes it, turning a missing variable, an unreadable file, malformed JSON or a rejected value into a `ConfigError` before any resource is read (tested). Machine facts (SSH destination, tailnet name, legacy Compose root, workstation identity, backup target) are required fields; this stack's own conventions (container, network, volume and context names, ports 6006 and 8447, unit name) default to what the Compose deployment uses today. The files hold `op://` references only and live on the operator workstation outside the repo. The SSH agent socket is not a field: Docker's `ssh://` endpoint and the host steps both use the deploy process's `SSH_AUTH_SOCK`, which the runbook sets from the wrapped route.
