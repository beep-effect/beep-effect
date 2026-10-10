### fable-1-1
- file: scratchpad/effected/markdown/internal/inlines/link.ts:75
- class: bug   severity: required
- standard: D9 / section 14 upstream-bug (spec citation + three reference oracles, uncovered by upstream tests); MarkdownNode.ts:356 Image.alt = "Plain text alternative derived from the image's bracketed content"   evidence: plainTextOf appends `value` only for text/inlineCode/image/imageReference; an `html` node falls into the else branch, has no children, and contributes nothing. Probe (bun -e over parseBlocks): `![a <b>c](/u)` -> alt="a c"; `![a `x` <!-- c --> b](/u)` -> alt="a x  b". Oracles: commonmark.js 0.31.2 HtmlRenderer -> alt="a <b>c" and alt="a x <!-- c --> b"; mdast-util-from-markdown -> alt "a <b>c" / "a x <!-- c --> b"; cmark-gfm 0.29.0.gfm.13 src/html.c:125-128 renders CMARK_NODE_HTML_INLINE into the alt in plain mode. Corpora silent: rg '!\[[^\]]*<' over fixtures/commonmark and fixtures/gfm hits only <![CDATA[ blocks; no mdast fixture has an alt containing '<'.
- failure: Every image (direct or reference) whose description holds raw inline HTML gets a wrong alt (the HTML literal silently vanishes), diverging from the mdast contract the module claims and from both upstream engines; stringify round-trips lose the text.
- fix: At link.ts:75 add `|| node.type === "html"` to the value branch; record the deviation (upstream-bug: commonmark.js 0.31.2 / cmark html.c:125-128 / mdast-util-from-markdown all keep the html literal) in README Port notes -> Deviations and the ledger; add an inline-pass.test.ts case asserting alt === "a <b>c" for `![a <b>c](/u)`.

### fable-1-2
- file: scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:62
- class: law   severity: required
- standard: Operator ruling 2026-10-09 in scratchpad/EFFECTED_PORT_GOAL.md ("lab changes no law, diagnostic or ruling forced ... restore the upstream shape"); EF-18 scope (standards/effect-first-development.md:465: dual is for reusable helper combinators)   evidence: Upstream declares `export const footnoteReferenceFallback: LinkCloseFallback = (scanner, opener, bracketPos, afterBracket) => {...}`; commit fff7ed559c wrapped it in dual(4, ...) with Parameters<LinkCloseFallback>[0|1] types while claiming "only the edits the diagnostics required". No gate asks for it: .oxlintrc.json custom rules are beep/no-js-extension-imports, no-opaque-instance-fields, no-manual-effect-runtime-in-tests, namespace-node-imports, no-global-process-runtime, no-inline-schema-compile; `rg -il dual ~/YeeBois/references/effect/effect-tsgo/docs/rules/` is empty; terse-effect's only dual check (TerseEffect.ts:546 isExplicitDualOverloadCandidate) inspects exported `function` declarations with overloads. The symbol's sole consumer is makeLinkCloseConstruct(footnoteReferenceFallback) at footnoteReference.ts:116; nothing calls the data-last form (opener, bracketPos, afterBracket)(scanner), which has no meaning for a seam callback.
- failure: An unforced shape change on the hot path: every `]` that closes no link under gfm now pays dual's arguments.length dispatch, and the declaration reads through Parameters<LinkCloseFallback>[n] instead of InlineScanner/Bracket. scanDelims (emphasis.ts:47) and insertStrikethrough (strikethrough.ts:80) are reusable helpers EF-18 covers; this one is not.
- fix: Restore `export const footnoteReferenceFallback: LinkCloseFallback = (scanner, opener, bracketPos, afterBracket) => { ... };` and drop the dual import at footnoteReference.ts:35.

### fable-1-3
- file: scratchpad/effected/markdown/internal/inlines/strikethrough.ts:44
- class: bug   severity: backlog
- standard: strikethrough.ts header and gfm-inlines.test.ts:4 ("Semantics authority is cmark-gfm 0.29.0.gfm.13"); D9   evidence: handleTilde reuses scanDelims, whose rePunctuation (emphasis.ts:23, identical to commonmark.js 0.31.2 inlines.js:37) is \p{P}\p{S}; cmark-gfm 0.29.0.gfm.13 src/utf8.c:255-256 cmark_utf8proc_is_punctuation "matches anything in the P[cdefios] classes" (no symbols) and scan_delimiters feeds that into both flanking flags. Probe: `a~€b~` (gfm) -> "a~€b~" in the lab; with P-only flanking the opener before € is left-flanking, so cmark-gfm pairs it (a<del>€b</del>). fixtures/gfm/extensions.json has no symbol-adjacent tilde. Upstream @effected is byte-identical here.
- failure: Tildes adjacent to a Unicode symbol (currency, arrows, emoji) refuse to open/close where cmark-gfm pairs them; the same drift for emphasis is sanctioned by the 0.31.2 spec corpus, but the gfm dialect's stated authority is the C.
- fix: Either record the choice (strikethrough.ts header + README Port notes -> Deviations: `~` flanking uses the 0.31 punctuation class shared with emphasis; cmark-gfm 0.29.0.gfm.13 is P-only) or let scanDelims take the punctuation predicate so `~` uses /^[!-\/:-@[-`{-~\p{P}]/u; add a gfm-inlines case for `a~€b~` pinning whichever is chosen. Backlog: a dialect-version choice shared with upstream, so section 14's cause is arguable.

### fable-1-4
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:124
- class: test   severity: backlog
- standard: Section 11.3 (an unreachable branch is a finding against the source; S3 per-file 100% branches)   evidence: autolinkDelim enters the `;` arm with linkEnd < 2 only when subject.charAt(base) is `;`; base is the `w` of `www.` (:251), the `:` of a scheme (:300) or the `@` of an email run (:442), and the email scan (:404-429) breaks at `;` before autolinkDelim sees it, while www/url runs begin with at least 4 non-`;` characters. In JS newEnd = linkEnd - 2 cannot underflow, so lines 121-127 guard a C-only hazard the TS arithmetic already survives (newEnd = -1 -> loop skipped -> linkEnd -= 1).
- failure: S3's branch gate will red on dead code; the comment claims a trimming behaviour no input can observe.
- fix: Delete lines 121-127 and fold the underflow note into the surrounding comment; no behaviour change.

REQUIRED: 2
BACKLOG: 2
