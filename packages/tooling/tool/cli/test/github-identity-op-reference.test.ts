import { GithubPrivateKeyRef, GithubTokenRef, selectGithubIdentity } from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// 1Password secret reference syntax (developer.1password.com/docs/cli/secret-reference-syntax):
// op://vault/item/[section/]field, each part a name of letters, digits, `-`, `_`, `.` and spaces,
// or the part's ID. The 2026-11-13 dankserver acceptance run failed every Yeet GitHub call because
// the host's `gh` wrapper names its item with spaces.
const isTokenRef = S.is(GithubTokenRef);
const isKeyRef = S.is(GithubPrivateKeyRef);

const accepted = [
  "op://vault/ item/field",
  "op://vault/item /field",
  "op://vault/item/field ",
  "OP://vault/item/field",
  "op://vault/item/token",
  "op://Private/GitHub CLI token/credential",
  "op://BEEP_SECRETS/beep-reviewer GitHub App/private_key",
  "op://Dank Server/gh  wrapper/token",
  "op://vault/item/Access Keys/access_key_id",
  "op://vault/item/section-1/field.name",
  "op://abcdefghijklmnopqrstuvwxyz/0123456789abcdefghijklmn/credential",
  "op://vault/ssh key/private key?ssh-format=openssh",
  "op://vault/totp/one-time password?attribute=otp",
  "op://vault/item/field?attr=type",
];

const refused = [
  "op://vault/Key/field",
  "op://vault/ſecret/field",
  "op://vault/item/field\n",
  "ghp_raw",
  "op://",
  "op://vault",
  "op://vault/item",
  "op://vault/item/section/sub/field",
  "op://vault//field",
  "op://vault/it\tem/field",
  "op://vault/item/fi\neld",
  "op://vault/it'em/field",
  'op://vault/it"em/field',
  "op://vault/item(1)/field",
  "op://vault/item/field#2",
  "op://$APP_ENV/item/field",
  "op://vault/item/field?attribute=password",
  "op://vault/item/field?ssh-format=pem",
  "op://vault/item/field?",
];

const selected = (tokenRef: string) =>
  selectGithubIdentity(O.none()).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_GH_TOKEN_REF: tokenRef }))
  );

describe("1Password references for GitHub identities", () => {
  it("accepts names with spaces, IDs, section paths and the documented query parameters", () => {
    expect(A.filter(accepted, (reference) => !isTokenRef(reference))).toEqual([]);
    expect(A.filter(accepted, (reference) => !isKeyRef(reference))).toEqual([]);
  });

  it("refuses raw secrets, wrong part counts and characters that need the ID form", () => {
    expect(A.filter(refused, isTokenRef)).toEqual([]);
    expect(A.filter(refused, isKeyRef)).toEqual([]);
  });

  it.effect("selects an op-ref identity for a reference whose item name has spaces", () =>
    Effect.gen(function* () {
      const identity = yield* selected("op://Dank Server/GitHub CLI token/credential");
      expect(identity.kind).toBe("op-ref");
      expect(O.getOrUndefined(identity.tokenRef)).toBe("op://Dank Server/GitHub CLI token/credential");
      const refusal = yield* Effect.flip(selected("op://vault/item(1)/field"));
      expect(refusal.reason).toBe("op-read-failed");
      expect(refusal.message).not.toContain("item(1)");
    })
  );
});
