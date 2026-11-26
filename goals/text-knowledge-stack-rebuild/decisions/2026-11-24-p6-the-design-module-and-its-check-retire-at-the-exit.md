---
title: "P6: ops/design retires at the P6 exit with its manifest command and opsScripts entries; the ops tsconfig check stays"
date: 2026-11-24
lane: "p6"
reversal: "Restore goals/text-knowledge-stack-rebuild/ops/design from the P6 head before the exit row, with its manifest verificationCommand and opsScripts entries"
---

L5.operations.ts is the last sketch in ops/design. Its surfaces now live in production with recorded differences: ActivityRecord in @beep/jsonc with id and nested start; ActivityFacts with effectful facts; withActivity minting at start, exposing CurrentActivity, emitting Operation.run and clamping to ActivityFloor; composeLogged as the Writer bind; product, map and traverse. With L5 gone the directory is empty, so ops/design (index.ts, tsconfig.json), the manifest's bunx tsrs -p goals/text-knowledge-stack-rebuild/ops/design/tsconfig.json --noEmit command (ops/manifest.json:162) and both opsScripts entries (:171-180) leave in the exit row. The goals/tsconfig.ops.json check stays for the other ops scripts. Answers F16.
