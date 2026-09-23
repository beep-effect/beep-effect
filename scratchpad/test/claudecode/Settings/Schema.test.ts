import * as Exit from "effect/Exit";
import * as Effect from "effect/Effect";
/**
 * Contract tests for Claude Code 2.1.220 settings schemas.
 *
 * @since 0.0.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { PermissionMode, SettingsFile, WorktreeConfig } from "../../../claudecode/Settings/Schema.ts";
const decodeUnknownWorktreeConfig = S.decodeUnknownEffect(WorktreeConfig);

const decodeSettings = S.decodeUnknownEffect(SettingsFile);
const encodeSettings = S.encodeEffect(SettingsFile);

describe("SettingsFile current wire contract", () => {
  it.effect("decodes absent properties to None and omits them when encoded", () => Effect.gen(function* () {
    const settings = (yield* decodeSettings({}));
    expect(settings.model).toEqual(O.none());
    expect(settings.permissions).toEqual(O.none());
    expect(settings.sandbox).toEqual(O.none());
    expect((yield* encodeSettings(settings))).toEqual({});
  }));

  it.effect("accepts manual permission mode", () => Effect.gen(function* () {
    expect(PermissionMode.is.manual("manual")).toBe(true);
    const settings = (yield* decodeSettings({
      permissions: {
        defaultMode: "manual",
      },
    }));
    expect((yield* encodeSettings(settings))).toMatchObject({
      permissions: {
        defaultMode: "manual",
      },
    });
  }));

  it.effect("models current worktree, theme, voice, and effort settings", () => Effect.gen(function* () {
    const settings = (yield* decodeSettings({
      effortLevel: "xhigh",
      theme: "custom:acme",
      voice: {
        enabled: true,
        mode: "tap",
        autoSubmit: false,
      },
      worktree: {
        baseRef: "head",
        bgIsolation: "none",
        symlinkDirectories: ["node_modules"],
        sparsePaths: ["packages/app"],
      },
    }));
    expect((yield* encodeSettings(settings))).toMatchObject({
      effortLevel: "xhigh",
      theme: "custom:acme",
      voice: {
        enabled: true,
        mode: "tap",
        autoSubmit: false,
      },
      worktree: {
        baseRef: "head",
        bgIsolation: "none",
        symlinkDirectories: ["node_modules"],
        sparsePaths: ["packages/app"],
      },
    });
  }));

  it.effect("models strict marketplace policies as direct source arrays", () => Effect.gen(function* () {
    const settings = (yield* decodeSettings({
      strictKnownMarketplaces: [
        {
          source: "github",
          repo: "acme/approved",
          ref: "v2",
        },
        {
          source: "url",
          url: "https://plugins.example.com/marketplace.json",
          headers: { Authorization: "Bearer ${TOKEN}" },
        },
        {
          source: "npm",
          package: "@acme/plugins",
        },
        {
          source: "hostPattern",
          hostPattern: "^git\\.example\\.com$",
        },
        {
          source: "pathPattern",
          pathPattern: "^/opt/approved/",
        },
      ],
      blockedMarketplaces: [
        {
          source: "git",
          url: "https://git.example.com/untrusted.git",
        },
      ],
    }));
    expect((yield* encodeSettings(settings))).toMatchObject({
      strictKnownMarketplaces: [
        {
          source: "github",
          repo: "acme/approved",
          ref: "v2",
        },
        {
          source: "url",
          url: "https://plugins.example.com/marketplace.json",
          headers: { Authorization: "Bearer ${TOKEN}" },
        },
        {
          source: "npm",
          package: "@acme/plugins",
        },
        {
          source: "hostPattern",
          hostPattern: "^git\\.example\\.com$",
        },
        {
          source: "pathPattern",
          pathPattern: "^/opt/approved/",
        },
      ],
      blockedMarketplaces: [
        {
          source: "git",
          url: "https://git.example.com/untrusted.git",
        },
      ],
    });
  }));

  it.effect("models current sandbox credential and TLS isolation fields", () => Effect.gen(function* () {
    const settings = (yield* decodeSettings({
      sandbox: {
        enabled: true,
        filesystem: {
          disabled: false,
          allowRead: ["."],
          denyRead: ["~/.aws"],
        },
        credentials: {
          files: [
            {
              path: "~/.aws/credentials",
              mode: "deny",
            },
          ],
          envVars: [
            {
              name: "GITHUB_TOKEN",
              mode: "mask",
              injectHosts: ["api.github.com"],
            },
          ],
          allowPlaintextInject: false,
        },
        network: {
          allowedDomains: ["api.github.com"],
          tlsTerminate: {},
        },
      },
    }));
    expect((yield* encodeSettings(settings))).toMatchObject({
      sandbox: {
        enabled: true,
        filesystem: {
          disabled: false,
          allowRead: ["."],
          denyRead: ["~/.aws"],
        },
        credentials: {
          files: [
            {
              path: "~/.aws/credentials",
              mode: "deny",
            },
          ],
          envVars: [
            {
              name: "GITHUB_TOKEN",
              mode: "mask",
              injectHosts: ["api.github.com"],
            },
          ],
          allowPlaintextInject: false,
        },
        network: {
          allowedDomains: ["api.github.com"],
          tlsTerminate: {},
        },
      },
    });
  }));

  it.effect("keeps apiKeyHelper string-only", () => Effect.gen(function* () {
    const exit = yield* Effect.exit(decodeSettings({ apiKeyHelper: 42 }));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(yield* encodeSettings(yield* decodeSettings({ apiKeyHelper: "/bin/key-helper" }))).toMatchObject({
      apiKeyHelper: "/bin/key-helper",
    });
  }));

  it.effect("rejects former boolean worktree isolation and marketplace policy", () => Effect.gen(function* () {
    const worktreeExit = yield* Effect.exit(decodeUnknownWorktreeConfig({ bgIsolation: true }));
    expect(Exit.isFailure(worktreeExit)).toBe(true);
    const marketplaceExit = yield* Effect.exit(decodeSettings({ strictKnownMarketplaces: true }));
    expect(Exit.isFailure(marketplaceExit)).toBe(true);
  }));
});
