// `.agents/skills` is allowed to share this source tree with Claude Code. In
// that layout Node resolves the symlink before evaluating this module, so the
// source path cannot identify the caller. Codex supplies stable session
// markers; use those to select its hook manifest and `$` command spelling.
const isCodexRuntime = ["CODEX_CI", "CODEX_SESSION_ID", "CODEX_THREAD_ID"].some(
  (name) => typeof process.env[name] === "string" && process.env[name].length > 0
);

export const IMPECCABLE_COMMAND_PREFIX = isCodexRuntime ? "$" : "/";
export const IMPECCABLE_PROVIDER_ID = isCodexRuntime ? "codex" : "claude-code";
export const IMPECCABLE_COMMAND = `${IMPECCABLE_COMMAND_PREFIX}impeccable`;
