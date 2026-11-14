# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: a cache-baseline re-record has to review root drift inherited from `main`

- **Doing:** P3 Storybook stack (lane `goals/infra-alchemy-rebuild-p3-storybook`); a new script in
  `apps/storybook/package.json` drifted eight `@beep/storybook` computations.
- **Evidence:** `bun run beep cache baseline --request <request.json>` with `subjects: ["@beep/storybook"]`
  answered `Baseline review does not cover the changed subjects. Unreviewed: //.` The lane does not touch
  `turbo.json`; four PRs merged after the last record (#3242) had regenerated ten root-declared
  `@beep/repo-cli#lint:policy-fingerprint:*` input lists, which `main` reports only as
  `REVIEW configuration-source-drift: turbo.json`. The next lane to re-record inherits the review.
- **Would have prevented it:** the PR that regenerates root `turbo.json` input lists re-records `//` itself
  (make the source drift a BLOCK there), or the baseline command names inherited subjects apart from the
  lane's own so the reviewer knows which diff to read.

## 2026-11-13: `final-check` coverage replays the whole repo when `bun.lock` changes

- **Doing:** the same lane; the diff adds three dependencies to one app, so `bun.lock` gains four lines.
- **Evidence:** `final-check:coverage` selected the full workspace (`coverage:full`, shard 2 of the run) and
  was killed after 36 minutes with exit 143; the other gates took under seven minutes each. The receipt for
  the pushed head records the gate as skipped and hosted CI measures it.
- **Would have prevented it:** scope the coverage replay by the workspaces whose resolved dependencies
  changed in the lockfile diff, not by the lockfile path alone.

## 2026-11-13: `create-package github --kind infra` leaves a half-written `@beep/github` that config-sync then wires in

- **Doing:** P3 GitHub stack (the P3 GitHub lane), trying to match the sibling
  turbo-cache layout (directory turbo-cache under the tooling infra family, package `@beep/infra-turbo-cache`).
- **Evidence:** `bun run beep create-package github --family tooling --kind infra` wrote
  `packages/tooling/infra/github/package.json` with name `@beep/github` (the drivers package already owns
  it), then failed with `Workspace name "@beep/github" already exists`. The partial directory stayed, and the
  next config-sync rewired three packages' tsconfig references from `packages/drivers/github` to it.
  The working form is `create-package infra-github --dir-name github`.
- **Would have prevented it:** check the workspace name before writing any file; and for `--kind infra`,
  default the package name to `@beep/infra-<name>` (or say in the help that the prefix is the caller's job).

## 2026-11-13: `@alchemy.run/github` beta.86 plans adopted singletons as `create`

- **Doing:** the same lane; the read-only `alchemy plan` of `InfraGithub` against the live repository.
- **Evidence:** `Plan: 36 to create, 1 to adopted`. Only `GitHub.Ruleset` has a `read` adoption probe;
  `Repository`, `Environment`, `Variable` and `Label` return nothing without prior state, so an empty stage
  shows `create` for objects whose reconcile only updates (stack tests assert zero POST). A reviewer reading
  the plan cannot tell a real create from a converge-by-name.
- **File evidence (installed `@alchemy.run/github@2.0.0-beta.86`, same on Alchemy `main` at `33c10dd55f`):**
  the engine probes adoption only through `provider.read` when a resource has no state
  (`alchemy/src/Plan.ts:1749`). `src/Repository.ts:592` returns `undefined` from `read` whenever
  `output` is undefined, so an empty stage never sees the live repository; `src/Label.ts`,
  `src/Environment.ts` and `src/Variable.ts` define no `read` at all. `src/Ruleset.ts:651` is the
  model to copy: it lists by name and returns `Unowned(attrs)`.
- **Would have prevented it:** a name-based `read` in those four providers (upstream contribution); until
  then the decision file explains each `create`. Packet gate ruling 2026-11-13: accepted as is, not held
  on the upstream change.
