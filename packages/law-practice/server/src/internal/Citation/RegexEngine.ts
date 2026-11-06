/** Source engine identity, independent of runtime process selection.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeServerId.create("internal/Citation/RegexEngine");
/** Exact pinned character/parser dialect; no execution authority.
 * @internal @category models @since 0.0.0
 */
export const CitationRegexEngine = LiteralKit(["python-re", "python-regex-v0"]).pipe(
  $I.annoteSchema("CitationRegexEngine", {
    description: "CPython 3.11.15 re or regex 2023.12.25 V0; never inferred from flags.",
  })
);

/** Captured explicit flags; Unicode remains implicit in each source engine.
 * @internal @category models @since 0.0.0
 */
export const CitationRegexSourceFlags = LiteralKit([0, 2, 64, 66]).pipe(
  $I.annoteSchema("CitationRegexSourceFlags", {
    description: "No flags, ignore-case, verbose or their combination; other flags remain unqualified.",
  })
);
