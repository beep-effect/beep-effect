// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `lib/common.js`'s HTML tag grammar. Both passes need it: the block pass
// uses OPENTAG/CLOSETAG for HTML block type 7, and the inline pass matches the
// full HTMLTAG union (tags, comments, processing instructions, declarations
// and CDATA) for raw inline HTML.
//
// Leaf module: imports nothing.

const TAGNAME = "[A-Za-z][A-Za-z0-9-]*";
const ATTRIBUTENAME = "[a-zA-Z_:][a-zA-Z0-9:._-]*";
const UNQUOTEDVALUE = "[^\"'=<>`\\x00-\\x20]+";
const SINGLEQUOTEDVALUE = "'[^']*'";
const DOUBLEQUOTEDVALUE = '"[^"]*"';
const ATTRIBUTEVALUE = `(?:${UNQUOTEDVALUE}|${SINGLEQUOTEDVALUE}|${DOUBLEQUOTEDVALUE})`;
const ATTRIBUTEVALUESPEC = `(?:\\s*=\\s*${ATTRIBUTEVALUE})`;
const ATTRIBUTE = `(?:\\s+${ATTRIBUTENAME}${ATTRIBUTEVALUESPEC}?)`;

/**
 * Matches an opening tag, with attributes and an optional self-closing slash.
 *
 * **Example** (Match an attributed opening tag)
 *
 * ```ts
 * import { OPENTAG } from "@beep/scratchpad/effected/markdown/internal/htmlTags"
 *
 * const openingTag = new RegExp(`^${OPENTAG}$`)
 * console.log(openingTag.test('<img src="photo.png" />')) // true
 * console.log(openingTag.test("</img>")) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const OPENTAG = `<${TAGNAME}${ATTRIBUTE}*\\s*/?>`;

/**
 * Matches a closing tag in the CommonMark HTML grammar.
 *
 * **Example** (Match a closing tag)
 *
 * ```ts
 * import { CLOSETAG } from "@beep/scratchpad/effected/markdown/internal/htmlTags"
 *
 * const closingTag = new RegExp(`^${CLOSETAG}$`)
 * console.log(closingTag.test("</section >")) // true
 * console.log(closingTag.test("<section>")) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const CLOSETAG = `</${TAGNAME}\\s*[>]`;

const HTMLCOMMENT = "<!-->|<!--->|<!--[\\s\\S]*?-->";
const PROCESSINGINSTRUCTION = "[<][?][\\s\\S]*?[?][>]";
const DECLARATION = "<![A-Za-z]+[^>]*>";
const CDATA = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";

/**
 * Matches everything CommonMark counts as raw HTML.
 *
 * **Details**
 *
 * The union includes opening and closing tags, comments, processing instructions,
 * declarations and CDATA.
 *
 * **Example** (Recognize raw HTML forms)
 *
 * ```ts
 * import { HTMLTAG } from "@beep/scratchpad/effected/markdown/internal/htmlTags"
 *
 * const rawHtml = new RegExp(`^${HTMLTAG}$`)
 * console.log(rawHtml.test("<!-- comment -->")) // true
 * console.log(rawHtml.test("<![CDATA[text]]>")) // true
 * console.log(rawHtml.test("plain text")) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const HTMLTAG = `(?:${OPENTAG}|${CLOSETAG}|${HTMLCOMMENT}|${PROCESSINGINSTRUCTION}|${DECLARATION}|${CDATA})`;

/**
 * Matches {@link HTMLTAG} at the beginning of the text supplied at a cursor.
 *
 * **Details**
 *
 * The expression is anchored for matching at a cursor; it can consume an HTML
 * prefix without requiring the remaining text to be HTML.
 *
 * **Example** (Match raw HTML at the current cursor)
 *
 * ```ts
 * import { reHtmlTag } from "@beep/scratchpad/effected/markdown/internal/htmlTags"
 *
 * console.log(reHtmlTag.exec("<em>text")?.[0]) // <em>
 * console.log(reHtmlTag.test("text<em>")) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const reHtmlTag = new RegExp(`^${HTMLTAG}`);
