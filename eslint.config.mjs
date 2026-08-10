import { DeprecatedApisESLintConfig } from "@beep/repo-configs/eslint/DeprecatedApisESLintConfig";
import { DocsESLintConfig } from "@beep/repo-configs/eslint/DocsESLintConfig";
import { globalIgnores } from "eslint/config";

const eslintProfile = process.env.BEEP_ESLINT_PROFILE ?? "docs";

// The default profile is the docs/jsdoc lane. The deprecated vendor API gate is
// selected by `bun run lint:deprecated-apis`, which sets this profile inside the
// repo CLI before loading the shared config.
const selectedESLintConfig = (() => {
  if (eslintProfile === "deprecated-apis") {
    return DeprecatedApisESLintConfig;
  }

  if (eslintProfile === "docs") {
    return DocsESLintConfig;
  }

  throw new Error(`Unsupported BEEP_ESLINT_PROFILE: ${eslintProfile}`);
})();

// `.claude/worktrees/**` holds session-local linked worktrees (other checkouts'
// files that CI never sees); linting them couples this clone's gate to whatever
// those sessions have checked out.
export default [globalIgnores(["**/src-tauri/target/**", ".claude/worktrees/**"]), ...selectedESLintConfig];
