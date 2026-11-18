---
title: "Drop KmsGrant: the GitHub App KMS key delegates to IAM"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-aws-extras"
reversal: "Add a KmsGrant resource over distilled kms.createGrant / retireGrant to @beep/alchemy-aws-extras and grant the termination-watcher roles through it."
---

D19 left `KmsGrant` open until the key policy was read. It was read on 2026-11-13 (`aws kms get-key-policy --key-id 79ab38d9-2a9d-426b-b704-beb6fc5c971d`): the GitHub App KMS key has one statement, "Enable IAM User Permissions", granting `kms:*` to the account root principal. The key therefore delegates authorization to IAM. In the native runner composite the stack owns the termination-watcher roles, so an IAM inline policy granting `kms:Decrypt` with a `kms:EncryptionContext:PARAMETER_ARN` condition replaces the six `aws.kms.Grant` resources the Pulumi program carried for the upstream module (`infra/src/CiFleetController.ts`). `@beep/alchemy-aws-extras` ships no `KmsGrant`; the IAM policy belongs to `@beep/alchemy-github-runners`.
