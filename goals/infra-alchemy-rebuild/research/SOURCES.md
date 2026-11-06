# Sources

P0 deep-research inputs (operator list, 2026-11-06). Reports produced from them land as sibling
files here and under `alchemy-blog/`; `bun run beep goals manifest --write` projects them.

## alchemy.run documentation

Project structure: `/project-structure/monorepo/`, `/project-structure/monorepo-multi-stack/`,
`/project-structure/file-layout/`.

Testing: `/testing/`, `/testing/observability/`, `/testing/test-harness/`,
`/testing/testing-providers/`, `/testing/testing-a-stack/`.

Environments: `/environments/ci/`, `/environments/worktrees/`, `/environments/local-development/`,
`/environments/stages/`.

Infrastructure as Effects: `/infrastructure-as-effects/telemetry/`,
`/infrastructure-as-effects/circular-bindings/`, `/infrastructure-as-effects/phases/`,
`/infrastructure-as-effects/sinks/`.

Infrastructure as Code: `/infrastructure-as-code/custom-provider/`,
`/infrastructure-as-code/provider/`, `/infrastructure-as-code/references/`.

Providers and guides: `/command/`, `/docker/`, `/github/`, `/state-store/`,
`/state-store/custom-state-store/`, `/providers/drizzle/postgres/`, `/providers/drizzle/schema/`,
`/domain/local-first/`, `/cloudflare/frontend/full-stack-tanstack-rpc-drizzle/`,
`/cloudflare/frontend/nextjs/`, `/cloudflare/data/drizzle/`, `/cloudflare/ai/effect-ai/`,
`/cli/state/`, `/cli/inspecting-state/`, `/llms.txt`.

Blog: every post under `/blog/` (47 as of 2026-11-06; catalogued by four grok-4.7 xhigh
deep-research lanes under `alchemy-blog/`).

## Source checkouts

- `~/YeeBois/references/effect/alchemy` (tracks main): `packages/alchemy`, `packages/aws`,
  `packages/cloudflare`, `packages/github`, `packages/docker`, `packages/alchemy-test`,
  `packages/integration-tests`, `stacks/`, `examples/`.
- `~/YeeBois/references/effect/distilled` (tracks main): every `packages/*` SDK, notably `vercel`,
  `github`, `onepassword`, `aws`, `cloudflare`, `s3`, `core`.
- `~/YeeBois/references/effect/t3code/infra/relay` and `infra/task-cache`: production Alchemy
  stacks (Cloudflare, Planetscale, Drizzle, Axiom, custom provider `PreviewTunnelSweep`,
  `Secrets.DotEnv`/`ProcessEnv`, `adopt(true)`).
- `apps/beep-effect-web/alchemy.run.ts` and `goals/beep-effect-web-alchemy` (first live stack in
  this repo, Cloudflare state store lessons).
- `explorations/pulumi-to-alchemy/RESEARCH.md` (2026-11-02 coverage matrix, G1–G9).

## Prior packets

- `goals/beep-effect-web-alchemy` (completed-retained).
- `goals/alchemy-vault-sync-slice` (`@alchemy.run/domain`, application side).
- `goals/repo-cli-gh-git-consolidation` (requirement for `@beep/infra-github`).
