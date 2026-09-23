import { A } from "@beep/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";
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

// Regression coverage for CSF-043: the `social.active` SEO filter gates which
// social profiles surface in public JSON-LD (`sameAs`) and Twitter metadata.
// Footer visibility and SEO output must stay aligned with the `active` flag, so
// these tests pin the active / inactive / missing-active behavior against drift.

const metadata = SiteMetadataContent.make({
  description: "Patent counsel for the people who build the machines.",
  linkedInUrl: "https://www.linkedin.com/in/example",
  ogImage: "/oip/og.png",
  siteName: "OIP - Oppold IP Law",
  siteUrl: "https://oip.law",
  title: "oip.law",
});

// Build a minimal OipSiteContent shell that only varies the socials list. Every
// other field reuses the approved launch content so the SEO builders see a
// realistic graph while we isolate the `active` filter behavior.
const withSocials = (socials: ReadonlyArray<SocialLink>): OipSiteContent =>
  OipSiteContent.make({
    ...oipSiteContent,
    metadata,
    socials,
  });

// Extract the LegalService node's `sameAs` array (the public profile fan-out).
// The builder omits `sameAs` entirely when no active non-discord profile
// exists, so this resolves to an empty array in that case.
const sameAsUrls = (content: OipSiteContent): ReadonlyArray<string> => {
  const graph = makeJsonLdGraph(content);
  const legalService = A.findFirst(graph["@graph"], (node) => node["@type"] === "LegalService");
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

    expect(sameAsUrls(content)).toContain("https://www.instagram.com/oip.law/");
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
    // No active profile means the LegalService node omits `sameAs` entirely.
    expect(sameAsUrls(content)).toHaveLength(0);
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

    // Discord invites are server links, not identity profiles, so they never
    // appear in `sameAs` regardless of the active flag.
    expect(sameAsUrls(content)).not.toContain("https://discord.gg/example");
    expect(sameAsUrls(content)).toHaveLength(0);
  });

  it("treats a social with active omitted as active (constructor default contract)", () => {
    // SocialLink.active carries `withConstructorDefault(true)`, so omitting the
    // flag yields an ACTIVE social that IS included in SEO output. This pins the
    // implementation's current contract: missing active === active === visible.
    const social = SocialLink.make({
      platform: "instagram",
      href: "https://www.instagram.com/oip.law/",
      label: "OIP on Instagram",
    });

    expect(social.active).toBe(true);
    expect(sameAsUrls(withSocials([social]))).toContain("https://www.instagram.com/oip.law/");
  });

  it("treats decoded input with active omitted as active (decoding default contract)", () => {
    // The decoding default mirrors the constructor default: raw content missing
    // `active` decodes to `active: true` and therefore surfaces in SEO output.
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

    expect(Result.isSuccess(decoded)).toBe(true);
    const content = Result.getOrThrow(decoded);
    const social = O.getOrThrow(A.head(content.socials));
    expect(social.active).toBe(true);
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
    // Consistent with the JSON-LD path: a missing active flag defaults to true,
    // so the X handle is still derived.
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
    // oipSiteContent ships every profile active, so the live Instagram URL and
    // the X handle both surface, and discord stays out of sameAs.
    const seoUrls = Effect.runSync(Effect.sync(() => sameAsUrls(OipSiteContent.make({ ...oipSiteContent }))));

    expect(seoUrls).toContain("https://www.instagram.com/oip.law/");
    expect(A.some(seoUrls, (url) => url.includes("discord"))).toBe(false);
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
