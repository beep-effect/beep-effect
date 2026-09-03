import { YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

interface TauriConfig {
  readonly app: {
    readonly security: {
      readonly csp: string;
      readonly devCsp: string;
    };
    readonly windows: ReadonlyArray<{
      readonly create: boolean;
      readonly label: string;
    }>;
  };
  readonly identifier: string;
}

interface CapabilityConfig {
  readonly permissions: ReadonlyArray<
    | string
    | {
        readonly allow: ReadonlyArray<{ readonly url: string }>;
        readonly identifier: string;
      }
  >;
}

const tauriConfig = (await Bun.file("src-tauri/tauri.conf.json").json()) as TauriConfig;
const capability = (await Bun.file("src-tauri/capabilities/default.json").json()) as CapabilityConfig;
const nativeSource = await Bun.file("src-tauri/src/lib.rs").text();
const webExtensionSource = await Bun.file("src-tauri/web-extension/youtube_referrer.c").text();

const youtubeWatchCapability =
  "https://www.youtube.com/watch[?]v=[A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-]";

const directiveSources = (policy: string, name: string): ReadonlyArray<string> => {
  const directive = policy
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name} `));
  return directive === undefined ? [] : directive.split(/\s+/u).slice(1);
};

describe("packaged YouTube security boundaries", () => {
  it("loads the Linux request extension before creating the main WebView", () => {
    expect(tauriConfig.identifier).toBe("cloud.beep.professional-desktop");
    expect(tauriConfig.app.windows).toEqual([
      expect.objectContaining({
        create: false,
        label: "main",
      }),
    ]);
    expect(nativeSource).toContain('include_bytes!(env!("BEEP_WEB_EXTENSION_PATH"))');
    expect(nativeSource).toContain("main_window.extensions_path(prepare_youtube_web_extension(");
    expect(nativeSource.indexOf("main_window.extensions_path(")).toBeLessThan(
      nativeSource.indexOf("main_window.build()")
    );
  });

  it("scopes the Web-process Referer mutation to an exact privacy-enhanced embed", () => {
    expect(webExtensionSource).toContain('#define BEEP_YOUTUBE_EMBED_PREFIX "https://www.youtube-nocookie.com/embed/"');
    expect(webExtensionSource).toContain('#define BEEP_YOUTUBE_APP_REFERER "https://cloud.beep.professional-desktop/"');
    expect(webExtensionSource).toContain('g_signal_connect(web_page, "send-request", G_CALLBACK(send_request), NULL)');
    expect(webExtensionSource).toContain('soup_message_headers_replace(headers, "Referer", BEEP_YOUTUBE_APP_REFERER)');
    expect(webExtensionSource).toContain('g_message("event=beep_youtube_referrer_applied")');
  });

  it("allows frames from the privacy-enhanced embed origin and nothing else", () => {
    expect(directiveSources(tauriConfig.app.security.csp, "frame-src")).toEqual(["https://www.youtube-nocookie.com"]);
    expect(directiveSources(tauriConfig.app.security.devCsp, "frame-src")).toEqual([
      "https://www.youtube-nocookie.com",
    ]);
  });

  it("keeps packaged workers scoped while permitting blob attachment previews", () => {
    expect(directiveSources(tauriConfig.app.security.csp, "worker-src")).toEqual(["'self'"]);
    expect(directiveSources(tauriConfig.app.security.devCsp, "worker-src")).toEqual(["'self'"]);
    expect(directiveSources(tauriConfig.app.security.csp, "img-src")).toEqual(["'self'", "blob:"]);
    expect(directiveSources(tauriConfig.app.security.devCsp, "img-src")).toEqual(["'self'", "blob:"]);
    expect(tauriConfig.app.security.csp).not.toContain("data:");
    expect(tauriConfig.app.security.devCsp).not.toContain("data:");
  });

  it("scopes the native opener to canonical YouTube watch URLs", () => {
    const opener = capability.permissions.find(
      (permission) => typeof permission !== "string" && permission.identifier === "opener:allow-open-url"
    );

    expect(opener).toEqual({
      identifier: "opener:allow-open-url",
      allow: [{ url: youtubeWatchCapability }],
    });
  });

  it("rejects watch-url lookalikes and suffixes at the typed event boundary", () => {
    const isWatchRequest = (input: unknown): boolean =>
      Result.isSuccess(S.decodeUnknownResult(YouTubeWatchRequest)(input));

    expect(isWatchRequest({ url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" })).toBe(true);
    expect(isWatchRequest({ url: "https://www.youtube.com/watchXv=M7lc1UVf-VE" })).toBe(false);
    expect(isWatchRequest({ url: "https://www.youtube.com/watch?v=M7lc1UVf-VE&autoplay=1" })).toBe(false);
    expect(isWatchRequest({ url: "https://www.youtube.com/watch?v=dQw4w9WgXc" })).toBe(false);
  });
});
