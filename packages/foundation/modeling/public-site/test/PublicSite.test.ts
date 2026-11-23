import { IdentityAuthority } from "@beep/identity/Authority";
import { $I } from "@beep/identity/packages";
import {
  FileRoute,
  HostedUrl,
  hostedUrl,
  LabLabel,
  LabPortlessName,
  labRoute,
  PathRoute,
  PublicOrigin,
  SitePath,
  SiteRoute,
} from "@beep/public-site";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { IsDnsLabel, LabLabelOf } from "@beep/public-site";

const isDecodedLabLabel = S.is(S.toType(LabLabel));

const D3_ROUTES = [
  "ns",
  "taxonomy",
  "docs",
  "api",
  "storybook",
  "llms.txt",
  "mcp",
  "labs",
  "goals",
  "explorations",
  "research",
  ".well-known",
  "sitemap.xml",
] as const;

describe("PublicOrigin", () => {
  it("is the apex literal", () => {
    expect(PublicOrigin.literal).toBe("https://beep-effect.com");
    expectTypeOf<PublicOrigin>().toEqualTypeOf<"https://beep-effect.com">();
    expect(S.is(PublicOrigin)("https://beep-effect.com")).toBe(true);
    expect(S.is(PublicOrigin)("https://www.beep-effect.com")).toBe(false);
  });
});

describe("SiteRoute", () => {
  it("reserves exactly the D3 route table", () => {
    expect(SiteRoute.literals).toEqual(D3_ROUTES);
    expectTypeOf<SiteRoute>().toEqualTypeOf<(typeof D3_ROUTES)[number]>();
  });

  it("partitions into file routes, nested-path routes, and labs", () => {
    const partition = [...FileRoute.literals, ...PathRoute.literals, "labs"];
    expect(A.sort(partition, Order.String)).toEqual(A.sort(D3_ROUTES, Order.String));
    expectTypeOf<FileRoute | PathRoute | "labs">().toEqualTypeOf<SiteRoute>();
  });
});

describe("hostedUrl", () => {
  it("builds every reserved route without a path", () => {
    for (const route of D3_ROUTES) {
      expect(hostedUrl(route)).toBe(`https://beep-effect.com/${route}`);
      expect(S.is(HostedUrl)(hostedUrl(route))).toBe(true);
    }
  });

  it("returns exact template-literal types", () => {
    expectTypeOf(hostedUrl("docs")).toEqualTypeOf<"https://beep-effect.com/docs">();
    expectTypeOf(hostedUrl("llms.txt")).toEqualTypeOf<"https://beep-effect.com/llms.txt">();
    expectTypeOf(hostedUrl("docs", "identity/Id")).toEqualTypeOf<"https://beep-effect.com/docs/identity/Id">();
    const dynamicPath: string = "x";
    expectTypeOf(hostedUrl("api", dynamicPath)).toEqualTypeOf<`https://beep-effect.com/api/${string}`>();
  });

  it("joins a nested path below a path route", () => {
    expect(hostedUrl("docs", "identity/Id")).toBe("https://beep-effect.com/docs/identity/Id");
    expect(hostedUrl(".well-known", "security.txt")).toBe("https://beep-effect.com/.well-known/security.txt");
    expect(S.is(HostedUrl)(hostedUrl("api", "repo-cli"))).toBe(true);
  });

  it("rejects a path on file routes and labs at the type level", () => {
    // @ts-expect-error -- file routes take no path. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    hostedUrl("llms.txt", "extra");
    // @ts-expect-error -- file routes take no path. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    hostedUrl("sitemap.xml", "extra");
    // @ts-expect-error -- lab URLs go through labRoute. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    hostedUrl("labs", "semantica");
    // @ts-expect-error -- unknown route. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    hostedUrl("blog");
  });

  it("rejects a path when a union route may be a file route or labs", () => {
    const anyRoute = (route: SiteRoute) =>
      // @ts-expect-error -- the union includes file routes and labs. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
      hostedUrl(route, "x");
    const fileOrDocs = (route: "llms.txt" | "docs") =>
      // @ts-expect-error -- the union includes a file route. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
      hostedUrl(route, "extra");
    const bare = (route: SiteRoute) => hostedUrl(route);
    expect([anyRoute, fileOrDocs].length).toBe(2);
    expect(bare("llms.txt")).toBe("https://beep-effect.com/llms.txt");
  });

  it("rejects empty and absolute literal paths at the type level", () => {
    // @ts-expect-error -- a nested path is relative. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    hostedUrl("docs", "/leading");
    // @ts-expect-error -- a nested path is non-empty. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    hostedUrl("docs", "");
  });

  it("treats an explicit undefined path as no path", () => {
    const maybePath: string | undefined = undefined as string | undefined;
    expect(hostedUrl("docs", undefined)).toBe("https://beep-effect.com/docs");
    expect(hostedUrl("docs", maybePath)).toBe("https://beep-effect.com/docs");
  });

  it("validates relative paths with SitePath", () => {
    expect(S.is(SitePath)("a/b.html")).toBe(true);
    expect(S.is(SitePath)("/a")).toBe(false);
    expect(S.is(SitePath)(".well-known-ish/x")).toBe(true);
    for (const unsafe of [
      "..",
      "../x",
      ".",
      "./x",
      "a/../b",
      "a/./b",
      "a/..",
      "a?b",
      "a#b",
      "a//b",
      "a/",
      "%2e%2e/x",
      "a/.%2E/b",
      "%2E",
      "a\\..\\b",
      "..\\x",
    ]) {
      expect(S.is(SitePath)(unsafe)).toBe(false);
    }
  });
});

describe("identity drift", () => {
  it("keeps hostedUrl('ns') + '/' equal to the identity authority", () => {
    const authority = `${hostedUrl("ns")}/` as const;
    expect(authority).toBe($I.iri);
    expect(authority).toBe(IdentityAuthority);
    expectTypeOf(authority).toEqualTypeOf<typeof IdentityAuthority>();
    expectTypeOf(authority).toEqualTypeOf<typeof $I.iri>();
    expectTypeOf(authority).toEqualTypeOf<"https://beep-effect.com/ns/">();
  });
});

describe("labRoute", () => {
  it("strips the portless host suffix", () => {
    expect(labRoute("api-docs.labs.beep.localhost")).toBe("https://beep-effect.com/labs/api-docs");
    expectTypeOf(labRoute("api-docs.labs.beep.localhost")).toEqualTypeOf<"https://beep-effect.com/labs/api-docs">();
  });

  it("strips the portless name used by dev scripts", () => {
    expect(labRoute("semantica.labs.beep")).toBe("https://beep-effect.com/labs/semantica");
    expectTypeOf(labRoute("semantica.labs.beep")).toEqualTypeOf<"https://beep-effect.com/labs/semantica">();
  });

  it("accepts the bare label", () => {
    expect(labRoute("trustgraph-workbench")).toBe("https://beep-effect.com/labs/trustgraph-workbench");
    expectTypeOf(labRoute("ciops")).toEqualTypeOf<"https://beep-effect.com/labs/ciops">();
    expect(S.is(HostedUrl)(labRoute("ciops"))).toBe(true);
  });

  it("computes the label type", () => {
    expectTypeOf<LabLabelOf<"x.labs.beep.localhost">>().toEqualTypeOf<"x">();
    expectTypeOf<LabLabelOf<"x.labs.beep">>().toEqualTypeOf<"x">();
    expectTypeOf<LabLabelOf<"x">>().toEqualTypeOf<"x">();
  });

  it("rejects literal labels that are not DNS labels at the type level", () => {
    // @ts-expect-error -- uppercase is not a lowercase DNS label. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute("Api-Docs");
    // @ts-expect-error -- underscore is not a DNS label character. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute("api_docs.labs.beep.localhost");
    // @ts-expect-error -- a DNS label may not start with a hyphen. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute("-api.labs.beep.localhost");
    // @ts-expect-error -- a DNS label may not end with a hyphen. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute("api-");
    // @ts-expect-error -- a dot leaves more than one label. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute("a.b");
    // @ts-expect-error -- a port is not part of the portless name. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute("api-docs.labs.beep.localhost:1355");
    // @ts-expect-error -- the label may not be empty. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute(".labs.beep.localhost");
    const dynamicName: string = "semantica";
    // @ts-expect-error -- a dynamic name must be decoded through LabPortlessName first. Owner: @beep/public-site. Exit: remove if the API is meant to accept this.
    labRoute(dynamicName);
    expectTypeOf<
      IsDnsLabel<"a234567890123456789012345678901234567890123456789012345678901234">
    >().toEqualTypeOf<false>();
    expectTypeOf<IsDnsLabel<"a23456789012345678901234567890123456789012345678901234567890123">>().toEqualTypeOf<true>();
  });

  it("agrees with the LabPortlessName schema on the same names", () => {
    const decodes = isDecodedLabLabel;
    const rejected = [
      "Api-Docs",
      "api_docs.labs.beep.localhost",
      "-api.labs.beep.localhost",
      "api-",
      "a.b",
      "api-docs.labs.beep.localhost:1355",
      ".labs.beep.localhost",
      Str.repeat(64)("a"),
    ];
    for (const name of rejected) {
      assertNone(S.decodeOption(LabPortlessName)(name));
    }
    expect(decodes(O.getOrThrow(S.decodeOption(LabPortlessName)(Str.repeat(63)("a"))))).toBe(true);
  });

  it("routes a label decoded by schema", () => {
    const label = O.getOrThrow(S.decodeOption(LabPortlessName)("lejeune-bolt-workbench.labs.beep"));
    expect(labRoute(label)).toBe("https://beep-effect.com/labs/lejeune-bolt-workbench");
    expectTypeOf(labRoute(label)).toEqualTypeOf<`https://beep-effect.com/labs/${LabLabel}`>();
  });

  it("decodes through LabPortlessName and encodes to the bare label", () => {
    const label = O.getOrThrow(S.decodeOption(LabPortlessName)("api-docs.labs.beep.localhost"));
    expect(label).toBe("api-docs");
    expect(O.getOrThrow(S.encodeOption(LabPortlessName)(label))).toBe("api-docs");
    expect(S.is(LabLabel)("api-docs")).toBe(true);
  });

  it.prop(
    "hosts every schema-derived route at a URL the HostedUrl schema accepts",
    [Arbitrary.schema(SiteRoute)],
    ([route]) => {
      const url = hostedUrl(route);
      expect(url).toBe(`https://beep-effect.com/${route}`);
      expect(S.is(HostedUrl)(url)).toBe(true);
    }
  );

  it.prop(
    "routes every schema-derived lab label through its portless host",
    [Arbitrary.schema(LabLabel)],
    ([label]) => {
      expect(O.getOrThrow(S.decodeOption(LabPortlessName)(`${label}.labs.beep.localhost`))).toBe(label);
      expect(labRoute(label)).toBe(`https://beep-effect.com/labs/${label}`);
      expect(S.is(HostedUrl)(labRoute(label))).toBe(true);
    },
    { arbitrary: { runs: 50 } }
  );
});
