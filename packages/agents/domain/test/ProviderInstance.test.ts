import {
  AuthenticatedSnapshot,
  AuthSnapshot,
  EnvVarName,
  loginGuidance,
  ProbeFailedSnapshot,
  ProviderInstance,
  ProviderKind,
  UnauthenticatedSnapshot,
} from "@beep/agents-domain";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { FastCheck as fc } from "effect/testing";

const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const probedAtIso = "2026-07-11T00:00:00.000Z";
const probedAt = DateTime.makeUnsafe(probedAtIso);
const rejectsEnvVarName = (name: string): boolean => Result.isFailure(S.decodeResult(EnvVarName)(name));

describe("@beep/agents-domain ProviderInstance", () => {
  it("wires ProviderInstance to the agents product-entity identity", () => {
    expect(ProviderInstance.sql.tableName).toBe(Agents.ProviderInstanceId.tableName);
    expect(Agents.ProviderInstanceId.entityType).toBe("AgentsProviderInstance");
    expect(Object.keys(ProviderInstance.insert.fields)).not.toContain("id");
    expect(Object.keys(ProviderInstance.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(ProviderInstance.update.fields)).toContain("id");
    expect(Object.keys(ProviderInstance.update.fields)).toContain("rowVersion");
    expect(Object.keys(ProviderInstance.jsonCreate.fields)).toEqual([
      "binaryPath",
      "envVars",
      "homePath",
      "kind",
      "label",
      "lastProbe",
    ]);
    expect(Object.keys(ProviderInstance.jsonUpdate.fields)).toEqual([
      "binaryPath",
      "envVars",
      "homePath",
      "kind",
      "label",
      "lastProbe",
    ]);
  });

  it("rejects token-bearing env-var names and accepts benign ones", () => {
    expect(rejectsEnvVarName("MY_TOKEN")).toBe(true);
    expect(rejectsEnvVarName("ANTHROPIC_API_KEY")).toBe(true);
    expect(rejectsEnvVarName("ANTHROPIC_AUTH_TOKEN")).toBe(true);
    expect(rejectsEnvVarName("OPENAI_API_KEY")).toBe(true);
    expect(rejectsEnvVarName("OPENAI_ACCESS_TOKEN")).toBe(true);
    expect(rejectsEnvVarName("FOO_SECRET")).toBe(true);
    expect(rejectsEnvVarName("AI_GATEWAY_API_KEY")).toBe(true);
    expect(rejectsEnvVarName("my_token")).toBe(true);
    expect(rejectsEnvVarName("SSH_KEY")).toBe(true);
    expect(rejectsEnvVarName("9BAD_NAME")).toBe(true);
    expect(rejectsEnvVarName("")).toBe(true);

    expect(EnvVarName.is("EDITOR")).toBe(true);
    expect(EnvVarName.is("NO_PROXY")).toBe(true);
    expect(EnvVarName.is("ANTHROPIC_BASE_URL")).toBe(true);
    expect(EnvVarName.is("MY_TOKEN")).toBe(false);
  });

  it("round-trips every AuthSnapshot variant through the tagged union", () => {
    const authenticated = S.decodeSync(AuthSnapshot)({
      status: "authenticated",
      email: "dev@example.com",
      subscriptionLabel: "max",
      tokenSource: "claude.ai",
      probedAt: probedAtIso,
    });
    const unauthenticated = S.decodeSync(AuthSnapshot)({
      status: "unauthenticated",
      probedAt: probedAtIso,
    });
    const probeFailed = S.decodeSync(AuthSnapshot)({
      status: "probe-failed",
      probedAt: probedAtIso,
    });

    expect(authenticated).toBeInstanceOf(AuthenticatedSnapshot);
    expect(unauthenticated).toBeInstanceOf(UnauthenticatedSnapshot);
    expect(probeFailed).toBeInstanceOf(ProbeFailedSnapshot);
    expect(AuthSnapshot.is(authenticated)).toBe(true);
    expect(AuthSnapshot.guards.authenticated(authenticated)).toBe(true);
    expect(AuthSnapshot.guards.unauthenticated(authenticated)).toBe(false);

    roundTrip(AuthSnapshot, authenticated);
    roundTrip(AuthSnapshot, unauthenticated);
    roundTrip(AuthSnapshot, probeFailed);

    expect(Result.getOrThrow(S.encodeResult(AuthSnapshot)(unauthenticated))).toStrictEqual({
      status: "unauthenticated",
      probedAt: probedAtIso,
    });
  });

  it("decodes, constructs, and round-trips a ProviderInstance row", () => {
    const encoded = {
      ...productEntityFixtureInput("AgentsProviderInstance", 7),
      binaryPath: "/usr/local/bin/claude",
      envVars: { NO_PROXY: "localhost" },
      homePath: "/home/beep/.beep/providers/personal-max",
      kind: "claude",
      label: "personal-max",
      lastProbe: {
        status: "authenticated",
        email: "dev@example.com",
        subscriptionLabel: "max",
        tokenSource: "claude.ai",
        probedAt: probedAtIso,
      },
    };
    const decoded = S.decodeUnknownSync(ProviderInstance)(encoded);
    const constructed = ProviderInstance.make(decoded);

    expect(decoded).toBeInstanceOf(ProviderInstance);
    expect(constructed).toBeInstanceOf(ProviderInstance);
    expect(constructed.entityType).toBe("AgentsProviderInstance");
    expect(constructed.kind).toBe("claude");
    expect(O.isSome(constructed.homePath)).toBe(true);
    expect(O.isSome(constructed.lastProbe)).toBe(true);
    expect(Result.getOrThrow(S.encodeResult(ProviderInstance)(decoded))).toStrictEqual(encoded);
  });

  it("applies schema defaults for envVars, homePath, and lastProbe at construction", () => {
    const encoded = {
      ...productEntityFixtureInput("AgentsProviderInstance", 8),
      binaryPath: "/usr/local/bin/codex",
      envVars: {},
      homePath: null,
      kind: "codex",
      label: "work-plus",
      lastProbe: null,
    };
    const decoded = S.decodeUnknownSync(ProviderInstance)(encoded);
    const constructed = ProviderInstance.make(Struct.omit(decoded, ["envVars", "homePath", "lastProbe"]));

    expect(constructed.envVars).toStrictEqual({});
    expect(O.isNone(constructed.homePath)).toBe(true);
    expect(O.isNone(constructed.lastProbe)).toBe(true);
    expect(Result.getOrThrow(S.encodeResult(ProviderInstance)(constructed))).toStrictEqual(encoded);
  });

  it("never stores token-bearing env-var names on a decoded instance", () => {
    const encoded = {
      ...productEntityFixtureInput("AgentsProviderInstance", 9),
      binaryPath: "/usr/local/bin/claude",
      envVars: { ANTHROPIC_AUTH_TOKEN: "sk-please-no" },
      homePath: null,
      kind: "claude",
      label: "smuggler",
      lastProbe: null,
    };

    expect(Result.isFailure(S.decodeUnknownResult(ProviderInstance)(encoded))).toBe(true);
  });

  it("returns exact login guidance for unauthenticated instances", () => {
    const unauthenticated = UnauthenticatedSnapshot.make({ probedAt });

    expect(loginGuidance("claude", unauthenticated)).toBe(
      "Run `claude auth login` in your terminal, then probe again."
    );
    expect(loginGuidance("codex", unauthenticated)).toBe("Run `codex login` in your terminal, then probe again.");
  });

  it("covers every provider kind and snapshot variant exhaustively", () => {
    const snapshots: ReadonlyArray<AuthSnapshot> = [
      AuthenticatedSnapshot.make({ probedAt }),
      UnauthenticatedSnapshot.make({ probedAt }),
      ProbeFailedSnapshot.make({ probedAt }),
    ];
    const guidance = A.flatMap(ProviderKind.Options, (kind) =>
      A.map(snapshots, (snapshot) => loginGuidance(kind, snapshot))
    );

    expect(guidance).toHaveLength(6);
    expect(A.dedupe(guidance)).toHaveLength(6);
    for (const message of guidance) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(loginGuidance("claude", ProbeFailedSnapshot.make({ probedAt }))).toMatch(/binary path/);
    expect(loginGuidance("codex", ProbeFailedSnapshot.make({ probedAt }))).toMatch(/binary path/);
  });

  it("round-trips schema-derived arbitraries", () => {
    const schemas: ReadonlyArray<S.Codec<unknown>> = [AuthSnapshot, ProviderKind, ProviderInstance];

    for (const schema of schemas) {
      fc.assert(
        fc.property(S.toArbitrary(schema)(fc), (value) => roundTrip(schema, value)),
        fcRuns(10)
      );
    }
  });
});
