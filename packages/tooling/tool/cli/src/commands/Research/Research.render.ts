/**
 * Render helpers for research command output and notes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import { printLines } from "../../internal/cli/Printer.ts";

/**
 * Render an Obsidian wikilink for a catalog card path.
 *
 * **Example** (Render catalog card wikilink)
 *
 * ```ts
 * import { wikilinkFor } from "@beep/repo-cli/commands/Research"
 *
 * console.log(wikilinkFor("Articles/example.md", "Example"))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const wikilinkFor: {
  (cardPath: string, title: string | null): string;
  (title: string | null): (cardPath: string) => string;
} = dual(2, (cardPath: string, title: string | null): string => {
  const target = cardPath.replace(/\.md$/, "");
  const label = title ?? target.split("/").pop() ?? target;
  return `[[${target}|${label}]]`;
});

/**
 * Print the research command index.
 *
 * **Example** (Verify Effect pipe support)
 *
 * ```ts
 * import { printResearchIndex } from "@beep/repo-cli/commands/Research"
 *
 * console.log(printResearchIndex.pipe !== undefined) // true
 * ```
 *
 * @effects Writes the research command index to the configured console when the returned Effect is executed.
 * @category cli-commands
 * @since 0.0.0
 */
export const printResearchIndex = printLines([
  "Research commands:",
  "- bun run beep research capture <url> --tags effect,schema",
  "- bun run beep research history-sift --since-days 7 --browser all",
  "- bun run beep research repo-card --research-root ~/YeeBois/research --stars",
  '- bun run beep research notion-pull --page <page-id> (or --database "Awesome X Posts" / --links-file file.json)',
  "- bun run beep research cognify [--dry-run] (needs COGNEE_API_URL)",
  "- bun run beep research digest [--date YYYY-MM-DD]",
  "- bun run beep research daily --commit [--page <notion-page-id>]",
  "- bun run beep research install-timers [--uninstall] [--page <notion-page-id>]",
  "- bun run beep research status",
  "Vault resolution: --vault flag, BEEP_KNOWLEDGE_VAULT env, or ~/YeeBois/knowledge.",
]);
