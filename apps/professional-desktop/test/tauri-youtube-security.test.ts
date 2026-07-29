import { YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import { Result } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

interface TauriConfig {
  readonly app: {
    readonly security: {
      readonly csp: string;
      readonly devCsp: string;
    };
  };
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
  it("allows frames from the privacy-enhanced embed origin and nothing else", () => {
    expect(directiveSources(tauriConfig.app.security.csp, "frame-src")).toEqual(["https://www.youtube-nocookie.com"]);
    expect(directiveSources(tauriConfig.app.security.devCsp, "frame-src")).toEqual([
      "https://www.youtube-nocookie.com",
    ]);
  });

  it("keeps packaged workers on same-origin generated assets", () => {
    expect(directiveSources(tauriConfig.app.security.csp, "worker-src")).toEqual(["'self'"]);
    expect(directiveSources(tauriConfig.app.security.devCsp, "worker-src")).toEqual(["'self'"]);
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

    expect(isWatchRequest({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })).toBe(true);
    expect(isWatchRequest({ url: "https://www.youtube.com/watchXv=dQw4w9WgXcQ" })).toBe(false);
    expect(isWatchRequest({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1" })).toBe(false);
    expect(isWatchRequest({ url: "https://www.youtube.com/watch?v=dQw4w9WgXc" })).toBe(false);
  });
});
