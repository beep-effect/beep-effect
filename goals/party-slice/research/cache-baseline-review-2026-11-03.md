# Party slice cache configuration review — 2026-11-03

Reviewer: Codex, party-slice completion owner.

This records only the tasks named by the local cache audit. Qualification scope,
profile, epoch, cache flags and outputs are unchanged. New package tasks inherit
the repository defaults and remain unqualified; recording their existence does
not claim replay correctness or grant new qualified reuse.

## Reviewed changed inputs

- `@beep/law-practice-server`: its manifest adds the domain-neutral party port and
  native parser test dependencies. The test command runs the native TypeScript
  boundary test under Node after the Bun suite because the parser's stdio bridge
  requires it. Manifest bytes change the package's review basis. Its tsconfigs
  gain the party use-cases reference. The full package verifier passed.
- `@beep/party-domain`: its manifest adds the foundation epistemics, shared domain
  and utils dependencies; its tsconfig references follow those dependencies.
  Existing command words and output declarations are retained.
- `@beep/party-server` and `@beep/party-use-cases`: new packages created through
  the canonical generator, with standard build/check/lint/test/docgen scripts.
  Their manifests and tsconfigs declare their explicit slice dependencies.

## Audit-named tasks

- `@beep/law-practice-server#build`
- `@beep/law-practice-server#check`
- `@beep/law-practice-server#docgen`
- `@beep/law-practice-server#doctest`
- `@beep/law-practice-server#lint`
- `@beep/law-practice-server#lint:deprecated-apis`
- `@beep/law-practice-server#lint:jsdoc`
- `@beep/law-practice-server#lint:laws`
- `@beep/law-practice-server#test`
- `@beep/party-domain#build`
- `@beep/party-domain#check`
- `@beep/party-domain#lint:deprecated-apis`
- `@beep/party-domain#test`
- `@beep/party-server#build`
- `@beep/party-server#check`
- `@beep/party-server#docgen`
- `@beep/party-server#lint`
- `@beep/party-server#lint:deprecated-apis`
- `@beep/party-server#lint:jsdoc`
- `@beep/party-server#lint:laws`
- `@beep/party-server#test`
- `@beep/party-use-cases#build`
- `@beep/party-use-cases#check`
- `@beep/party-use-cases#docgen`
- `@beep/party-use-cases#lint`
- `@beep/party-use-cases#lint:deprecated-apis`
- `@beep/party-use-cases#lint:jsdoc`
- `@beep/party-use-cases#lint:laws`
- `@beep/party-use-cases#test`

The audit also reports source drift for `turbo.json`. This lane does not modify
that file, and this review does not attribute its bytes to party work or grant
an exception. The final audit after syncing main must establish its status.

## Root subject review added after baseline validation

The baseline validator additionally names `//`. Root `package.json` registers
both generated packages, `tsconfig.json` adds their public aliases and the
law-practice adapter alias, `tsconfig.packages.json` registers project references,
and the generated Vitest aliases and Fallow boundary inventory include them.
These are actual root registration input changes. Root commands, outputs and
qualification remain unchanged. The root subject is included to record that
changed workspace configuration; this does not attribute an edit to turbo.json.
