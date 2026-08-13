/**
 * Dependency-free lint subcommand routing data shared by the CLI entrypoint and
 * the Quality schema domain.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

const subcommands = <const T extends ReadonlyArray<string>>(...values: T): T => values;

const LINT_POLICY_SUBCOMMANDS = subcommands(
  "circular",
  "deprecated-apis",
  "ecosystem-polarity",
  "goal-packets",
  "identity-registry",
  "judge-rubric",
  "package-test-imports",
  "package-test-typecheck",
  "policy",
  "reflection-artifacts",
  "roadmap-refs",
  "schema-catalog",
  "schema-first",
  "schema-topology",
  "tooling-schema-first"
);

export { LINT_POLICY_SUBCOMMANDS };
