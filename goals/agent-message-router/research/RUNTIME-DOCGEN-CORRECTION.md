# Runtime documentation correction

Date: 2026-10-09. Supplemental receipt for PR #1571 head `36c275` Docgen failure.
The earlier runtime behavior and live proof receipts retain their original source
hashes; this receipt binds the subsequent comment-only correction.

`runAgentMessageDispatchLoop` used unsupported `@category operations`. The only
source change is canonical `@category processes`. Runtime control flow, storage
retry bounds, inference submission count, tests and authorization are unchanged.

Current `AgentMessage.runtime.ts` SHA-256:
`8fee489e01b557bd6f343301f9d9ad646f1f4ed2960a951a6cf98a6727ce65c2`.

Validation:

- Before correction, `bun run beep docgen check --package @beep/repo-cli` failed
  with the same unknown-category diagnostic as hosted Docgen.
- After correction, the identical command exited 0 and reported
  `docgen: OK packages/tooling/tool/cli`. No proof-manifest reuse was requested.
- `bun run beep quality package-verify @beep/repo-cli --quick` exited 0:
  lint 9.2 seconds; TypeScript check 15.4 seconds.
- Diff whitespace validation passed. No model calls or full package jobs occurred.

The focused checker and hosted full precheck both call
`analyzePackageDocumentation`: respectively
`packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:709` and
`packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:881`. Package
`docgen` generation/example compilation does not substitute for this metadata
check. Quick package verification runs lint/check only. See
[the friction receipt](./OPPORTUNITIES.md) for the prevention requirement.
