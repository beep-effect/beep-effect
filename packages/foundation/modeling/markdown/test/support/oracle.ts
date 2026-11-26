// decision: commonmark-js-differential-oracle
// decision: local-commonmark-declarations

import * as commonmark from "commonmark";

const parser = new commonmark.Parser();
const renderer = new commonmark.HtmlRenderer();

/**
 * Render markdown to HTML with the reference implementation. Reused
 * instances: commonmark.js's Parser and HtmlRenderer are stateless between
 * calls, and 652 + 250 fresh pairs would dominate the suite's runtime.
 */
export const renderOracleHtml = (markdown: string): string => renderer.render(parser.parse(markdown));
