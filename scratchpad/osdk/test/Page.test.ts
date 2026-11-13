import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertInclude, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { LoadObjectsRequest, LoadObjectsResponse } from "../src/Client/Client.model.ts";
import { LoadLinksRequest } from "../src/Link/Link.model.ts";
import { Page, PageRequest, PageSize, PageToken, TotalCount } from "../src/Page/Page.model.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** Laws every named schema obeys: generated values are valid, and the wire form loses nothing. */
const lawsOf = <T, E>(name: string, schema: S.Codec<T, E>, runs = 100) => {
  const arbitrary = Arbitrary.schema(schema);
  const isValid = S.is(schema);
  const isEquivalent = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  describe(`${name} laws`, () => {
    it.prop("generated values satisfy the guard", [arbitrary], ([value]) => isValid(value), {
      arbitrary: fcRuns(runs),
    });
    it.effect.prop(
      "encoding then decoding gives an equivalent value",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assertTrue(isEquivalent(decoded, value));
      }),
      { arbitrary: fcRuns(runs) }
    );
  });
};

/** Decodes an exact wire value to the expected domain value and encodes it back to the same wire value. */
const wireFixture = <T, E>(name: string, schema: S.Codec<T, E>, wire: NoInfer<E>, expected: NoInfer<T>) =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      deepStrictEqual(decoded, expected);
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

/** Asserts that decoding fails and that the failure names the violated rule. */
const assertRejects = <T, E>(schema: S.Codec<T, E>, input: unknown, fragment: string) =>
  assertInclude(
    pipe(
      S.decodeUnknownResult(schema)(input),
      Result.getFailure,
      O.map((error) => error.message),
      O.getOrUndefined
    ),
    fragment
  );

const NamePage = Page("NamePage", S.NonEmptyString);
const CountPage = Page("CountPage", TotalCount);

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

lawsOf("PageToken", PageToken);
lawsOf("PageSize", PageSize);
lawsOf("TotalCount", TotalCount);
lawsOf("PageRequest", PageRequest);
lawsOf("Page of names", NamePage);
lawsOf("Page of counts", CountPage);

// -----------------------------------------------------------------------------
// Cursor and counters
// -----------------------------------------------------------------------------

describe("PageToken", () => {
  wireFixture("is the text the platform issued, unchanged", PageToken, "v1.000000000000000a", PageToken.make("v1.000000000000000a"));

  it("is any non-empty text and nothing else", () => {
    assertTrue(S.is(PageToken)("0"));
    assertTrue(S.is(PageToken)(" "));
    assertFalse(S.is(PageToken)(""));
    assertFalse(S.is(PageToken)(7));
    assertRejects(PageToken, "", "length of at least 1");
    assertRejects(PageToken, null, "PageToken");
    assertNone(PageToken.makeOption(""));
  });
});

describe("PageSize", () => {
  wireFixture("is the number the wire carries", PageSize, 100, 100);

  it("is an integer of at least one", () => {
    assertTrue(S.is(PageSize)(1));
    assertTrue(S.is(PageSize)(10_000));
    assertFalse(S.is(PageSize)(0));
    assertFalse(S.is(PageSize)(-5));
    assertFalse(S.is(PageSize)(2.5));
    assertFalse(S.is(PageSize)("100"));
    assertRejects(PageSize, 0, "Expected a page size of at least one item");
    assertRejects(PageSize, -1, "Expected a page size of at least one item");
    assertRejects(PageSize, 1.5, "Expected an integer");
    assertRejects(PageSize, "100", "PageSize");
  });
});

describe("TotalCount", () => {
  wireFixture("reads the decimal text as a bigint", TotalCount, "2", BigInt(2));

  wireFixture("reads zero", TotalCount, "0", BigInt(0));

  wireFixture(
    "keeps every digit of a count beyond the exact range of a JSON number",
    TotalCount,
    "9007199254740993",
    BigInt("9007199254740993")
  );

  it("rejects a negative count, a fraction, a word and a JSON number", () => {
    assertRejects(TotalCount, "-1", "Expected a total count of zero or more");
    assertRejects(TotalCount, "1.5", "Expected a string representing a bigint");
    assertRejects(TotalCount, "many", "Expected a string representing a bigint");
    assertRejects(TotalCount, "", "Expected a string representing a bigint");
    assertRejects(TotalCount, 2, "Expected string");
    assertFalse(S.is(TotalCount)(BigInt(-1)));
    assertFalse(S.is(TotalCount)(2));
    assertTrue(S.is(TotalCount)(BigInt(0)));
  });

  it.effect(
    "refuses to encode a negative count",
    Effect.fnUntraced(function* () {
      const verdict = yield* Effect.exit(S.encodeUnknownEffect(TotalCount)(BigInt(-1)));
      assertTrue(verdict._tag === "Failure");
    })
  );
});

// -----------------------------------------------------------------------------
// Request
// -----------------------------------------------------------------------------

describe("PageRequest", () => {
  wireFixture(
    "carries a size and a cursor",
    PageRequest,
    { pageSize: 50, pageToken: "v1.next" },
    PageRequest.make({ pageSize: O.some(50), pageToken: O.some(PageToken.make("v1.next")) })
  );

  wireFixture("is empty for the first page at the endpoint's default size", PageRequest, {}, PageRequest.make({}));

  it("defaults both arguments to none", () => {
    const first = PageRequest.make({});
    assertNone(first.pageSize);
    assertNone(first.pageToken);
  });

  it("rejects an empty page, an empty cursor and a null in place of an absent key", () => {
    assertRejects(PageRequest, { pageSize: 0 }, "Expected a page size of at least one item");
    assertRejects(PageRequest, { pageToken: "" }, `["pageToken"]`);
    assertRejects(PageRequest, { pageSize: null }, `["pageSize"]`);
  });

  // The paging arguments of the two list requests are these fields, not copies of them.
  it("is the paging half of the object load request", () => {
    assertRejects(
      LoadObjectsRequest,
      { objectSet: { type: "base", objectType: "Employee" }, select: [], selectV2: [], pageSize: 0 },
      "Expected a page size of at least one item"
    );
    assertRejects(
      LoadObjectsRequest,
      { objectSet: { type: "base", objectType: "Employee" }, select: [], selectV2: [], pageToken: "" },
      `["pageToken"]`
    );
  });

  it.effect(
    "lends the link load request its cursor and not its size, which that route does not take",
    Effect.fnUntraced(function* () {
      const wire = {
        objectSet: { type: "base", objectType: "Employee" },
        links: ["lead"],
        pageToken: "v1.next",
        pageSize: 50,
      };
      const request = yield* S.decodeUnknownEffect(LoadLinksRequest)(wire);
      assertSome(request.pageToken, PageToken.make("v1.next"));
      const encoded = yield* S.encodeEffect(LoadLinksRequest)(request);
      deepStrictEqual(encoded, {
        objectSet: { type: "base", objectType: "Employee" },
        links: ["lead"],
        pageToken: "v1.next",
      });
      assertRejects(LoadLinksRequest, { ...wire, pageToken: "" }, `["pageToken"]`);
    })
  );
});

// -----------------------------------------------------------------------------
// Response
// -----------------------------------------------------------------------------

describe("Page", () => {
  wireFixture(
    "decodes a page with a cursor and a count",
    NamePage,
    { data: ["Ada", "Grace"], nextPageToken: "v1.next", totalCount: "2" },
    NamePage.make({
      data: ["Ada", "Grace"],
      nextPageToken: O.some(PageToken.make("v1.next")),
      totalCount: O.some(BigInt(2)),
    })
  );

  wireFixture("decodes the last page, which has no cursor", NamePage, { data: ["Ada"] }, NamePage.make({ data: ["Ada"] }));

  wireFixture("decodes an empty page", NamePage, { data: [] }, NamePage.make({ data: [] }));

  wireFixture(
    "decodes each item with the item schema",
    CountPage,
    { data: ["1", "9007199254740993"], totalCount: "2" },
    CountPage.make({ data: [BigInt(1), BigInt("9007199254740993")], totalCount: O.some(BigInt(2)) })
  );

  it("takes its arguments in either order of application", () => {
    const pageOfNames = Page(S.NonEmptyString);
    const Curried = pageOfNames("NamePage");
    const wire = { data: ["Ada"], nextPageToken: "v1.next" };
    const curried = S.decodeOption(Curried)(wire);
    assertSome(
      O.map(curried, (page) => page.data),
      ["Ada"]
    );
    deepStrictEqual(curried, S.decodeOption(NamePage)(wire));
  });

  it("names itself in a failure, so two pages are told apart", () => {
    assertRejects(NamePage, null, "Page.model/NamePage");
    assertRejects(CountPage, null, "Page.model/CountPage");
  });

  it("rejects a page without data, a bad item, an empty cursor and a count that is not decimal text", () => {
    assertRejects(NamePage, { nextPageToken: "v1.next" }, `["data"]`);
    assertRejects(NamePage, { data: ["Ada", ""] }, `["data"][1]`);
    assertRejects(NamePage, { data: [], nextPageToken: "" }, `["nextPageToken"]`);
    assertRejects(NamePage, { data: [], totalCount: 2 }, `["totalCount"]`);
    assertRejects(NamePage, { data: [], totalCount: "-1" }, "Expected a total count of zero or more");
  });

  // The object page is this page with the wire records as its items and the count required, as that endpoint
  // always sends it.
  it.effect(
    "is the page of the object load response, whose count is required",
    Effect.fnUntraced(function* () {
      const wire = {
        data: [{ __apiName: "Employee", __primaryKey: 50030, fullName: "John Doe" }],
        nextPageToken: "v1.next",
        totalCount: "9007199254740993",
        propertySecurities: [],
      };
      const page = yield* S.decodeEffect(LoadObjectsResponse)(wire);
      assertSome(page.nextPageToken, PageToken.make("v1.next"));
      deepStrictEqual(page.totalCount, BigInt("9007199254740993"));
      deepStrictEqual(
        A.map(page.data, (row) => row.__primaryKey),
        [50030]
      );
      // A row is not read into: it is the record that arrived.
      deepStrictEqual<unknown>(page.data, wire.data);
      const encoded = yield* S.encodeEffect(LoadObjectsResponse)(page);
      deepStrictEqual(encoded, wire);
      assertRejects(LoadObjectsResponse, { data: [], propertySecurities: [] }, `["totalCount"]`);
      assertRejects(LoadObjectsResponse, { data: [], totalCount: "-1" }, "Expected a total count of zero or more");
      assertRejects(LoadObjectsResponse, { data: [], totalCount: "0", nextPageToken: "" }, `["nextPageToken"]`);
    })
  );
});
