import { EmailString } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { Button } from "@beep/ui/components/ui/button";
import { A } from "@beep/utils";
import { beforeEach, describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Clock, ConfigProvider, Effect, Exit, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import { FetchHttpClient } from "effect/http";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as React from "react";
import { vi } from "vitest";
import { makeOipContactHttpApiWebHandlerWithSubmit } from "@/app/api/contact/ContactHttpApiRoute";
import { contactRequestResponseWithSubmit } from "@/app/api/contact/ContactRouteResponse";
import { POST } from "@/app/api/contact/route";
import { GET as llmsTextRoute } from "@/app/llms.txt/route";
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

const encodeCapturedLogs = S.encodeEffect(S.fromJsonString(S.Unknown));

const decodeUnknownContactSubmissionAcceptedExit = S.decodeUnknownExit(ContactSubmissionAccepted);
const decodeUnknownContactSubmissionFormPayloadExit = S.decodeUnknownExit(ContactSubmissionFormPayload);
const decodeUnknownContactSubmissionRejectedExit = S.decodeUnknownExit(ContactSubmissionRejected);

const contactFormEmail = EmailString.make("tom@example.com");

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

const validContactPayload = (submittedAt = Effect.runSync(Clock.currentTimeMillis) - 5_000) => ({
  email: "TOM@EXAMPLE.COM",
  message: "I would like help protecting a new machine design.",
  name: " Thomas Oppold ",
  submittedAt,
});

const withContactConfig = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({
    CRM_HUBSPOT_ACCOUNT_ID: "12345",
    CRM_HUBSPOT_SERVICE_KEY: "hubspot-service-key",
  })
);
const withoutContactConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

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
  const spy = vi.spyOn(window, "matchMedia").mockImplementation(() => mockMediaQueryList(matches));
  return () => spy.mockRestore();
};

const setWindowScrollY = (scrollY: number) =>
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });

const OipSiteContentArbitrary = Arbitrary.schema(OipSiteContent);
const OipSiteContentEquivalence = S.toEquivalence(OipSiteContent);
const ContactSubmissionArbitrary = Arbitrary.schema(ContactSubmission);
const ContactSubmissionEquivalence = S.toEquivalence(ContactSubmission);
const ContactSubmissionFormPayloadArbitrary = Arbitrary.schema(ContactSubmissionFormPayload);
const ContactSubmissionFormPayloadEquivalence = S.toEquivalence(ContactSubmissionFormPayload);
const ContactSubmissionResponseArbitrary = Arbitrary.schema(ContactSubmissionResponse);
const ContactSubmissionResponseEquivalence = S.toEquivalence(ContactSubmissionResponse);
const encodeOipSiteContent = S.encodeEffect(OipSiteContent);
const decodeOipSiteContent = S.decodeUnknownEffect(OipSiteContent);
const encodeContactSubmission = S.encodeEffect(ContactSubmission);
const encodeContactSubmissionFormPayload = S.encodeEffect(ContactSubmissionFormPayload);
const decodeContactSubmissionFormPayload = S.decodeUnknownEffect(ContactSubmissionFormPayload);
const encodeContactSubmissionResponse = S.encodeEffect(ContactSubmissionResponse);
const decodeContactSubmissionResponse = S.decodeUnknownEffect(ContactSubmissionResponse);

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

  it("exports the main page as a valid React element", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return Home({})
      .then((page) => {
        pipe(React.isValidElement(page), assertTrue);
      })
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });

  it("publishes install and indexing metadata for the canonical OIP URL", () => {
    expect(oipManifest()).toMatchObject({ name: "OIP - Oppold IP Law", start_url: "/" });
    expect(oipRobots()).toMatchObject({ sitemap: "https://oip.law/sitemap.xml" });
    expect(oipSitemap()[0]).toMatchObject({ url: "https://oip.law" });
  });

  it("decodes the static OIP launch content", () => {
    const result = decodeOipSiteContentResult(oipSiteContent);

    pipe(result, Result.isSuccess, assertTrue);
  });

  it.effect.prop(
    "round-trips generated OIP site content",
    [OipSiteContentArbitrary],
    Effect.fnUntraced(function* ([content]) {
      const encoded = yield* encodeOipSiteContent(content);
      const decoded = yield* decodeOipSiteContent(encoded);
      pipe(OipSiteContentEquivalence(decoded, content), assertTrue);
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect.prop(
    "round-trips generated contact submissions",
    [ContactSubmissionArbitrary],
    Effect.fnUntraced(function* ([submission]) {
      const encoded = yield* encodeContactSubmission(submission);
      const decoded = yield* decodeContactSubmission(encoded);
      pipe(ContactSubmissionEquivalence(decoded, submission), assertTrue);
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect.prop(
    "round-trips generated contact payloads",
    [ContactSubmissionFormPayloadArbitrary],
    Effect.fnUntraced(function* ([payload]) {
      const encoded = yield* encodeContactSubmissionFormPayload(payload);
      const decoded = yield* decodeContactSubmissionFormPayload(encoded);
      pipe(ContactSubmissionFormPayloadEquivalence(decoded, payload), assertTrue);
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect.prop(
    "round-trips generated contact responses",
    [ContactSubmissionResponseArbitrary],
    Effect.fnUntraced(function* ([response]) {
      const encoded = yield* encodeContactSubmissionResponse(response);
      const decoded = yield* decodeContactSubmissionResponse(encoded);
      pipe(ContactSubmissionResponseEquivalence(decoded, response), assertTrue);
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "preserves encoded contact wire shape while decoding optional fields to Option",
    Effect.fnUntraced(function* () {
      const submittedAt = S.Natural.make(5_000);
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
      const decoded = yield* decodeContactSubmission(encoded);

      expect(yield* encodeContactSubmission(decoded)).toEqual(encoded);
      expect(
        yield* encodeContactSubmission(
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
    })
  );

  it.effect("exposes schema class-local decoders beside compatibility exports", () =>
    Effect.gen(function* () {
      const contentResult = OipSiteContent.decodeUnknownResult(oipSiteContent);
      expect(contentResult).toEqual(decodeOipSiteContentResult(oipSiteContent));

      const formPayload = contactSubmissionPayloadFromFormData(contactFormData());
      const formResult = ContactSubmissionFormPayload.decodeUnknownResult(formPayload);
      pipe(formResult, Result.isSuccess, assertTrue);

      const contactPayload = validContactPayload();
      const submission = yield* ContactSubmission.decodeUnknownEffect(contactPayload);
      const submissionFromAlias = yield* decodeContactSubmission(contactPayload);
      const submissionWithOptionNamedField = yield* decodeContactSubmission({
        ...contactPayload,
        errors: "all",
      });
      expect(submission).toEqual(submissionFromAlias);
      expect(submissionWithOptionNamedField).toEqual(submission);
    })
  );

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

  it("renders brand-compliant footer social links", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return Home({})
      .then((page) => {
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
      })
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });

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

  it("renders the OIP public headline and contact CTA", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return Home({})
      .then((page) => {
        render(page);

        expect(screen.getByRole("heading", { name: /thirty years as patent counsel/i })).toBeDefined();
        expect(screen.getByRole("link", { name: oipSiteContent.contact.email })).toBeDefined();
        expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeDefined();
      })
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });

  it("renders a server-seeded contact timestamp for progressive form posts", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return Home({})
      .then((page) => {
        render(page);

        const submittedAtInput = document.querySelector<HTMLInputElement>('input[name="submittedAt"]');

        expect(submittedAtInput).not.toBeNull();
        expect(Number(submittedAtInput?.value ?? 0)).toBeGreaterThan(0);
      })
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });

  it("renders the progressive theme toggle hook for the static layout script", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return Home({})
      .then((page) => {
        render(page);

        const toggles = screen.getAllByRole("button", { name: "Switch to dark mode" });
        const toggle = A.getUnsafe(toggles, A.length(toggles) - 1);

        expect(toggle.getAttribute("data-oip-theme-toggle")).toBe("");
        expect(toggle.getAttribute("data-theme-mode")).toBe("light");
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
      })
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });

  it("provides an optional OIP MUI theme override provider", () => {
    render(
      <OipThemeProvider>
        <Button>OIP themed child</Button>
      </OipThemeProvider>
    );

    expect(screen.getByRole("button", { name: "OIP themed child" })).toBeDefined();
  });

  it("drives the back-to-top control from Atom-managed scroll state", ({ onTestFinished }) => {
    const originalScrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        if (originalScrollYDescriptor !== undefined)
          Object.defineProperty(window, "scrollY", originalScrollYDescriptor);
        else Reflect.deleteProperty(window, "scrollY");
      }
    });
    const restoreMatchMedia = mockMatchMedia(false);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        restoreMatchMedia();
      }
    });

    const scrollTo = vi.fn();
    const ownedScrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(scrollTo);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        ownedScrollToSpy.mockRestore();
      }
    });
    setWindowScrollY(0);

    render(
      <OipAtomProvider>
        <BackToTop />
      </OipAtomProvider>
    );

    const button = screen.getByLabelText("Back to top") as HTMLButtonElement;

    strictEqual(button.hidden, true);

    setWindowScrollY(720);
    fireEvent.scroll(window);

    return waitFor(() => strictEqual(button.hidden, false)).then(() => {
      fireEvent.click(button);

      expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", top: 0 });
    });
  });

  it("starts the hero video through an Atom-mounted idle task and stores playing state in Atom", ({
    onTestFinished,
  }) => {
    const restoreMatchMedia = mockMatchMedia(false);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        restoreMatchMedia();
      }
    });

    let idleCallback: IdleRequestCallback | undefined;
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback): number => {
      idleCallback = callback;
      return 7;
    });
    const cancelIdleCallback = vi.fn();
    const load = vi.fn();
    const play = vi.fn(() => Promise.resolve());
    const ownedRequestIdleCallbackSpy = vi.spyOn(window, "requestIdleCallback").mockImplementation(requestIdleCallback);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        ownedRequestIdleCallbackSpy.mockRestore();
      }
    });
    const ownedCancelIdleCallbackSpy = vi.spyOn(window, "cancelIdleCallback").mockImplementation(cancelIdleCallback);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        ownedCancelIdleCallbackSpy.mockRestore();
      }
    });
    const ownedLoadSpy = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(load);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        ownedLoadSpy.mockRestore();
      }
    });
    const ownedPlaySpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        ownedPlaySpy.mockRestore();
      }
    });

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

    return waitFor(() => expect(requestIdleCallback).toHaveBeenCalled()).then(() => {
      idleCallback?.({ didTimeout: false, timeRemaining: () => 0 });

      expect(load).toHaveBeenCalled();
      expect(play).toHaveBeenCalled();
      expect(image?.className).toContain("opacity-70");

      fireEvent.playing(video as HTMLVideoElement);

      return waitFor(() => {
        expect(image?.className).toContain("opacity-0");
        expect(video?.className).toContain("opacity-70");
      });
    });
  });

  it("rotates hero clips on an Atom-driven interval when multiple clips are supplied", ({ onTestFinished }) => {
    const restoreMatchMedia = mockMatchMedia(false);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        restoreMatchMedia();
      }
    });
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        setIntervalSpy.mockRestore();
      }
    });

    const ownedLoadSpy = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(vi.fn());
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        ownedLoadSpy.mockRestore();
      }
    });
    const ownedPlaySpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(vi.fn(() => Promise.resolve()));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        ownedPlaySpy.mockRestore();
      }
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

    return waitFor(() =>
      pipe(
        setIntervalSpy.mock.calls.some(([, ms]) => ms === HERO_ROTATE_MS),
        assertTrue
      )
    )
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
      );
  });

  it("does not arm hero rotation under reduced motion", ({ onTestFinished }) => {
    const restoreMatchMedia = mockMatchMedia(true);
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        restoreMatchMedia();
      }
    });
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        setIntervalSpy.mockRestore();
      }
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

    return waitFor(() => expect(container.querySelector('[data-hero-clip="0"]')).not.toBeNull())
      .then(() => act(() => {}))
      .then(() => {
        pipe(
          setIntervalSpy.mock.calls.some(([, ms]) => ms === HERO_ROTATE_MS),
          assertFalse
        );
        expect(container.querySelector('[data-hero-clip="0"]')?.className).toContain("opacity-100");
        expect(container.querySelector('[data-hero-clip="1"]')?.className).toContain("opacity-0");
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
    pipe(
      A.every(oipSiteContent.clients, (client) => ReviewStatus.is.needs_review(client.review.status)),
      assertTrue
    );
    pipe(
      A.every(oipSiteContent.matters, (matter) => ReviewStatus.is.needs_review(matter.review.status)),
      assertTrue
    );
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
      pipe(emailExit, Exit.isFailure, assertTrue);
      pipe(messageExit, Exit.isFailure, assertTrue);
      pipe(submittedAtExit, Exit.isFailure, assertTrue);
    }));

  it("rejects malformed contact form payloads at the browser wire schema", () => {
    pipe(
      decodeUnknownContactSubmissionFormPayloadExit({
        ...validContactPayload(),
        message: "short",
      }),
      Exit.isFailure,
      assertTrue
    );
    pipe(
      decodeUnknownContactSubmissionFormPayloadExit({
        ...validContactPayload(),
        name: "T",
      }),
      Exit.isFailure,
      assertTrue
    );
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
    pipe(
      decodeUnknownContactSubmissionAcceptedExit({
        message: "The submission could not be accepted.",
        status: "rejected",
      }),
      Exit.isFailure,
      assertTrue
    );
    pipe(
      decodeUnknownContactSubmissionRejectedExit({
        message: "Your note was received.",
        status: "accepted",
      }),
      Exit.isFailure,
      assertTrue
    );
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

  it.effect("normalizes accepted contact payload fields before provider submission", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(10_000);
      const fetchSpy = yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(globalThis, "fetch").mockResolvedValue(hubSpotResponse({ results: [{ id: "contact-id" }] }))
        ),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const now = yield* Clock.currentTimeMillis;
      const response = yield* withContactConfig(submitContact(validContactPayload(now - 5_000))).pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetchSpy)
      );

      expect(response.status).toBe("accepted");
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [input, init] = pipe(fetchSpy.mock.calls, A.head, O.getOrThrow);
      const body = yield* Effect.tryPromise(() => new Request(input, init).json());
      expect(body).toEqual({
        inputs: [
          {
            id: "tom@example.com",
            idProperty: "email",
            objectWriteTraceId: "oip-contact-form",
            properties: {
              email: "tom@example.com",
              firstname: "Thomas Oppold",
              message: "Message:\nI would like help protecting a new machine design.",
            },
          },
        ],
      });
    })
  );

  it.effect("rejects contact submissions when HubSpot config is absent", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(10_000);
      const now = yield* Clock.currentTimeMillis;
      const response = yield* withoutContactConfig(submitContact(validContactPayload(now - 5_000)));
      expect(response.status).toBe("rejected");
      expect(response.message).toBe("The submission could not be accepted.");
    })
  );

  it.effect("rejects contact submissions when spam controls fail", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(10_000);
      const now = yield* Clock.currentTimeMillis;
      const [honeypotResponse, timestampResponse] = yield* Effect.all(
        [
          withContactConfig(submitContact({ ...validContactPayload(now - 5_000), website: "https://example.test" })),
          withContactConfig(submitContact({ ...validContactPayload(now - 5_000), submittedAt: 0 })),
        ],
        { concurrency: "unbounded" }
      );
      expect(honeypotResponse.status).toBe("rejected");
      expect(timestampResponse.status).toBe("rejected");
    })
  );

  it.effect("rejects contact submissions that are too fast", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(10_000);
      const fetchSpy = yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(globalThis, "fetch").mockResolvedValue(hubSpotResponse({ results: [{ id: "contact-id" }] }))
        ),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const now = yield* Clock.currentTimeMillis;
      const response = yield* withContactConfig(submitContact(validContactPayload(now - 1_000))).pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetchSpy)
      );
      expect(response.status).toBe("rejected");
      expect(fetchSpy).not.toHaveBeenCalled();
    })
  );

  it.effect("logs and rejects contact submissions when the provider fails", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(10_000);
      const fetchSpy = yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(globalThis, "fetch").mockResolvedValue(hubSpotResponse({ message: "unavailable" }, 503))
        ),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      let records: ReadonlyArray<ReturnType<typeof Logger.formatStructured.log>> = [];
      const logger = Logger.make((options) => {
        records = A.append(records, Logger.formatStructured.log(options));
      });
      const now = yield* Clock.currentTimeMillis;
      const response = yield* withContactConfig(submitContact(validContactPayload(now - 5_000))).pipe(
        Effect.provideService(Logger.CurrentLoggers, new Set([logger])),
        Effect.provideService(FetchHttpClient.Fetch, fetchSpy)
      );
      expect(response.status).toBe("rejected");
      expect(fetchSpy).toHaveBeenCalledOnce();
      const rejection = pipe(
        records,
        A.findFirst((record) => record.annotations.operation === "oip.contact.submit"),
        O.getOrThrow
      );
      expect(rejection.annotations).toMatchObject({
        operation: "oip.contact.submit",
        outcome: "rejected",
        reason: "provider",
        provider: "hubspot",
        providerReason: "response status",
        status: 503,
      });
      const serialized = yield* encodeCapturedLogs(records);
      for (const personal of [
        "TOM@EXAMPLE.COM",
        "tom@example.com",
        "Thomas Oppold",
        "I would like help protecting a new machine design.",
        "hubspot-service-key",
      ])
        expect(serialized).not.toContain(personal);
    })
  );

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

  it("returns a JSON rejected response for unreadable contact route submissions", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return POST(
      new Request("https://oip.law/api/contact", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    )
      .then((response) =>
        response.json().then((body) => {
          expect(response.status).toBe(400);
          expect(response.headers.get("content-type")).toContain("application/json");
          expect(body).toEqual({
            message: "The submission could not be accepted.",
            status: "rejected",
          });
        })
      )
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });

  it.effect("redirects malformed browser form submissions without calling submit", () =>
    Effect.gen(function* () {
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

      const response = yield* contactRequestResponseWithSubmit(formContactRequest(formData), submit);
      expect(submit).not.toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://oip.law/?contact=rejected#contact");
    })
  );

  it("redirects browser form contact submissions back to the contact section", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return POST(formContactRequest())
      .then((response) => {
        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("https://oip.law/?contact=rejected#contact");
      })
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });

  it.effect(
    "rejects a browser form submission missing a required field without calling submit",
    Effect.fnUntraced(function* () {
      const formData = contactFormData();
      formData.delete("name");
      const submit = vi.fn(() =>
        Effect.succeed(
          ContactSubmissionResponse.make({
            message: "Should not submit.",
            status: "accepted",
          })
        )
      );

      const response = yield* contactRequestResponseWithSubmit(formContactRequest(formData), submit);

      expect(submit).not.toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://oip.law/?contact=rejected#contact");
    })
  );

  it("serves llms.txt as plain text from the loaded site content", ({ onTestFinished }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unconfigured provider must not receive a request"));
    onTestFinished(() => {
      try {
        cleanup();
      } finally {
        fetchSpy.mockRestore();
      }
    });
    return llmsTextRoute()
      .then((response) =>
        response.text().then((body) => {
          expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
          expect(body).toContain("# OIP - Oppold IP Law");
          expect(body).toContain("## Practice Areas");
        })
      )
      .then((value) => {
        expect(fetchSpy).not.toHaveBeenCalled();
        return value;
      });
  });
});
