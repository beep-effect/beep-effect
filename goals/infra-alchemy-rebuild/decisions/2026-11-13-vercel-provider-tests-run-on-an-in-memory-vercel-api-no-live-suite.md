---
title: "Vercel provider tests run on an in-memory Vercel API, no live suite"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-vercel"
reversal: "Add an opt-in live suite behind an environment flag that creates and deletes a scratch project, never touching oip.law."
---

The 14 provider tests use `@alchemy.run/test/Vitest` (`Test.make`, `test.provider`, `stack.deploy/destroy`) over `Vercel.resources` with a fake `HttpClient` (`test/harness/FakeVercel.ts`) that keeps projects, env vars and domains in memory and answers with the fields distilled's response schemas require. They cover create, update, delete, read and adopt for each resource, delete-first replacement, the domain move and the owned/unowned read distinction, and need no token in CI. The package's vitest config inlines `alchemy` so the engine and the providers share one module instance (the `Unowned` brand is module-private). No live test was run; none touched the oip.law project.
