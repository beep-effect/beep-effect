// The differential oracle: commonmark.js 0.31.2, the reference implementation
// our engine is ported from, rendering the same input to HTML so the two can
// be compared normalized.
//
// Test-only. `commonmark` is an exact-pinned devDependency and must never
// appear under `src/` — the product owns its engine outright.
//
// The package ships no type declarations (and DefinitelyTyped's
// `@types/commonmark` is pinned at 0.27, three minors behind the runtime we
// installed, so it would describe a different API than the one we call).
// Rather than depend on stale types, the two calls we make are declared
// locally in commonmark.d.ts — the surface is two classes and two methods.

import * as commonmark from "commonmark";

const parser = new commonmark.Parser();
const renderer = new commonmark.HtmlRenderer();

/**
 * Render markdown to HTML with the reference implementation. Reused
 * instances: commonmark.js's Parser and HtmlRenderer are stateless between
 * calls, and 652 + 250 fresh pairs would dominate the suite's runtime.
 */
export const renderOracleHtml = (markdown: string): string => renderer.render(parser.parse(markdown));
