import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import {
  decodeOipSiteContentResult,
  makeJsonLdGraph,
  makeLlmsText,
  OipSiteContent,
  oipSiteContent,
  oipTwitterHandle,
  SiteMetadataContent,
  SocialLink,
} from "@/content";

const metadata = SiteMetadataContent.make({
  description: "Patent counsel for the people who build the machines.",
  linkedInUrl: "https://www.linkedin.com/in/example",
  ogImage: "/oip/og.png",
  siteName: "OIP - Oppold IP Law",
  siteUrl: "https://oip.law",
  title: "oip.law",
});

const withSocials = (socials: ReadonlyArray<SocialLink>): OipSiteContent =>
  OipSiteContent.make({
    ...oipSiteContent,
    metadata,
    socials,
  });

const sameAsUrls = (content: OipSiteContent): ReadonlyArray<string> => {
  const graph = makeJsonLdGraph(content);
  const legalService = A.findFirst(graph["@graph"], (node) => node["@type"] === "LegalService");
  pipe(legalService, O.isSome, assertTrue);
  return O.match(legalService, {
    onNone: () => A.empty<string>(),
    onSome: (node) => ("sameAs" in node && A.isArray(node.sameAs) ? node.sameAs : A.empty<string>()),
  });
};

describe("OipSeo social.active filter (CSF-043)", () => {
  it("includes an active non-discord social in JSON-LD sameAs", () => {
    const content = withSocials([
      SocialLink.make({
        platform: "instagram",
        href: "https://www.instagram.com/oip.law/",
        label: "OIP on Instagram",
        active: true,
      }),
    ]);

    expect(
      sameAsUrls(content),
      "Social active flags must align footer visibility with public sameAs and Twitter metadata for active, inactive and omitted flags."
    ).toContain("https://www.instagram.com/oip.law/");
  });

  it("excludes an inactive social from JSON-LD sameAs", () => {
    const content = withSocials([
      SocialLink.make({
        platform: "instagram",
        href: "https://www.instagram.com/oip.law/",
        label: "OIP on Instagram",
        active: false,
      }),
    ]);

    expect(sameAsUrls(content)).not.toContain("https://www.instagram.com/oip.law/");

    expect(
      sameAsUrls(content),
      "LegalService omits sameAs when there is no active non-Discord identity profile; the helper then returns an empty array."
    ).toHaveLength(0);
  });

  it("always excludes discord from JSON-LD sameAs even when active", () => {
    const content = withSocials([
      SocialLink.make({
        platform: "discord",
        href: "https://discord.gg/example",
        label: "Join the OIP Discord",
        active: true,
      }),
    ]);

    expect(
      sameAsUrls(content),
      "Discord links are server invites rather than identity profiles and never enter sameAs, even when active."
    ).not.toContain("https://discord.gg/example");
    expect(sameAsUrls(content)).toHaveLength(0);
  });

  it("treats a social with active omitted as active (constructor default contract)", () => {
    const social = SocialLink.make({
      platform: "instagram",
      href: "https://www.instagram.com/oip.law/",
      label: "OIP on Instagram",
    });

    pipe(social.active, assertTrue);
    expect(sameAsUrls(withSocials([social]))).toContain("https://www.instagram.com/oip.law/");
  });

  it("treats decoded input with active omitted as active (decoding default contract)", () => {
    const decoded = decodeOipSiteContentResult({
      ...oipSiteContent,
      metadata,
      socials: [
        {
          platform: "instagram",
          href: "https://www.instagram.com/oip.law/",
          label: "OIP on Instagram",
        },
      ],
    });

    pipe(decoded, Result.isSuccess, assertTrue);
    const content = Result.getOrThrow(decoded);
    const social = O.getOrThrow(A.head(content.socials));
    pipe(social.active, assertTrue);
    expect(sameAsUrls(content)).toContain("https://www.instagram.com/oip.law/");
  });

  it("derives the Twitter handle from an active X profile", () => {
    const content = withSocials([
      SocialLink.make({
        platform: "x",
        href: "https://x.com/opiplaw",
        label: "OIP on X",
        active: true,
      }),
    ]);

    expect(oipTwitterHandle(content)).toBe("@opiplaw");
  });

  it("omits the Twitter handle when the X profile is inactive", () => {
    const content = withSocials([
      SocialLink.make({
        platform: "x",
        href: "https://x.com/opiplaw",
        label: "OIP on X",
        active: false,
      }),
    ]);

    expect(oipTwitterHandle(content)).toBeUndefined();
  });

  it("derives the Twitter handle when an X profile omits active (default contract)", () => {
    const content = withSocials([
      SocialLink.make({
        platform: "x",
        href: "https://x.com/opiplaw",
        label: "OIP on X",
      }),
    ]);

    expect(oipTwitterHandle(content)).toBe("@opiplaw");
  });

  it("matches the approved launch content sanity check", () => {
    const seoUrls = sameAsUrls(OipSiteContent.make({ ...oipSiteContent }));

    expect(seoUrls).toContain("https://www.instagram.com/oip.law/");
    pipe(
      A.some(seoUrls, (url) => Str.includes("discord")(url)),
      assertFalse
    );
    expect(oipTwitterHandle(OipSiteContent.make({ ...oipSiteContent }))).toBe("@opiplaw");
  });

  it("renders llms.txt sections from the reviewed launch content", () => {
    const text = makeLlmsText(oipSiteContent);

    expect(text).toContain("# OIP - Oppold IP Law");
    expect(text).toContain(`- Canonical URL: [${oipSiteContent.metadata.siteUrl}]`);
    expect(text).toContain(`- Contact: [${oipSiteContent.contact.email}]`);
    for (const practice of oipSiteContent.practices) {
      expect(text).toContain(`- ${practice.title}: ${practice.body}`);
    }
    for (const matter of oipSiteContent.matters) {
      expect(text).toContain(`- [${matter.title}](${matter.source.href}): ${matter.source.label}`);
    }
    for (const item of oipSiteContent.press) {
      expect(text).toContain(`- [${item.headline}](${item.source.href})`);
    }
    for (const notice of oipSiteContent.contact.notice) {
      expect(text).toContain(`- ${notice}`);
    }
  });
});
