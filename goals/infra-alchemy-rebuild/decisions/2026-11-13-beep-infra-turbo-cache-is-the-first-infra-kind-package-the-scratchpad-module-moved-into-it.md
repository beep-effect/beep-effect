---
title: "@beep/infra-turbo-cache is the first infra-kind package; the scratchpad module moved into it"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "git mv the modules back to scratchpad/turbo-cache-r2, restore its test:turbo-cache-r2 script and Alchemy dependencies, drop packages/tooling/infra/* from root workspaces and remove the package."
---

Created with `bun run beep create-package infra-turbo-cache --family tooling --kind infra --dir-name turbo-cache` at `packages/tooling/infra/turbo-cache`: the directory drops the `infra-` prefix the kind segment already carries, as `tool/cli` does for `@beep/repo-cli`. The scaffold appended an explicit workspace path; it is replaced by the `packages/tooling/infra/*` glob beside the other tooling kinds, so later infra packages need no root edit. Every scratchpad file moved with `git mv` (handler to `src/Protocol.ts`, binding to `src/Bucket.ts`, constructor to `src/TurboCache.ts`, state reader to `src/internal/StateReader.ts`, handoff to `src/TokenHandoff.ts`, the CLI to `token.ts` at the package root beside `alchemy.run.ts`); `config.ts` and `token-failure.ts` folded into their users. `Protocol` and `Bucket` are public modules, not `internal/`, because the test Worker fixtures that import them are bundled by Alchemy with plain package resolution, which honours the exports map. `scratchpad/turbo-cache-r2`, its `test:turbo-cache-r2` script and the scratchpad's `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/test` dependencies are gone.
