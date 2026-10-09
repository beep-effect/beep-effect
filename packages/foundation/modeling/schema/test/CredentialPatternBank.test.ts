import * as Bank from "@beep/schema/CredentialPatternBank";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const secret = () => A.join(["canary", "Alpha", "4927", "Beta"], "");
const encodeMatches = S.encodeEffect(S.fromJsonString(S.Array(Bank.CredentialMatch)));

describe("canonical credential bank", () => {
  it("has one versioned rule for each supported category", () => {
    expect(Bank.credentialPatternBankVersion).toBe("credential-pattern-bank/v1");
    expect(A.length(Bank.credentialRules)).toBe(A.length(Bank.CredentialCategory.literals));
    expect(
      A.every(
        Bank.CredentialCategory.literals,
        (category) => A.length(A.filter(Bank.credentialRules, (rule) => rule.category === category)) === 1
      )
    ).toBe(true);
    expect(A.every(Bank.credentialRules, S.is(Bank.CredentialRule))).toBe(true);
    expect(Bank.replaceCredentialAssignmentsOutsideHeaders("public text", "$1=[REDACTED]")).toBe("public text");
  });
  it.effect("covers the assignment union with longest comma extent and original offsets", () =>
    Effect.gen(function* () {
      for (const name of ["API_KEY", "TOKEN", "2-session-id", "passwd", "pass", "APP_TOKEN"]) {
        for (const separator of ["=", " : "]) {
          const prefix = `${name}${separator}`;
          const input = `${prefix}${secret()},suffix`;
          const matches = Bank.detectCredentials(input);
          expect(Bank.maskCredentialMatches(input, matches) === `${prefix}[REDACTED]`).toBe(true);
          expect(
            A.every(matches, (match) => match.start === Str.length(prefix) && match.end === Str.length(input))
          ).toBe(true);
          expect(Str.includes(secret())(yield* encodeMatches(matches))).toBe(false);
          expect(Bank.countCredentialCategory("secret-assignment")(input)).toBe(1);
          expect(
            Bank.replaceCredentialCategory("secret-assignment", "$1=[REDACTED]")(input) === `${name}=[REDACTED]`
          ).toBe(true);
        }
      }
    })
  );
  it("supports both header banks and merges overlap extents", () => {
    for (const header of ["Authorization", "Proxy-Authorization", "Cookie", "Set-Cookie"]) {
      const input = `${header}: Bearer ${secret()}`;
      const matches = Bank.detectCredentials(input);
      expect(Bank.replaceCredentialAssignmentsOutsideHeaders("$1=[REDACTED]")(input) === input).toBe(true);
      expect(Bank.countCredentialCategory(input, "auth-header")).toBe(1);
      expect(Bank.maskCredentialMatches(matches)(input) === `${header}: [REDACTED]`).toBe(true);
      expect(Bank.replaceCredentialCategory(input, "auth-header", "$1: [REDACTED]") === `${header}: [REDACTED]`).toBe(
        true
      );
    }
  });
  it("handles nested, unclosed and orphan private delimiters fail closed", () => {
    const nested = `<private>outer<private>${secret()}</private>end</private>`;
    expect(Bank.maskCredentialMatches(nested, Bank.detectCredentials(nested)) === "[REDACTED]").toBe(true);
    expect(Bank.countCredentialCategory(nested, "private-tag")).toBe(1);
    expect(Bank.replaceCredentialCategory(nested, "private-tag", "[REDACTED]") === "[REDACTED]").toBe(true);
    for (const input of [`<PRIVATE>${secret()}`, `${secret()}</private>`]) {
      const matches = Bank.detectCredentials(input);
      expect(A.some(matches, (match) => match.state === "unresolved")).toBe(true);
      expect(Bank.maskCredentialMatches(input, matches) === "[REDACTED]").toBe(true);
    }
  });
  it("distinguishes markers, partial forms and public near misses", () => {
    expect(A.isReadonlyArrayEmpty(Bank.detectCredentials("TOKEN=[REDACTED]"))).toBe(true);
    expect(A.isReadonlyArrayEmpty(Bank.detectCredentials("keyboards and token vocabulary"))).toBe(true);
    const partial = A.join(["s", "k", "-", "short"], "");
    expect(A.some(Bank.detectCredentials(partial), (match) => match.state === "residue")).toBe(true);
    expect(A.isReadonlyArrayEmpty(Bank.detectCredentials("public text"))).toBe(true);
    const unfinished = `${A.join(["API", "_KEY"], "")}="${secret()} public tail`;
    expect(Bank.maskCredentialCategory(unfinished, "secret-assignment") === "API_KEY=[REDACTED] public tail").toBe(
      true
    );
    expect(Bank.maskCredentialMatches(unfinished, Bank.detectCredentials(unfinished)) === "[REDACTED]").toBe(true);
  });
});
