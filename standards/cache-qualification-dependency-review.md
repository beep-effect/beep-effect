# Direct workspace dependency cache review

The dependency-declaration repair changes the package graph seen by Turbo.
The current census has the same 1,984 executable tasks as the recorded baseline:
no task was added or removed. Across those tasks, 159 dependency lists changed.
Every command, command digest, effective task configuration, and global
configuration matches the previous baseline.

The new edges declare imports that Fallow 3.31 found in runtime code and tests.
The RDF canonicalization integration tests now live in the driver, preventing
a reverse dependency from its contract package. Generated TypeScript references
match the declared graph.

The four qualification-scope tasks have no projection changes:
`@beep/identity#lint`, `@beep/types#lint`, `@beep/fc-runs#lint`, and
`@beep/test-runner#lint`. Retain the existing profile, epoch, scope, and
qualification ledger. The baseline refresh records the dependency graph; it
grants no new qualification.

The following Turbo source digests differed before this repair, while the
effective configurations above remained identical. The refresh records their
current source bytes as well:

- `apps/labs/api-docs/turbo.json`
- `apps/labs/ciops/turbo.json`
- `apps/oip-web/turbo.json`
- `apps/professional-desktop/turbo.json`
- `apps/storybook/turbo.json`
- `apps/todox/turbo.json`
- `packages/foundation/modeling/identity/turbo.json`
- `packages/foundation/primitive/types/turbo.json`
- `packages/tooling/library/ai-sync/turbo.json`
- `packages/tooling/policy-pack/repo-configs/turbo.json`
- `packages/tooling/tool/cli/turbo.json`
- `turbo.json`
