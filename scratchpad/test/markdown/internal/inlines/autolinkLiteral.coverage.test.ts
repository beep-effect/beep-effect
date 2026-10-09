import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MarkdownDocument } from "../../../../effected/markdown/MarkdownDocument.ts";
import { wwwAutolinkConstruct, urlAutolinkConstruct } from "../../../../effected/markdown/internal/inlines/autolinkLiteral.ts";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { makeInlineNode } from "../../../../effected/markdown/internal/inlineNode.ts";
import type { InlineScanner } from "../../../../effected/markdown/internal/inlineTypes.ts";

const scannerFor = (subject: string): InlineScanner => {
  const scanner: InlineScanner = {
    subject, pos: 0, refmap: HashMap.empty(), footnoteLabels: HashSet.empty(),
    delimiters: undefined, brackets: undefined,
    peek: () => O.getOrElse(Str.charCodeAt(subject, scanner.pos), () => -1),
    match: (pattern) => {
      const matched = pattern.exec(subject.slice(scanner.pos));
      if (matched === null || matched.index !== 0) return undefined;
      const value = matched[0];
      scanner.pos += value.length;
      return value;
    },
    matchAhead: () => undefined, hasAhead: () => false,
    closingBacktickRun: () => undefined, append: () => {},
    appendText: (value, from, to) => makeInlineNode("text", from, to, value),
    lastChild: () => undefined, unputText: () => false, trimTrailingSpaces: () => 0,
    removeDelimiter: () => {}, addBracket: () => {}, removeBracket: () => {},
    deactivateLinkOpeners: () => {}, processEmphasis: () => {},
  };
  return scanner;
};

describe("literal autolink boundary behavior", () => {
  for (const subject of ["w", "www", "www.", "wwwa.example", "www._a.org", "www.a_b.org"]) {
    it.effect(`refuses www candidate ${subject}`, () => Effect.sync(() => {
      const scanner = scannerFor(subject);
      assert.strictEqual(wwwAutolinkConstruct.parse(scanner), false);
      assert.strictEqual(scanner.pos, 0);
    }));
  }
  for (const subject of ["http:/a", "http:/x/path", "http:x/path", "http://_host.org", "http://a_b.org", "http://good.org"]) {
    it.effect(`refuses invalid or unreclaimable URL ${subject}`, () => Effect.sync(() => {
      const scanner = scannerFor(subject);
      scanner.pos = subject.indexOf(":");
      const before = scanner.pos;
      assert.strictEqual(urlAutolinkConstruct.parse(scanner), false);
      assert.strictEqual(scanner.pos, before);
    }));
  }
  const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ["www.a.org/q; www.b.org/q&hl;", ["http://www.a.org/q", "http://www.b.org/q"]],
    ["www.a.org/q&;", ["http://www.a.org/q&"]],
    ["www.a.org/q<after", ["http://www.a.org/q"]],
    ["www.a.org/a\\b", ["http://www.a.org/a\\b"]],
    ["@ @a.org a@ a@b a@b. a@b.9 a@b.c_ a@b.c-", []],
    ["a@b.c. a@b..c a@b.c/d", ["mailto:a@b.c", "mailto:a@b.c"]],
    ["mailto:a@b.org xmpp:a@b.org/resource", ["mailto:a@b.org", "xmpp:a@b.org/resource"]],
    ["!mailto:a@b.org !xmpp:a@b.org/path", ["mailto:a@b.org", "xmpp:a@b.org/path"]],
    ["xmailto:a@b.org xxmpp:a@b.org/path", ["mailto:a@b.org", "mailto:a@b.org"]],
    ["a@b@c.org a@@c.org", ["mailto:b@c.org"]],
    ["https://a_b.c.d.e.f.g.h.i.j.k.l.org/", ["https://a_b.c.d.e.f.g.h.i.j.k.l.org/"]],
    ["www.a\\.b.org", ["http://www.a\\.b.org"]],
  ];
  for (const [source, expected] of cases) {
    it.effect(`linkifies the expected source boundaries: ${source}`, () => Effect.gen(function* () {
      const doc = yield* MarkdownDocument.parse(source);
      assert.deepStrictEqual(doc.links.map((link) => link.url), [...expected]);
    }));
  }
});
