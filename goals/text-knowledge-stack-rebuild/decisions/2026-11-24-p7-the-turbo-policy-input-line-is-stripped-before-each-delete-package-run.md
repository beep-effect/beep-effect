---
title: "P7: each package's turbo.json policy-fingerprint input line is stripped by hand before its delete-package run, and the writer then proves the result"
date: 2026-11-24
lane: "p7"
reversal: "Commit a delete-package acknowledgement file naming the turbo.json occurrence and remove the line after the run with the fingerprint writer"
---

Both delete-package dry runs list `turbo.json` as a hard `file-path` hit: one input line each in the `//#lint:policy-fingerprint` task (`turbo.json:210`), the retired `@beep/nlp` manifest at `:400` and the schema-org manifest at `:410`. The first draft said `bun run beep lint policy-fingerprint --write` rewrites them before the run. It cannot: the writer derives those inputs from "the manifests that declare policy scripts" and reads every workspace manifest (`packages/tooling/tool/cli/src/commands/Lint/PolicyFingerprint.ts:20-22`, `:372`), and both manifests still declare `lint:jsdoc`, `lint:laws` and `lint:deprecated-apis`, so while either tree exists `--write` writes its line back. `delete-package` has no turbo step of its own.

The line is therefore stripped by hand in the deleting commit, before the run, as P2's deleting commit removed the provenance line (`010f21e3934`, `turbo.json` 1 line out). After the run, with the manifest gone, `bun run beep lint policy-fingerprint --write` rewrites `standards/policy-tools.fingerprint.json` and cannot restore the line, and `--check` proves the result.

The alternative, a committed `--acknowledge` JSONC naming the one occurrence (`packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts:680-694`, schema in `DeletePackage.schemas.ts`), was rejected: it adds a committed file whose `target` field names the retired package, which the nlp exit would then have to exclude too, and the line still has to leave afterwards.
