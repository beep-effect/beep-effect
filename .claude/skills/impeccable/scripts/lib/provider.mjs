// `.agents/skills` is commonly a symlink to `.claude/skills`, so the same
// provider build can execute under both Claude Code and Codex. Prefer an
// explicit override, then use the runtime markers Codex injects into every
// command; otherwise retain the Claude Code build default.
const providerOverride = process.env.IMPECCABLE_PROVIDER_ID?.trim();
const isCodexRuntime = Boolean(process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID || process.env.CODEX_CI);

export const IMPECCABLE_PROVIDER_ID = providerOverride || (isCodexRuntime ? "codex" : "claude-code");
export const IMPECCABLE_COMMAND_PREFIX = IMPECCABLE_PROVIDER_ID === "codex" ? "$" : "/";
export const IMPECCABLE_COMMAND = `${IMPECCABLE_COMMAND_PREFIX}impeccable`;
