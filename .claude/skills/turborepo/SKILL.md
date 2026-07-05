---
name: turborepo
description: |
  Turborepo monorepo build system guidance. Triggers on: turbo.json, task pipelines,
  dependsOn, caching, remote cache, the "turbo" CLI, --filter, --affected, CI optimization, environment
  variables, internal packages, monorepo structure/best practices, and boundaries.

  Use when user: configures tasks/workflows/pipelines, creates packages, sets up
  monorepo structure, shares code between apps, runs changed/affected packages, or debugs cache.
metadata:
  version: 2.10.4-canary.1
---

# Turborepo Skill

Build system for JavaScript/TypeScript monorepos. Turborepo caches task outputs and runs tasks in parallel based on dependency graph.

## Rule 1: Package Tasks, Not Root Tasks

**Prefer package tasks over Root Tasks.** When creating tasks/scripts/pipelines:

1. Add the script to each relevant package's `package.json`
2. Register the task in root `turbo.json`
3. Root `package.json` only delegates via `turbo run <task>`

**DO NOT** put task logic in root `package.json` when it can live in packages — it defeats Turborepo's parallelization. Root Tasks (`//#taskname`) are ONLY for tasks that truly cannot exist in packages (e.g. Vitest Projects' `//#test`, repo-wide release scripts, tooling that does not invoke `turbo` itself).

## Rule 2: `turbo run` vs `turbo`

**Always write `turbo run <task>` when the command lands in code** — package.json scripts, CI workflows, any script file. The shorthand `turbo <task>` is ONLY for one-off terminal commands typed directly by humans or agents.

## Quick Decision Trees

**Configure a task** — dependencies/outputs/persistent → `references/configuration/tasks.md`; env vars → `references/environment/RULE.md`; per-package config → `references/configuration/RULE.md#package-configurations`; global settings → `references/configuration/global-options.md`; parallel lint/check-types with correct caching → Transit Nodes in `references/anti-patterns.md`.

**Cache isn't working** — outputs not restored → missing `outputs` key; unexpected misses → `references/caching/gotchas.md`; debug hashes → `--summarize` or `--dry`; skip cache → `--force` or `cache: false`; remote cache → `references/caching/remote-cache.md`; env-driven misses → `references/environment/gotchas.md`.

**Run only changed packages** — `turbo run build --affected` (RECOMMENDED; compares against default branch, includes dependents); custom base → `--affected-base=origin/develop`; manual git comparison → `--filter=...[origin/main]`; all options → `references/filtering/RULE.md`.

**Filter packages** — by name `--filter=web`; by directory `--filter=./apps/*`; plus dependencies `--filter=web...`; plus dependents `--filter=...web`; complex combos → `references/filtering/patterns.md`.

**Environment variables** — vars missing at runtime → Strict mode filtering (default; see `references/environment/modes.md`); cache hits with wrong env → var not in `env` key; `.env` changes not rebuilding → `.env` not in `inputs`; CI vars missing → `references/environment/gotchas.md`; `NEXT_PUBLIC_*` → auto-included via framework inference.

**CI setup** — GitHub Actions → `references/ci/github-actions.md`; Vercel → `references/ci/vercel.md`; remote cache in CI → `references/caching/remote-cache.md`; only changed → `--affected`; skip unnecessary builds/containers → turbo-ignore (`references/cli/commands.md`).

**Watch mode** — re-run on change → `turbo watch` (`references/watch/RULE.md`); dev servers with deps → `with` key (`references/configuration/tasks.md#with`); restart on dep change → `interruptible: true`; long-running → `persistent: true`.

**Create/structure a package** — internal packages, JIT vs Compiled → `references/best-practices/packages.md`; repo structure → `references/best-practices/structure.md`; dependency management → `references/best-practices/dependencies.md`; overview/package types → `references/best-practices/RULE.md`.

**Monorepo structure** — standard `apps/`/`packages/` layout and package types → `references/best-practices/RULE.md`; TypeScript/ESLint config → `references/best-practices/structure.md`; enforce boundaries → `turbo boundaries`, tags and rule types → `references/boundaries/RULE.md`.

## Anti-Patterns & Canonical Configs

Full curated list (shorthand-in-code, `&&` chaining, `prebuild` manual builds, broad `globalDependencies`, `--parallel`, `$TURBO_ROOT$` vs `../`, missing `outputs`, `^build` semantics, `.env` handling, root `.env`, transit nodes, `turbo watch` dev pattern): `references/anti-patterns.md` (table of contents at top).

## Reference Index

| Area          | Files (under `references/`)                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Configuration | `configuration/RULE.md`, `configuration/tasks.md`, `configuration/global-options.md`, `configuration/gotchas.md` |
| Caching       | `caching/RULE.md`, `caching/remote-cache.md`, `caching/gotchas.md`                                 |
| Environment   | `environment/RULE.md`, `environment/modes.md`, `environment/gotchas.md`                            |
| Filtering     | `filtering/RULE.md`, `filtering/patterns.md`                                                       |
| CI/CD         | `ci/RULE.md`, `ci/github-actions.md`, `ci/vercel.md`, `ci/patterns.md`                             |
| CLI           | `cli/RULE.md`, `cli/commands.md`                                                                   |
| Best Practices| `best-practices/RULE.md`, `best-practices/structure.md`, `best-practices/packages.md`, `best-practices/dependencies.md` |
| Watch Mode    | `watch/RULE.md`                                                                                    |
| Boundaries    | `boundaries/RULE.md` (experimental)                                                                |
| Anti-Patterns | `anti-patterns.md` (curated anti-patterns + canonical turbo.json snippets)                         |

## Source Documentation

Based on official Turborepo docs (`apps/docs/content/docs/` upstream; live at https://turborepo.dev/docs). This skill is repo-local: edit here, not via the GitHub mirror.
