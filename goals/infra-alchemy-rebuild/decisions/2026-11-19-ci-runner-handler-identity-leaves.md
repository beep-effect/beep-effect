---
title: "CI runner handler bundles take their identity composer from a package-local leaf"
date: 2026-11-19
lane: "fix/ci-runner-handler-identity-leaves"
reversal: "point the modules of @beep/schema, @beep/alchemy-github-runners and @beep/infra-ci-runners back at @beep/identity/packages, delete their src/internal/*Id.ts leaves, @beep/identity/Root and the IdentityLeaf, SchemaIdLeaf, Root and HandlerBundles tests"
---

Until now every module took its identity composer from the registry module, @beep/identity/packages. That module holds one composer per workspace package, so its text changes whenever a package is registered. Alchemy hashes each Lambda zip with its source map, and the source map embeds the text of every module the handler loads. The CiRunners handlers (seven entries in @beep/alchemy-github-runners, the reaper in @beep/infra-ci-runners) all loaded the registry through $AlchemyGithubRunnersId, $InfraCiRunnersId and $SchemaId, so registering any package anywhere in the monorepo planned all 11 functions as code updates. Making each registry export a pure leaf (PR 3422) shrinks the minified code but leaves the whole file in the source map.

The law is amended for packages whose modules a deployed handler bundle loads:

- Such a package takes its composer from a package-local leaf, src/internal/<Composer>.ts, that derives it from $BeepId in @beep/identity/Root. Root imports only Id.ts, so the handler graph no longer reaches the registry. The rule covers every module of the package, not only the ones a handler loads today: @beep/schema (87 modules), @beep/alchemy-github-runners (25) and @beep/infra-ci-runners (6).
- The registry stays the one list beep create-package and beep lint identity-registry read and write. The three registry entries are untouched, so the leaf form PR 3422 requires of them still holds. A leaf cannot drift from its registry entry unnoticed: tests in each package assert the leaf equals the registry composer for the same slug, and in @beep/identity that $BeepId equals $I.
- A guard test in @beep/infra-ci-runners builds the eight handler entries with Alchemy's bundler and the options of its Lambda bundle plan, and fails if any source map lists identity/src/packages.ts.
- Every other package keeps importing its composer from @beep/identity/packages.

The identifiers do not change. Rebuilt bundles differ from main only in module wiring: the registry's compose calls and its three extra create calls are gone and the leaves add one create per composer; every other create, make and annotation argument is identical, and each bundle is about 6.8 KB smaller.
