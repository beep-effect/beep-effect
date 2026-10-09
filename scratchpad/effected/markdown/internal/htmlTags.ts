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

/** An opening tag, with any attributes and an optional self-closing slash. */
export const OPENTAG = `<${TAGNAME}${ATTRIBUTE}*\\s*/?>`;

/** A closing tag. */
export const CLOSETAG = `</${TAGNAME}\\s*[>]`;

const HTMLCOMMENT = "<!-->|<!--->|<!--[\\s\\S]*?-->";
const PROCESSINGINSTRUCTION = "[<][?][\\s\\S]*?[?][>]";
const DECLARATION = "<![A-Za-z]+[^>]*>";
const CDATA = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";

/** Everything CommonMark counts as raw HTML. */
export const HTMLTAG = `(?:${OPENTAG}|${CLOSETAG}|${HTMLCOMMENT}|${PROCESSINGINSTRUCTION}|${DECLARATION}|${CDATA})`;

/** {@link HTMLTAG}, anchored for matching at a cursor. */
export const reHtmlTag = new RegExp(`^${HTMLTAG}`);
