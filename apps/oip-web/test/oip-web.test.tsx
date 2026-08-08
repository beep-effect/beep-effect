import { EmailString, NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { Button } from "@beep/ui/components/ui/button";
import { A } from "@beep/utils";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Clock, ConfigProvider, Effect, Exit, Layer } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeOipContactHttpApiWebHandlerWithSubmit } from "@/app/api/contact/ContactHttpApiRoute";
import { contactRequestResponseWithSubmit } from "@/app/api/contact/ContactRouteResponse";
import { POST } from "@/app/api/contact/route";
import oipManifest from "@/app/manifest";
import Home from "@/app/page";
import oipRobots from "@/app/robots";
import oipSitemap from "@/app/sitemap";
import { BackToTop } from "@/components/BackToTop";
import { ContactForm } from "@/components/ContactForm";
import { HERO_ROTATE_MS, HeroVideo } from "@/components/HeroVideo";
import { OipThemeProvider } from "@/components/OipThemeProvider";
import { oipRedirects } from "@/config/OipRedirects";
import {
  ContactSubmission,
  ContactSubmissionAccepted,
  ContactSubmissionFormPayload,
  ContactSubmissionRejected,
  ContactSubmissionResponse,
  contactSubmissionPayloadFromFormData,
  decodeContactSubmission,
  OipContactHttpApiClient,
  OipHttpApi,
  submitContact,
} from "@/contact";
import {
  decodeOipSiteContentResult,
  launchReviewGates,
  makeJsonLdGraph,
  OipSiteContent,
  oipSiteContent,
  oipTwitterHandle,
  ReviewStatus,
} from "@/content";
import { OipAtomProvider } from "@/runtime/OipAtomProvider";

const contactFormEmail = Result.getOrThrow(S.decodeResult(EmailString)("tom@example.com"));

vi.mock("next/image", () =>
  vi.importActual<typeof import("react")>("react").then((ReactModule) => {
    type MockNextImageProps = React.ComponentProps<"img"> & {
      readonly fill?: boolean;
      readonly priority?: boolean;
      readonly quality?: number | string;
    };

    return {
      default: ({ fill: _fill, priority: _priority, quality: _quality, ...props }: MockNextImageProps) =>
        ReactModule.createElement("img", props),
    };
  })
);

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-nonce": "test-nonce" })),
}));

vi.mock("next/server", () => ({
  connection: () => Promise.resolve(undefined),
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
    redirect: (url: string | URL, status?: number) => Response.redirect(url, status),
  },
}));

const validContactPayload = () => ({
  email: "TOM@EXAMPLE.COM",
  message: "I would like help protecting a new machine design.",
  name: " Thomas Oppold ",
  submittedAt: Effect.runSync(Clock.currentTimeMillis) - 5_000,
});

const withContactConfig = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.scoped(
    Layer.build(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          CRM_HUBSPOT_ACCOUNT_ID: "12345",
          CRM_HUBSPOT_SERVICE_KEY: "hubspot-service-key",
        })
      )
    ).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

const withoutContactConfig = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.scoped(
    Layer.build(ConfigProvider.layer(ConfigProvider.fromUnknown({}))).pipe(
      Effect.flatMap((context) => effect.pipe(Effect.provide(context)))
    )
  );

const hubSpotResponse = (body: unknown, status = 200): Response =>
  Response.json(body, {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const contactFormData = (payload = validContactPayload()) => {
  const formData = new FormData();
  formData.set("email", payload.email);
  formData.set("message", payload.message);
  formData.set("name", payload.name);
  formData.set("submittedAt", `${payload.submittedAt}`);
  return formData;
};

const jsonRequestBody = (body: unknown) => Response.json(body).text();

const jsonContactRequest = (body: unknown) =>
  jsonRequestBody(body).then(
    (payload) =>
      new Request("https://oip.law/api/contact", {
        body: payload,
        headers: { "content-type": "application/json" },
        method: "POST",
      })
  );

const formContactRequest = (formData = contactFormData()) =>
  new Request("https://oip.law/api/contact", {
    body: formData,
    method: "POST",
  });

const mockMediaQueryList = (matches: boolean): MediaQueryList => ({
  addEventListener: vi.fn(),
  addListener: vi.fn(),
  dispatchEvent: vi.fn(),
  matches,
  media: "(prefers-reduced-motion: reduce)",
  onchange: null,
  removeEventListener: vi.fn(),
  removeListener: vi.fn(),
});

const mockMatchMedia = (matches: boolean) => {
  const originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mockMediaQueryList(matches)),
  });

  return () =>
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
};

const setWindowScrollY = (scrollY: number) =>
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });

const OipSiteContentArbitrary = S.toArbitrary(OipSiteContent);
const OipSiteContentEquivalence = S.toEquivalence(OipSiteContent);
const ContactSubmissionArbitrary = S.toArbitrary(ContactSubmission);
const ContactSubmissionEquivalence = S.toEquivalence(ContactSubmission);
const ContactSubmissionFormPayloadArbitrary = S.toArbitrary(ContactSubmissionFormPayload);
const ContactSubmissionFormPayloadEquivalence = S.toEquivalence(ContactSubmissionFormPayload);
const ContactSubmissionResponseArbitrary = S.toArbitrary(ContactSubmissionResponse);
const ContactSubmissionResponseEquivalence = S.toEquivalence(ContactSubmissionResponse);
const encodeOipSiteContent = S.encodeSync(OipSiteContent);
const decodeOipSiteContent = S.decodeUnknownSync(OipSiteContent);
const encodeContactSubmission = S.encodeSync(ContactSubmission);
const decodeContactSubmissionSync = S.decodeUnknownSync(ContactSubmission);
const encodeContactSubmissionFormPayload = S.encodeSync(ContactSubmissionFormPayload);
const decodeContactSubmissionFormPayload = S.decodeUnknownSync(ContactSubmissionFormPayload);
const encodeContactSubmissionResponse = S.encodeSync(ContactSubmissionResponse);
const decodeContactSubmissionResponse = S.decodeUnknownSync(ContactSubmissionResponse);

describe("@beep/oip-web", { concurrent: false }, () => {
  beforeEach(() => {
    cleanup();
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.style.colorScheme = "";
    window.localStorage.clear();
  });

  it("renders a shared @beep/ui button", () => {
    render(<Button>Shared UI Button</Button>);

    expect(screen.getByRole("button", { name: "Shared UI Button" })).toBeDefined();
  });

  it("exports the main page as a valid React element", () =>
    Home({}).then((page) => {
      expect(React.isValidElement(page)).toBe(true);
    }));

  it("publishes install and indexing metadata for the canonical OIP URL", () => {
    expect(oipManifest()).toMatchObject({ name: "OIP - Oppold IP Law", start_url: "/" });
    expect(oipRobots()).toMatchObject({ sitemap: "https://oip.law/sitemap.xml" });
    expect(oipSitemap()[0]).toMatchObject({ url: "https://oip.law" });
  });

  it("decodes the static OIP launch content", () => {
    const result = decodeOipSiteContentResult(oipSiteContent);

    expect(Result.isSuccess(result)).toBe(true);
  });

  it("derives valid OIP content and contact form values from production schemas", { timeout: 120_000 }, () => {
    fc.assert(
      fc.property(
        OipSiteContentArbitrary,
        ContactSubmissionArbitrary,
        ContactSubmissionFormPayloadArbitrary,
        ContactSubmissionResponseArbitrary,
        (content, submission, payload, response) => {
          const encodedContent = encodeOipSiteContent(content);
          const encodedSubmission = encodeContactSubmission(submission);
          const encodedPayload = encodeContactSubmissionFormPayload(payload);
          const encodedResponse = encodeContactSubmissionResponse(response);

          expect(OipSiteContentEquivalence(decodeOipSiteContent(encodedContent), content)).toBe(true);
          expect(ContactSubmissionEquivalence(decodeContactSubmissionSync(encodedSubmission), submission)).toBe(true);
          expect(
            ContactSubmissionFormPayloadEquivalence(decodeContactSubmissionFormPayload(encodedPayload), payload)
          ).toBe(true);
          expect(ContactSubmissionResponseEquivalence(decodeContactSubmissionResponse(encodedResponse), response)).toBe(
            true
          );
        }
      ),
      fcRuns(100)
    );
  });

  it("preserves encoded contact wire shape while decoding optional fields to Option", () => {
    const submittedAt = NonNegativeInt.make(5_000);
    const encoded = {
      company: "OIP Builders",
      email: "builder@example.com",
      message: "I would like to discuss a patent matter.",
      name: "Builder",
      phone: "+16125550100",
      posture: "ready",
      submittedAt,
      technology: "planter",
      website: "https://example.com",
    };
    const decoded = decodeContactSubmissionSync(encoded);

    expect(encodeContactSubmission(decoded)).toEqual(encoded);
    expect(
      encodeContactSubmission(
        ContactSubmission.make({
          email: encoded.email,
          message: encoded.message,
          name: encoded.name,
          submittedAt,
        })
      )
    ).toEqual({
      email: encoded.email,
      message: encoded.message,
      name: encoded.name,
      submittedAt,
    });
  });

  it("exposes schema class-local decoders beside compatibility exports", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const contentResult = OipSiteContent.decodeUnknownResult(oipSiteContent);
        expect(contentResult).toEqual(decodeOipSiteContentResult(oipSiteContent));

        const formPayload = contactSubmissionPayloadFromFormData(contactFormData());
        const formResult = ContactSubmissionFormPayload.decodeUnknownResult(formPayload);
        expect(Result.isSuccess(formResult)).toBe(true);

        const contactPayload = validContactPayload();
        const submission = yield* ContactSubmission.decodeUnknownEffect(contactPayload);
        const submissionFromAlias = yield* decodeContactSubmission(contactPayload);
        expect(submission).toEqual(submissionFromAlias);
      })
    ));

  it("decodes the firm social profiles", () => {
    expect(A.map(oipSiteContent.socials, (social) => social.platform)).toEqual([
      "instagram",
      "x",
      "linkedin",
      "youtube",
      "threads",
      "tiktok",
      "reddit",
      "discord",
      "pinterest",
    ]);
  });

  it("renders brand-compliant footer social links", () =>
    Home({}).then((page) => {
      render(page);

      const instagram = screen.getByRole("link", { name: "OIP on Instagram" });

      expect(instagram.getAttribute("href")).toBe("https://www.instagram.com/oip.law/");
      expect(instagram.getAttribute("rel")).toBe("me noopener noreferrer");
      expect(instagram.getAttribute("target")).toBe("_blank");
      expect(screen.getByRole("link", { name: "OIP on X" })).toBeDefined();
      expect(screen.getByRole("link", { name: "Oppold IP Law on LinkedIn" })).toBeDefined();
      expect(screen.getByRole("link", { name: "OIP on YouTube" })).toBeDefined();
      expect(screen.getByRole("link", { name: "OIP on Threads" })).toBeDefined();
      expect(screen.getByRole("link", { name: "OIP on TikTok" })).toBeDefined();
      expect(screen.getByRole("link", { name: "OIP on Reddit" })).toBeDefined();
      expect(screen.getByRole("link", { name: "Join the OIP Discord" })).toBeDefined();
      expect(screen.getByRole("link", { name: "OIP on Pinterest" })).toBeDefined();
    }));

  it("publishes firm social profiles in JSON-LD, excludes the Discord invite, and keeps the personal LinkedIn on the Person", () => {
    const json = JSON.stringify(makeJsonLdGraph(oipSiteContent));

    expect(json).toContain("https://www.instagram.com/oip.law/");
    expect(json).toContain("https://www.linkedin.com/company/oppold-ip-law");
    expect(json).toContain("https://www.tiktok.com/@oip.law");
    expect(json).toContain(oipSiteContent.metadata.linkedInUrl);
    expect(json).not.toContain("discord.gg");
  });

  it("derives the X/Twitter handle from the social profiles", () => {
    expect(oipTwitterHandle(oipSiteContent)).toBe("@opiplaw");
  });

  it("renders the OIP public headline and contact CTA", () =>
    Home({}).then((page) => {
      render(page);

      expect(screen.getByRole("heading", { name: /thirty years as patent counsel/i })).toBeDefined();
      expect(screen.getByRole("link", { name: oipSiteContent.contact.email })).toBeDefined();
      expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeDefined();
    }));

  it("renders a server-seeded contact timestamp for progressive form posts", () =>
    Home({}).then((page) => {
      render(page);

      const submittedAtInput = document.querySelector<HTMLInputElement>('input[name="submittedAt"]');

      expect(submittedAtInput).not.toBeNull();
      expect(Number(submittedAtInput?.value ?? 0)).toBeGreaterThan(0);
    }));

  it("renders the progressive theme toggle hook for the static layout script", () =>
    Home({}).then((page) => {
      render(page);

      const toggles = screen.getAllByRole("button", { name: "Switch to dark mode" });
      const toggle = A.getUnsafe(toggles, A.length(toggles) - 1);

      expect(toggle.getAttribute("data-oip-theme-toggle")).toBe("");
      expect(toggle.getAttribute("data-theme-mode")).toBe("light");
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    }));

  it("provides an optional OIP MUI theme override provider", () => {
    render(
      <OipThemeProvider>
        <Button>OIP themed child</Button>
      </OipThemeProvider>
    );

    expect(screen.getByRole("button", { name: "OIP themed child" })).toBeDefined();
  });

  it("drives the back-to-top control from Atom-managed scroll state", () => {
    const restoreMatchMedia = mockMatchMedia(false);
    const originalScrollTo = window.scrollTo;
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });
    setWindowScrollY(0);

    render(
      <OipAtomProvider>
        <BackToTop />
      </OipAtomProvider>
    );

    const button = screen.getByLabelText("Back to top") as HTMLButtonElement;

    expect(button.hidden).toBe(true);

    setWindowScrollY(720);
    fireEvent.scroll(window);

    return waitFor(() => expect(button.hidden).toBe(false))
      .then(() => {
        fireEvent.click(button);

        expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", top: 0 });
      })
      .finally(() => {
        Object.defineProperty(window, "scrollTo", { configurable: true, value: originalScrollTo });
        restoreMatchMedia();
      });
  });

  it("starts the hero video through an Atom-mounted idle task and stores playing state in Atom", () => {
    const restoreMatchMedia = mockMatchMedia(false);
    const originalRequestIdleCallback = window.requestIdleCallback;
    const originalCancelIdleCallback = window.cancelIdleCallback;
    const originalLoad = HTMLMediaElement.prototype.load;
    const originalPlay = HTMLMediaElement.prototype.play;
    let idleCallback: IdleRequestCallback | undefined;
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback): number => {
      idleCallback = callback;
      return 7;
    });
    const cancelIdleCallback = vi.fn();
    const load = vi.fn();
    const play = vi.fn(() => Promise.resolve());
    Object.defineProperty(window, "requestIdleCallback", { configurable: true, value: requestIdleCallback });
    Object.defineProperty(window, "cancelIdleCallback", { configurable: true, value: cancelIdleCallback });
    Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: load });
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });

    const { container } = render(
      <OipAtomProvider>
        <HeroVideo
          clips={[{ poster: "/oip/hero-vid-poster.jpg", mp4: "/oip/hero-vid.mp4", webm: "/oip/hero-vid.webm" }]}
        />
      </OipAtomProvider>
    );

    const image = container.querySelector("img");
    const video = container.querySelector("video");

    expect(image).not.toBeNull();
    expect(video).not.toBeNull();

    return waitFor(() => expect(requestIdleCallback).toHaveBeenCalled())
      .then(() => {
        idleCallback?.({ didTimeout: false, timeRemaining: () => 0 });

        expect(load).toHaveBeenCalled();
        expect(play).toHaveBeenCalled();
        expect(image?.className).toContain("opacity-70");

        fireEvent.playing(video as HTMLVideoElement);

        return waitFor(() => {
          expect(image?.className).toContain("opacity-0");
          expect(video?.className).toContain("opacity-70");
        });
      })
      .finally(() => {
        Object.defineProperty(window, "requestIdleCallback", {
          configurable: true,
          value: originalRequestIdleCallback,
        });
        Object.defineProperty(window, "cancelIdleCallback", { configurable: true, value: originalCancelIdleCallback });
        Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: originalLoad });
        Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: originalPlay });
        restoreMatchMedia();
      });
  });

  it("rotates hero clips on an Atom-driven interval when multiple clips are supplied", () => {
    const restoreMatchMedia = mockMatchMedia(false);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const originalLoad = HTMLMediaElement.prototype.load;
    const originalPlay = HTMLMediaElement.prototype.play;
    Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });

    const clips = [
      { poster: "/oip/hero-a-poster.jpg", mp4: "/oip/hero-a.mp4", webm: "/oip/hero-a.webm" },
      { poster: "/oip/hero-b-poster.jpg", mp4: "/oip/hero-b.mp4", webm: "/oip/hero-b.webm" },
    ];

    const { container } = render(
      <OipAtomProvider>
        <HeroVideo clips={clips} />
      </OipAtomProvider>
    );

    return waitFor(() => expect(setIntervalSpy.mock.calls.some(([, ms]) => ms === HERO_ROTATE_MS)).toBe(true))
      .then(() => {
        expect(container.querySelector('[data-hero-clip="0"]')?.className).toContain("opacity-100");
        expect(container.querySelector('[data-hero-clip="1"]')?.className).toContain("opacity-0");

        const rotate = setIntervalSpy.mock.calls.find(([, ms]) => ms === HERO_ROTATE_MS)?.[0] as () => void;

        return act(() => {
          rotate();
        });
      })
      .then(() =>
        waitFor(() => {
          expect(container.querySelector('[data-hero-clip="0"]')?.className).toContain("opacity-0");
          expect(container.querySelector('[data-hero-clip="1"]')?.className).toContain("opacity-100");
        })
      )
      .finally(() => {
        setIntervalSpy.mockRestore();
        Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: originalLoad });
        Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: originalPlay });
        restoreMatchMedia();
      });
  });

  it("does not arm hero rotation under reduced motion", () => {
    const restoreMatchMedia = mockMatchMedia(true);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clips = [
      { poster: "/oip/hero-a-poster.jpg", mp4: "/oip/hero-a.mp4", webm: "/oip/hero-a.webm" },
      { poster: "/oip/hero-b-poster.jpg", mp4: "/oip/hero-b.mp4", webm: "/oip/hero-b.webm" },
    ];

    const { container } = render(
      <OipAtomProvider>
        <HeroVideo clips={clips} />
      </OipAtomProvider>
    );

    return waitFor(() => expect(container.querySelector('[data-hero-clip="0"]')).not.toBeNull())
      .then(() => act(() => {}))
      .then(() => {
        expect(setIntervalSpy.mock.calls.some(([, ms]) => ms === HERO_ROTATE_MS)).toBe(false);
        expect(container.querySelector('[data-hero-clip="0"]')?.className).toContain("opacity-100");
        expect(container.querySelector('[data-hero-clip="1"]')?.className).toContain("opacity-0");
      })
      .finally(() => {
        setIntervalSpy.mockRestore();
        restoreMatchMedia();
      });
  });

  it("sets the contact form timestamp through an Atom focus command", () => {
    render(
      <OipAtomProvider>
        <ContactForm email={contactFormEmail} initialSubmittedAt={0} status={undefined} />
      </OipAtomProvider>
    );

    const submittedAtInput = document.querySelector<HTMLInputElement>('input[name="submittedAt"]');

    expect(submittedAtInput?.value).toBe("0");

    fireEvent.focus(screen.getByLabelText("Name"));

    return waitFor(() => expect(Number(submittedAtInput?.value ?? 0)).toBeGreaterThan(0));
  });

  it("keeps launch-risk content review-gated", () => {
    expect(launchReviewGates.clientLogos.status).toBe(ReviewStatus.Enum.needs_review);
    expect(launchReviewGates.contact.status).toBe(ReviewStatus.Enum.needs_review);
    expect(A.every(oipSiteContent.clients, (client) => ReviewStatus.is.needs_review(client.review.status))).toBe(true);
    expect(A.every(oipSiteContent.matters, (matter) => ReviewStatus.is.needs_review(matter.review.status))).toBe(true);
  });

  it("pins the OPIP compatibility redirect table to canonical OIP domains", () =>
    Promise.resolve(oipRedirects()).then((redirects) => {
      expect(redirects).toContainEqual({
        destination: "/oip/:path*",
        permanent: true,
        source: "/opip/:path*",
      });
      expect(redirects).toContainEqual({
        destination: "https://oip.law/:path*",
        has: [{ type: "host", value: "opip.law" }],
        permanent: true,
        source: "/:path*",
      });
      expect(redirects).toContainEqual({
        destination: "https://oip.law/:path*",
        has: [{ type: "host", value: "www.opip.law" }],
        permanent: true,
        source: "/:path*",
      });
      expect(redirects).toContainEqual({
        destination: "https://oip.law/:path*",
        has: [{ type: "host", value: "www.oip.law" }],
        permanent: true,
        source: "/:path*",
      });
      expect(redirects).toContainEqual({
        destination: "https://staging.oip.law/:path*",
        has: [{ type: "host", value: "staging.opip.law" }],
        permanent: false,
        source: "/:path*",
      });
    }));

  it("rejects malformed contact payloads at the schema boundary", () =>
    Promise.all([
      Effect.runPromiseExit(
        decodeContactSubmission({
          ...validContactPayload(),
          email: "not-an-email",
        })
      ),
      Effect.runPromiseExit(
        decodeContactSubmission({
          ...validContactPayload(),
          message: "short",
        })
      ),
      Effect.runPromiseExit(
        decodeContactSubmission({
          ...validContactPayload(),
          submittedAt: Number.POSITIVE_INFINITY,
        })
      ),
    ]).then(([emailExit, messageExit, submittedAtExit]) => {
      expect(Exit.isFailure(emailExit)).toBe(true);
      expect(Exit.isFailure(messageExit)).toBe(true);
      expect(Exit.isFailure(submittedAtExit)).toBe(true);
    }));

  it("rejects malformed contact form payloads at the browser wire schema", () => {
    const decodeFormPayload = S.decodeUnknownExit(ContactSubmissionFormPayload);

    expect(
      Exit.isFailure(
        decodeFormPayload({
          ...validContactPayload(),
          message: "short",
        })
      )
    ).toBe(true);
    expect(
      Exit.isFailure(
        decodeFormPayload({
          ...validContactPayload(),
          name: "T",
        })
      )
    ).toBe(true);
  });

  it("exposes an Effect HttpApi contract and Atom client for contact submissions", () => {
    const submitContactMutation = OipContactHttpApiClient.mutation("contact", "submit");

    expect(OipHttpApi.groups.contact?.identifier).toBe("contact");
    expect(OipHttpApi.groups.contact?.endpoints.submit?.path).toBe("/api/contact");
    expect(submitContactMutation).toBeDefined();
  });

  it("narrows contact HttpApi response schemas to literal statuses", () => {
    const accepted = ContactSubmissionAccepted.make({
      message: "Your note was received.",
      status: "accepted",
    });
    const rejected = ContactSubmissionRejected.make({
      message: "The submission could not be accepted.",
      status: "rejected",
    });

    expect(accepted.status).toBe("accepted");
    expect(rejected.status).toBe("rejected");
    expect(
      Exit.isFailure(
        S.decodeUnknownExit(ContactSubmissionAccepted)({
          message: "The submission could not be accepted.",
          status: "rejected",
        })
      )
    ).toBe(true);
    expect(
      Exit.isFailure(
        S.decodeUnknownExit(ContactSubmissionRejected)({
          message: "Your note was received.",
          status: "accepted",
        })
      )
    ).toBe(true);
  });

  it("converts contact FormData into the shared submission payload", () => {
    const payload = contactSubmissionPayloadFromFormData(contactFormData());

    expect(payload.email).toBe("tom@example.com");
    expect(payload.message).toBe("I would like help protecting a new machine design.");
    expect(payload.name).toBe("Thomas Oppold");
    expect(payload.submittedAt).toBeGreaterThan(0);
  });

  it("defaults a missing FormData submittedAt through the form payload schema", () => {
    const formData = contactFormData();
    formData.delete("submittedAt");

    const payload = contactSubmissionPayloadFromFormData(formData);

    expect(payload.submittedAt).toBe(0);
  });

  it("falls back without throwing for malformed FormData submittedAt values", () => {
    const formData = contactFormData();
    formData.set("submittedAt", "not-a-number");

    expect(() => contactSubmissionPayloadFromFormData(formData)).not.toThrow();
    expect(contactSubmissionPayloadFromFormData(formData).submittedAt).toBe(0);
  });

  it("normalizes accepted contact payload fields before provider submission", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(hubSpotResponse({ results: [{ id: "contact-id" }] }));

    return Effect.runPromise(withContactConfig(submitContact(validContactPayload())))
      .then((response) => {
        expect(response.status).toBe("accepted");
      })
      .finally(() => fetchSpy.mockRestore());
  });

  it("rejects contact submissions when HubSpot config is absent", () =>
    Effect.runPromise(withoutContactConfig(submitContact(validContactPayload()))).then((response) => {
      expect(response.status).toBe("rejected");
      expect(response.message).toBe("The submission could not be accepted.");
    }));

  it("rejects contact submissions when spam controls fail", () =>
    Promise.all([
      Effect.runPromise(
        withContactConfig(
          submitContact({
            ...validContactPayload(),
            website: "https://example.test",
          })
        )
      ),
      Effect.runPromise(
        withContactConfig(
          submitContact({
            ...validContactPayload(),
            submittedAt: 0,
          })
        )
      ),
    ]).then(([honeypotResponse, timestampResponse]) => {
      expect(honeypotResponse.status).toBe("rejected");
      expect(timestampResponse.status).toBe("rejected");
    }));

  it("rejects contact submissions that are too fast", () =>
    Effect.runPromise(
      withContactConfig(
        submitContact({
          ...validContactPayload(),
          submittedAt: Effect.runSync(Clock.currentTimeMillis) - 1_000,
        })
      )
    ).then((response) => {
      expect(response.status).toBe("rejected");
    }));

  it("logs and rejects contact submissions when the provider fails", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(hubSpotResponse({ message: "unavailable" }, 503));

    return Effect.runPromise(withContactConfig(submitContact(validContactPayload())))
      .then((response) => {
        expect(response.status).toBe("rejected");
      })
      .finally(() => fetchSpy.mockRestore());
  });

  it("returns a JSON accepted response through the Effect HttpApi web handler", () => {
    const submit = () =>
      Effect.succeed(
        ContactSubmissionResponse.make({
          message: "Your note was received.",
          status: "accepted",
        })
      );
    const handler = makeOipContactHttpApiWebHandlerWithSubmit(submit);

    return jsonContactRequest(validContactPayload())
      .then(handler)
      .then((response) =>
        response.json().then((body) => {
          expect(response.status).toBe(202);
          expect(body).toEqual({
            message: "Your note was received.",
            status: "accepted",
          });
        })
      );
  });

  it("returns a JSON rejected response for malformed contact route submissions", () =>
    jsonContactRequest({
      email: "not-an-email",
      message: "short",
      name: "",
      submittedAt: Number.POSITIVE_INFINITY,
    })
      .then(POST)
      .then((response) =>
        response.json().then((body) => {
          expect(response.status).toBe(400);
          expect(body).toEqual({
            message: "The submission could not be accepted.",
            status: "rejected",
          });
        })
      ));

  it("returns a JSON rejected response for unreadable contact route submissions", () =>
    POST(
      new Request("https://oip.law/api/contact", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    ).then((response) =>
      response.json().then((body) => {
        expect(response.status).toBe(400);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(body).toEqual({
          message: "The submission could not be accepted.",
          status: "rejected",
        });
      })
    ));

  it("redirects malformed browser form submissions without calling submit", () => {
    const formData = contactFormData();
    formData.set("submittedAt", "not-a-number");
    const submit = vi.fn(() =>
      Effect.succeed(
        ContactSubmissionResponse.make({
          message: "Should not submit.",
          status: "accepted",
        })
      )
    );

    return Effect.runPromise(contactRequestResponseWithSubmit(formContactRequest(formData), submit)).then(
      (response) => {
        expect(submit).not.toHaveBeenCalled();
        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("https://oip.law/?contact=rejected#contact");
      }
    );
  });

  it("redirects browser form contact submissions back to the contact section", () =>
    POST(formContactRequest()).then((response) => {
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://oip.law/?contact=rejected#contact");
    }));
});
