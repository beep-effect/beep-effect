---
title: "RunnerFleet owns the App secret parameters under its own KMS key and serves the webhook from a function URL"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners-composite"
reversal: "Take existing parameter ARNs as inputs and drop the composite's KMS key and SSM parameters."
---

The composite declares one KMS key and alias per fleet and writes the App id, base64 key and webhook secret as SecureString `SSM.Parameter`s under it from caller-supplied `Redacted` values (nothing here reads 1Password or mints an App). Lambda roles read them through `bind` inline policies; the termination watcher's `kms:Decrypt` carries `kms:EncryptionContext:PARAMETER_ARN` for the id and key parameters, so no KMS grant exists. The webhook is a public Lambda function URL (the module used API Gateway); `RunnerSweep` depends on each pool's scale-up function so destroy sweeps runtime instances first.
