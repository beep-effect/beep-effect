/**
 * Contract tests for Claude Code 2.1.220 settings schemas.
 *
 * @since 0.0.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { PermissionMode, SettingsFile, WorktreeConfig } from "../../../claudecode/Settings/Schema.ts";

const decodeSettings = S.decodeUnknownSync(SettingsFile);
const encodeSettings = S.encodeSync(SettingsFile);

describe("SettingsFile current wire contract", () => {
  it("decodes absent properties to None and omits them when encoded", () => {
    const settings = decodeSettings({});
    expect(settings.model).toEqual(O.none());
    expect(settings.permissions).toEqual(O.none());
    expect(settings.sandbox).toEqual(O.none());
    expect(encodeSettings(settings)).toEqual({});
  });

  it("accepts manual permission mode", () => {
    expect(PermissionMode.is.manual("manual")).toBe(true);
    const settings = decodeSettings({
      permissions: {
        defaultMode: "manual",
      },
    });
    expect(encodeSettings(settings)).toMatchObject({
      permissions: {
        defaultMode: "manual",
      },
    });
  });

  it("models current worktree, theme, voice, and effort settings", () => {
    const settings = decodeSettings({
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
    expect(encodeSettings(settings)).toMatchObject({
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
  });

  it("models strict marketplace policies as direct source arrays", () => {
    const settings = decodeSettings({
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
    expect(encodeSettings(settings)).toMatchObject({
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
  });

  it("models current sandbox credential and TLS isolation fields", () => {
    const settings = decodeSettings({
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
    expect(encodeSettings(settings)).toMatchObject({
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
  });

  it("keeps apiKeyHelper string-only", () => {
    expect(() => decodeSettings({ apiKeyHelper: 42 })).toThrow();
    expect(encodeSettings(decodeSettings({ apiKeyHelper: "/bin/key-helper" }))).toMatchObject({
      apiKeyHelper: "/bin/key-helper",
    });
  });

  it("rejects former boolean worktree isolation and marketplace policy", () => {
    expect(() => S.decodeUnknownSync(WorktreeConfig)({ bgIsolation: true })).toThrow();
    expect(() => decodeSettings({ strictKnownMarketplaces: true })).toThrow();
  });
});
