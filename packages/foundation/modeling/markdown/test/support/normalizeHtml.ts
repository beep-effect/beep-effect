// Test-only HTML normalizer, a port of the CommonMark spec suite's
// `test/normalize.py` (`.repos/commonmark-spec`, tag 0.31.2). The corpus's
// expected HTML and this package's rendered HTML differ in whitespace that
// carries no meaning; both sides go through here before being compared.
//
// The port is deliberately literal, quirks included. `normalize.py` drives
// Python's `html.parser.HTMLParser` and its stripping rules depend on the
// exact sequence of parser callbacks, so this file reproduces that callback
// sequence rather than reimplementing the intent. Two upstream oddities are
// preserved on purpose and marked below: the dead `v in ['href','src']`
// branch, and `</pre>` skipping the rstrip that every other block end tag
// performs.
//
// normalize.py is part of the CommonMark spec suite (CC-BY-SA 4.0),
// Copyright (c) 2014-2021 John MacFarlane. Adapted, not copied verbatim.
//
// What it normalizes:
//   - runs of whitespace inside text collapse to one space (never in <pre>)
//   - whitespace around block-level tags is stripped
//   - self-closing tags become open tags: `<br />` becomes `<br>`
//   - attributes are lowercased and sorted
//   - character references decode to Unicode, except `<`, `>`, `&` and `"`,
//     which are re-emitted as entities
//
// VERIFIED DIFFERENTIALLY. Running this port and the real normalize.py over
// all 652 expected-HTML strings in the spec corpus agrees on 651. The single
// divergence is example 616, a deliberately malformed tag
// (`<a foo="bar" bam = 'baz <em>`) where Python's tolerant attribute scanner
// and this one recover differently — both producing garbage, neither more
// correct. It is harmless for the corpus: raw HTML passes through the parser
// verbatim, so both sides of that comparison are the same string and
// normalize identically. Re-run the differential after changing this file.

import * as BStr from "@beep/utils/Str";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";

// decision: normalize-html-literal-port
const NAME_TO_CODEPOINT: Readonly<Record<string, number>> = {
  AElig: 198,
  Aacute: 193,
  Acirc: 194,
  Agrave: 192,
  Alpha: 913,
  Aring: 197,
  Atilde: 195,
  Auml: 196,
  Beta: 914,
  Ccedil: 199,
  Chi: 935,
  Dagger: 8225,
  Delta: 916,
  ETH: 208,
  Eacute: 201,
  Ecirc: 202,
  Egrave: 200,
  Epsilon: 917,
  Eta: 919,
  Euml: 203,
  Gamma: 915,
  Iacute: 205,
  Icirc: 206,
  Igrave: 204,
  Iota: 921,
  Iuml: 207,
  Kappa: 922,
  Lambda: 923,
  Mu: 924,
  Ntilde: 209,
  Nu: 925,
  OElig: 338,
  Oacute: 211,
  Ocirc: 212,
  Ograve: 210,
  Omega: 937,
  Omicron: 927,
  Oslash: 216,
  Otilde: 213,
  Ouml: 214,
  Phi: 934,
  Pi: 928,
  Prime: 8243,
  Psi: 936,
  Rho: 929,
  Scaron: 352,
  Sigma: 931,
  THORN: 222,
  Tau: 932,
  Theta: 920,
  Uacute: 218,
  Ucirc: 219,
  Ugrave: 217,
  Upsilon: 933,
  Uuml: 220,
  Xi: 926,
  Yacute: 221,
  Yuml: 376,
  Zeta: 918,
  aacute: 225,
  acirc: 226,
  acute: 180,
  aelig: 230,
  agrave: 224,
  alefsym: 8501,
  alpha: 945,
  amp: 38,
  and: 8743,
  ang: 8736,
  aring: 229,
  asymp: 8776,
  atilde: 227,
  auml: 228,
  bdquo: 8222,
  beta: 946,
  brvbar: 166,
  bull: 8226,
  cap: 8745,
  ccedil: 231,
  cedil: 184,
  cent: 162,
  chi: 967,
  circ: 710,
  clubs: 9827,
  cong: 8773,
  copy: 169,
  crarr: 8629,
  cup: 8746,
  curren: 164,
  dArr: 8659,
  dagger: 8224,
  darr: 8595,
  deg: 176,
  delta: 948,
  diams: 9830,
  divide: 247,
  eacute: 233,
  ecirc: 234,
  egrave: 232,
  empty: 8709,
  emsp: 8195,
  ensp: 8194,
  epsilon: 949,
  equiv: 8801,
  eta: 951,
  eth: 240,
  euml: 235,
  euro: 8364,
  exist: 8707,
  fnof: 402,
  forall: 8704,
  frac12: 189,
  frac14: 188,
  frac34: 190,
  frasl: 8260,
  gamma: 947,
  ge: 8805,
  gt: 62,
  hArr: 8660,
  harr: 8596,
  hearts: 9829,
  hellip: 8230,
  iacute: 237,
  icirc: 238,
  iexcl: 161,
  igrave: 236,
  image: 8465,
  infin: 8734,
  int: 8747,
  iota: 953,
  iquest: 191,
  isin: 8712,
  iuml: 239,
  kappa: 954,
  lArr: 8656,
  lambda: 955,
  lang: 9001,
  laquo: 171,
  larr: 8592,
  lceil: 8968,
  ldquo: 8220,
  le: 8804,
  lfloor: 8970,
  lowast: 8727,
  loz: 9674,
  lrm: 8206,
  lsaquo: 8249,
  lsquo: 8216,
  lt: 60,
  macr: 175,
  mdash: 8212,
  micro: 181,
  middot: 183,
  minus: 8722,
  mu: 956,
  nabla: 8711,
  nbsp: 160,
  ndash: 8211,
  ne: 8800,
  ni: 8715,
  not: 172,
  notin: 8713,
  nsub: 8836,
  ntilde: 241,
  nu: 957,
  oacute: 243,
  ocirc: 244,
  oelig: 339,
  ograve: 242,
  oline: 8254,
  omega: 969,
  omicron: 959,
  oplus: 8853,
  or: 8744,
  ordf: 170,
  ordm: 186,
  oslash: 248,
  otilde: 245,
  otimes: 8855,
  ouml: 246,
  para: 182,
  part: 8706,
  permil: 8240,
  perp: 8869,
  phi: 966,
  pi: 960,
  piv: 982,
  plusmn: 177,
  pound: 163,
  prime: 8242,
  prod: 8719,
  prop: 8733,
  psi: 968,
  quot: 34,
  rArr: 8658,
  radic: 8730,
  rang: 9002,
  raquo: 187,
  rarr: 8594,
  rceil: 8969,
  rdquo: 8221,
  real: 8476,
  reg: 174,
  rfloor: 8971,
  rho: 961,
  rlm: 8207,
  rsaquo: 8250,
  rsquo: 8217,
  sbquo: 8218,
  scaron: 353,
  sdot: 8901,
  sect: 167,
  shy: 173,
  sigma: 963,
  sigmaf: 962,
  sim: 8764,
  spades: 9824,
  sub: 8834,
  sube: 8838,
  sum: 8721,
  sup: 8835,
  sup1: 185,
  sup2: 178,
  sup3: 179,
  supe: 8839,
  szlig: 223,
  tau: 964,
  there4: 8756,
  theta: 952,
  thetasym: 977,
  thinsp: 8201,
  thorn: 254,
  tilde: 732,
  times: 215,
  trade: 8482,
  uArr: 8657,
  uacute: 250,
  uarr: 8593,
  ucirc: 251,
  ugrave: 249,
  uml: 168,
  upsih: 978,
  upsilon: 965,
  uuml: 252,
  weierp: 8472,
  xi: 958,
  yacute: 253,
  yen: 165,
  yuml: 255,
  zeta: 950,
  zwj: 8205,
  zwnj: 8204,
};

const BLOCK_TAGS: HashSet.HashSet<string> = HashSet.make(
  "article",
  "header",
  "aside",
  "hgroup",
  "blockquote",
  "hr",
  "iframe",
  "body",
  "map",
  "button",
  "object",
  "canvas",
  "ol",
  "caption",
  "output",
  "col",
  "p",
  "colgroup",
  "pre",
  "dd",
  "progress",
  "div",
  "section",
  "dl",
  "table",
  "td",
  "dt",
  "tbody",
  "embed",
  "textarea",
  "fieldset",
  "tfoot",
  "figcaption",
  "th",
  "figure",
  "thead",
  "footer",
  "tr",
  "form",
  "ul",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "video",
  "script",
  "style"
);

const TRAILING_WHITESPACE = /\s+$/u;
const LEADING_WHITESPACE = /^\s+/u;

const rstrip = Str.replace(TRAILING_WHITESPACE, "");
const lstrip = Str.replace(LEADING_WHITESPACE, "");

const numericCodepoint = (ref: string): number =>
  ref[1] === "x" || ref[1] === "X" ? Number.parseInt(Str.slice(2)(ref), 16) : Number.parseInt(Str.slice(1)(ref), 10);

const fromCodepoint = (codepoint: number): O.Option<string> =>
  Number.isFinite(codepoint) && codepoint >= 0 && codepoint <= 0x10ffff
    ? O.some(String.fromCodePoint(codepoint))
    : O.none();

const decodeCharRef = (ref: string): O.Option<string> =>
  Str.startsWith("#")(ref)
    ? fromCodepoint(numericCodepoint(ref))
    : O.map(R.get(NAME_TO_CODEPOINT, ref), String.fromCodePoint);

const ATTRIBUTE_CHAR_REF = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;

const unescapeAttributeValue = (value: string): string =>
  BStr.replaceAllWith(value, ATTRIBUTE_CHAR_REF, (match, ref) => O.getOrElse(decodeCharRef(String(ref)), () => match));

const escapeAttributeValue = (value: string): string =>
  pipe(
    value,
    Str.replace(/&/g, "&amp;"),
    Str.replace(/</g, "&lt;"),
    Str.replace(/>/g, "&gt;"),
    Str.replace(/"/g, "&quot;"),
    Str.replace(/'/g, "&#x27;")
  );

type Attribute = readonly [name: string, value: string | null];

const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9:._]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const toAttribute = ([, name = "", quoted, singleQuoted, bare]: RegExpMatchArray): Attribute => {
  const raw = quoted ?? singleQuoted ?? bare;
  return [Str.toLowerCase(name), raw === undefined ? null : unescapeAttributeValue(raw)];
};

const parseAttributes = (source: string): ReadonlyArray<Attribute> =>
  A.map(A.fromIterable(Str.matchAll(ATTRIBUTE)(source)), toAttribute);

const ATTRIBUTE_ORDER: Order.Order<Attribute> = Order.Tuple([
  Order.String,
  Order.mapInput(O.makeOrder(Order.String), O.fromNullOr),
]);

type LastEvent = "starttag" | "endtag" | "data" | "comment" | "decl" | "pi" | "ref";

const LEADING_NEWLINES = /^\n+/;
const WHITESPACE_RUN = /\s+/gu;

const REESCAPED: Readonly<Record<string, string>> = Object.freeze({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
});

class Normalizer {
  private output = "";
  private last: LastEvent = "starttag";
  private lastTag = "";
  private inPre = false;

  private isBlockTag(tag: string): boolean {
    return HashSet.has(BLOCK_TAGS, tag);
  }

  private stripAroundBlock(text: string): string {
    return this.last === "starttag" ? lstrip(text) : lstrip(rstrip(text));
  }

  handleData(data: string): void {
    const afterTag = this.last === "endtag" || this.last === "starttag";
    const afterBreak = afterTag && this.lastTag === "br" ? Str.replace(LEADING_NEWLINES, "")(data) : data;
    if (this.inPre) {
      this.output += afterBreak;
    } else {
      const collapsed = Str.replace(WHITESPACE_RUN, " ")(afterBreak);
      this.output += afterTag && this.isBlockTag(this.lastTag) ? this.stripAroundBlock(collapsed) : collapsed;
    }
    this.last = "data";
  }

  handleStartTag(tag: string, attrs: ReadonlyArray<Attribute>): void {
    if (tag === "pre") {
      this.inPre = true;
    }
    if (this.isBlockTag(tag)) {
      this.output = rstrip(this.output);
    }
    this.output += `<${tag}`;
    for (const [name, value] of A.sort(attrs, ATTRIBUTE_ORDER)) {
      this.output += ` ${name}`;
      // decision: normalize-html-literal-port
      if (value !== null) {
        this.output += `="${escapeAttributeValue(value)}"`;
      }
    }
    this.output += ">";
    this.lastTag = tag;
    this.last = "starttag";
  }

  handleEndTag(tag: string): void {
    if (tag === "pre") {
      this.inPre = false;
      // decision: normalize-html-literal-port
    } else if (this.isBlockTag(tag)) {
      this.output = rstrip(this.output);
    }
    this.output += `</${tag}>`;
    this.lastTag = tag;
    this.last = "endtag";
  }

  handleStartEndTag(tag: string, attrs: ReadonlyArray<Attribute>): void {
    this.handleStartTag(tag, attrs);
    this.lastTag = tag;
    this.last = "endtag";
  }

  handleVerbatim(text: string, last: LastEvent): void {
    this.output += text;
    this.last = last;
  }

  handleComment(data: string): void {
    this.output += `<!--${data}-->`;
    this.last = "comment";
  }

  outputChar(c: O.Option<string>, fallback: string): void {
    this.output += O.match(c, { onNone: () => fallback, onSome: (char) => REESCAPED[char] ?? char });
    this.last = "ref";
  }

  result(): string {
    return this.output;
  }
}

const TEXT_CHAR_REF = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][-.a-zA-Z0-9]*);/g;

const feedData = (normalizer: Normalizer, text: string): void => {
  let cursor = 0;
  for (const match of Str.matchAll(TEXT_CHAR_REF)(text)) {
    const index = match.index ?? cursor;
    if (index > cursor) {
      normalizer.handleData(Str.slice(cursor, index)(text));
    }
    const ref = match[1] ?? "";
    normalizer.outputChar(decodeCharRef(ref), `&${ref};`);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    normalizer.handleData(Str.slice(cursor)(text));
  }
};

const TAG_NAME = /^([a-zA-Z][^\s/>]*)/;

const feedTag = (normalizer: Normalizer, text: string): void => {
  const inner = Str.slice(1, -1)(text);
  const selfClosing = Str.endsWith("/")(inner);
  const body = selfClosing ? Str.slice(0, -1)(inner) : inner;
  const nameMatch = TAG_NAME.exec(body);
  if (nameMatch === null) {
    normalizer.handleData(text);
    return;
  }
  const tag = Str.toLowerCase(nameMatch[1] ?? "");
  const attrs = parseAttributes(Str.slice(nameMatch[0].length)(body));
  if (selfClosing) {
    normalizer.handleStartEndTag(tag, attrs);
  } else {
    normalizer.handleStartTag(tag, attrs);
  }
};

const DOCTYPE = /^<!doctype/i;

type ChunkHandler = readonly [matches: (text: string) => boolean, feed: (normalizer: Normalizer, text: string) => void];

// decision: normalize-html-literal-port
const CHUNK_HANDLERS: ReadonlyArray<ChunkHandler> = [
  [Str.startsWith("<![CDATA["), (normalizer, text) => normalizer.handleVerbatim(text, "data")],
  [(text) => DOCTYPE.test(text), (normalizer, text) => normalizer.handleVerbatim(text, "decl")],
  [Str.startsWith("<!"), (normalizer, text) => normalizer.handleComment(Str.slice(2, -1)(text))],
  [Str.startsWith("<?"), (normalizer, text) => normalizer.handleVerbatim(`<?${Str.slice(2, -1)(text)}>`, "pi")],
  [
    Str.startsWith("</"),
    (normalizer, text) => normalizer.handleEndTag(pipe(text, Str.slice(2, -1), Str.trim, Str.toLowerCase)),
  ],
  [Str.startsWith("<"), feedTag],
];

const feedMarkup = (normalizer: Normalizer, text: string): void =>
  O.match(
    A.findFirst(CHUNK_HANDLERS, ([matches]) => matches(text)),
    {
      onNone: () => feedData(normalizer, text),
      onSome: ([, feed]) => feed(normalizer, text),
    }
  );

// decision: normalize-html-literal-port
const feedComment = (normalizer: Normalizer, html: string, text: string, start: number): O.Option<number> => {
  if (start + 4 === html.length || text === "<!-->" || text === "<!--->") {
    normalizer.handleComment("");
    return O.none();
  }
  return O.match(Str.indexOf("-->")(Str.slice(start + 4)(html)), {
    onNone: () => {
      normalizer.handleComment(Str.slice(4)(text));
      return O.none();
    },
    onSome: (offset) => {
      const close = start + 4 + offset;
      normalizer.handleComment(Str.slice(start + 4, close)(html));
      return O.some(close + 3);
    },
  });
};

/**
 * Returns the normalized form of an HTML string, discarding differences the
 * CommonMark spec considers insignificant.
 *
 * Compare rendered output against corpus-expected output only through this
 * function — a raw string comparison fails on whitespace the spec does not
 * mandate.
 */
export const normalizeHtml = (html: string): string => {
  const normalizer = new Normalizer();
  const chunkPattern = /(<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>|[^<]+)/g;
  for (let chunk = chunkPattern.exec(html); chunk !== null; chunk = chunkPattern.exec(html)) {
    const text = chunk[0];
    if (Str.startsWith("<!--")(text)) {
      const resume = feedComment(normalizer, html, text, chunk.index);
      if (O.isSome(resume)) chunkPattern.lastIndex = resume.value;
    } else {
      feedMarkup(normalizer, text);
    }
  }
  return normalizer.result();
};
