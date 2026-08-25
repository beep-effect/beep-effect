import { BlockedHostError } from "@beep/schema";
import { CsvError } from "@beep/schema/CsvError";
import {
  LiteralKitEnumMappingCoverageError,
  LiteralKitEnumMappingDuplicateLiteralError,
  LiteralKitKeyCollisionError,
  LiteralKitTaggedUnionLiteralError,
  LiteralNotInSetError,
} from "@beep/schema/LiteralKit";
import { MappedLiteralDuplicateError } from "@beep/schema/MappedLiteralKit";
import { ParserOptionsError } from "@beep/schema/ParserOptions";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import {
  CoreError,
  CrossOriginEmbedderPolicyError,
  CrossOriginOpenerPolicyError,
  CrossOriginResourcePolicyError,
  CspError,
  ExpectCtError,
  ForceHttpsRedirectError,
  FrameGuardError,
  NoOpenError,
  NoSniffError,
  PermissionsPolicyError,
  PermittedCrossDomainPoliciesError,
  ReferrerPolicyError,
  XssProtectionError,
} from "@beep/schema/SecureHeaderError";
import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, identity } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  first: Schema["Type"],
  second: Schema["Type"],
  different: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

const capture = (evaluate: () => unknown): unknown =>
  Result.match(Result.try(evaluate), {
    onFailure: identity,
    onSuccess: identity,
  });

const makePrivateError = (schema: S.Top, fields: Readonly<Record<string, unknown>>): unknown => {
  const make = Reflect.get(schema, "make");
  expect(P.isFunction(make)).toBe(true);
  return P.isFunction(make) ? Reflect.apply(make, schema, [fields]) : fields;
};

describe("@beep/schema tagged-error declared equivalence", () => {
  it("compares CSV, LiteralKit, and MappedLiteralKit errors by declared fields", () => {
    expectDeclaredEquivalence(
      CsvError,
      CsvError.make({ message: "Invalid CSV", offset: 4 }),
      CsvError.make({ message: "Invalid CSV", offset: 4 }),
      CsvError.make({ message: "Invalid CSV", offset: 5 })
    );
    expectDeclaredEquivalence(
      LiteralNotInSetError,
      LiteralNotInSetError.make({ input: ["blocked"], literals: ["ready"] }),
      LiteralNotInSetError.make({ input: ["blocked"], literals: ["ready"] }),
      LiteralNotInSetError.make({ input: ["missing"], literals: ["ready"] })
    );
    expectDeclaredEquivalence(
      LiteralKitKeyCollisionError,
      LiteralKitKeyCollisionError.make({ existing: "one", incoming: 1, key: "number1" }),
      LiteralKitKeyCollisionError.make({ existing: "one", incoming: 1, key: "number1" }),
      LiteralKitKeyCollisionError.make({ existing: "one", incoming: 2, key: "number1" })
    );
    expectDeclaredEquivalence(
      LiteralKitEnumMappingDuplicateLiteralError,
      LiteralKitEnumMappingDuplicateLiteralError.make({ firstIndex: 0, literal: "ready", secondIndex: 2 }),
      LiteralKitEnumMappingDuplicateLiteralError.make({ firstIndex: 0, literal: "ready", secondIndex: 2 }),
      LiteralKitEnumMappingDuplicateLiteralError.make({ firstIndex: 0, literal: "ready", secondIndex: 3 })
    );
    expectDeclaredEquivalence(
      LiteralKitEnumMappingCoverageError,
      LiteralKitEnumMappingCoverageError.make({
        literals: ["read", "write"],
        mappingLiterals: ["read"],
        missing: ["write"],
        unexpected: [],
      }),
      LiteralKitEnumMappingCoverageError.make({
        literals: ["read", "write"],
        mappingLiterals: ["read"],
        missing: ["write"],
        unexpected: [],
      }),
      LiteralKitEnumMappingCoverageError.make({
        literals: ["read", "write"],
        mappingLiterals: ["read", "write"],
        missing: [],
        unexpected: [],
      })
    );
    expectDeclaredEquivalence(
      LiteralKitTaggedUnionLiteralError,
      LiteralKitTaggedUnionLiteralError.make({ literal: BigInt(1) }),
      LiteralKitTaggedUnionLiteralError.make({ literal: BigInt(1) }),
      LiteralKitTaggedUnionLiteralError.make({ literal: BigInt(2) })
    );
    expectDeclaredEquivalence(
      MappedLiteralDuplicateError,
      MappedLiteralDuplicateError.make({ firstIndex: 0, literal: "200", secondIndex: 1, side: "to" }),
      MappedLiteralDuplicateError.make({ firstIndex: 0, literal: "200", secondIndex: 1, side: "to" }),
      MappedLiteralDuplicateError.make({ firstIndex: 0, literal: "200", secondIndex: 2, side: "to" })
    );
  });

  it("excludes opaque causes from parser and blocked-host diagnostic identity", () => {
    expectDeclaredEquivalence(
      ParserOptionsError,
      ParserOptionsError.make({ cause: O.some({ side: "left" }), message: "Invalid delimiter" }),
      ParserOptionsError.make({ cause: O.some({ side: "right" }), message: "Invalid delimiter" }),
      ParserOptionsError.make({ cause: O.none(), message: "Invalid quote" })
    );
    expectDeclaredEquivalence(
      BlockedHostError,
      BlockedHostError.make({
        cause: O.some({ side: "left" }),
        host: "127.0.0.1",
        message: "Blocked host",
        url: O.none(),
      }),
      BlockedHostError.make({
        cause: O.some({ side: "right" }),
        host: "127.0.0.1",
        message: "Blocked host",
        url: O.none(),
      }),
      BlockedHostError.make({
        cause: O.none(),
        host: "169.254.169.254",
        message: "Blocked host",
        url: O.none(),
      })
    );
  });

  it("compares every secure-header error by message and ignores its opaque cause", () => {
    expectDeclaredEquivalence(
      CspError,
      CspError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      CspError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      CspError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      ForceHttpsRedirectError,
      ForceHttpsRedirectError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      ForceHttpsRedirectError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      ForceHttpsRedirectError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      XssProtectionError,
      XssProtectionError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      XssProtectionError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      XssProtectionError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      ReferrerPolicyError,
      ReferrerPolicyError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      ReferrerPolicyError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      ReferrerPolicyError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      NoSniffError,
      NoSniffError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      NoSniffError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      NoSniffError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      NoOpenError,
      NoOpenError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      NoOpenError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      NoOpenError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      FrameGuardError,
      FrameGuardError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      FrameGuardError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      FrameGuardError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      ExpectCtError,
      ExpectCtError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      ExpectCtError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      ExpectCtError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      PermissionsPolicyError,
      PermissionsPolicyError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      PermissionsPolicyError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      PermissionsPolicyError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      CrossOriginOpenerPolicyError,
      CrossOriginOpenerPolicyError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      CrossOriginOpenerPolicyError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      CrossOriginOpenerPolicyError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      CrossOriginEmbedderPolicyError,
      CrossOriginEmbedderPolicyError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      CrossOriginEmbedderPolicyError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      CrossOriginEmbedderPolicyError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      CrossOriginResourcePolicyError,
      CrossOriginResourcePolicyError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      CrossOriginResourcePolicyError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      CrossOriginResourcePolicyError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      PermittedCrossDomainPoliciesError,
      PermittedCrossDomainPoliciesError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      PermittedCrossDomainPoliciesError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      PermittedCrossDomainPoliciesError.make({ cause: O.none(), message: "different" })
    );
    expectDeclaredEquivalence(
      CoreError,
      CoreError.make({ cause: O.some({ side: "left" }), message: "invalid" }),
      CoreError.make({ cause: O.some({ side: "right" }), message: "invalid" }),
      CoreError.make({ cause: O.none(), message: "different" })
    );
  });

  it("compares the private withStatics invariant error by declared fields", () => {
    const trigger = (key: string, value: string): unknown => {
      const schema = S.Struct({});
      Reflect.defineProperty(schema, key, { configurable: false, value });
      return SchemaUtils.withStatics(() => ({ [key]: `${value}-different` }))(schema);
    };
    const first = capture(() => trigger("locked", "before"));
    const second = capture(() => trigger("locked", "before"));
    const different = capture(() => trigger("other", "before"));
    const schema = P.isObject(first) ? Reflect.get(first, "constructor") : first;

    expect(S.isSchema(schema)).toBe(true);
    if (S.isSchema(schema)) {
      const same = S.toEquivalence(schema);
      expect(same(first, second)).toBe(true);
      expect(same(first, different)).toBe(false);
    }
  });

  it.effect("compares the private unsupported-Float16 runtime error by declared message", () => {
    const descriptor = Reflect.getOwnPropertyDescriptor(globalThis, "Float16Array");
    const restore = Effect.sync(() => {
      if (P.isNotUndefined(descriptor)) {
        Reflect.defineProperty(globalThis, "Float16Array", descriptor);
      }
      vi.resetModules();
    });

    return Effect.gen(function* () {
      Reflect.deleteProperty(globalThis, "Float16Array");
      vi.resetModules();

      const { Float16Arr } = yield* Effect.promise(() => import("@beep/schema/Float16Array"));
      const arbitrary = S.toArbitrary(Float16Arr)(fc);
      const first = capture(() => fc.sample(arbitrary, 1));
      const second = capture(() => fc.sample(arbitrary, 1));
      const schema = P.isObject(first) ? Reflect.get(first, "constructor") : first;

      expect(S.isSchema(schema)).toBe(true);
      if (S.isSchema(schema)) {
        const different = makePrivateError(schema, {
          message: "Float16Array failed for a different diagnostic reason.",
        });
        const same = S.toEquivalence(schema);
        expect(same(first, second)).toBe(true);
        expect(same(first, different)).toBe(false);
      }
    }).pipe(Effect.ensuring(restore));
  });
});
