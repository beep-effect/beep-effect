---
title: "OpenClaw generation renderers move into @beep/infra-hosts; infra re-exports them until P6"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p4-hosts"
reversal: "Move src/OpenClawGeneration.ts and src/OpenClawArtifacts.ts back into infra/src and drop infra's @beep/infra-hosts dependency."
---

The pure generation model and every applicator script (about 2,300 lines from `infra/src/OpenClaw.ts`, plus `infra/src/OpenClawArtifacts.ts`) move to `@beep/infra-hosts/OpenClawGeneration` and `/OpenClawArtifacts`, so the Alchemy stack and the Pulumi program render from one copy. `infra/src/OpenClaw.ts` keeps only the Pulumi config mapping and component and re-exports the moved module; `infra/` gains a workspace dependency on `@beep/infra-hosts` and leaves in P6. Changes on the way: the backup target (`host`, `user`, `remoteDir`) loses its machine-specific defaults and is required wherever a backup is configured (the Pulumi mapping now requires the three config keys); messages that said `pulumi up` say `alchemy deploy`; doc examples decode the nested `OpenClawStackArgs` shape the stack's config file uses and name no real machine. The renderer tests moved with the code (`packages/tooling/infra/infra-hosts/test/OpenClawGeneration.test.ts`); the infra copy stays green until P6 deletes it.
