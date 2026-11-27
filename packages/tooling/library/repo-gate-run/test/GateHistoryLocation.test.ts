// Ported from vitest-agent 1cf1ab94 packages/sdk/src/utils/canonicalize-git-url.ts (MIT).
import {
  canonicalGitUrl,
  repositoryKeyFromCommonDir,
  repositoryKeyFromOrigin,
  STORE_DIRECTORY,
  storeFileName,
} from "@beep/repo-gate-run/GateHistoryLocation";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("repository key", () => {
  it.each([
    ["git@github.com:Acme/App.git", "github.com__acme__app"],
    ["https://token@github.com/acme/app.git", "github.com__acme__app"],
    ["git+ssh://git@github.com/acme/app", "github.com__acme__app"],
    ["https://github.com/acme/app/", "github.com__acme__app"],
    ["  http://gitlab.example.com/group/sub/repo.git  ", "gitlab.example.com__group__sub__repo"],
    ["ssh://git@host.example/a/b", "host.example__a__b"],
    ["https://gitlab.example.com/group__sub/repo.git", "gitlab.example.com__group_u_usub__repo"],
    ["https://gitlab.example.com/group/sub__repo.git", "gitlab.example.com__group__sub_u_urepo"],
  ])("keys %s as %s", (url, key) => {
    assert.strictEqual(O.getOrNull(repositoryKeyFromOrigin(url)), key);
  });

  it("names no key for a URL without a host and path", () => {
    assertNone(canonicalGitUrl(""));
    assertNone(canonicalGitUrl("github.com"));
    assertNone(canonicalGitUrl("https://github.com/"));
    assertNone(canonicalGitUrl("/acme/app"));
  });

  it.layer(Digest.layerWebCrypto)("without an origin", (it) => {
    it.effect("keys the repository by a digest of its git common directory", () =>
      Effect.gen(function* () {
        const key = yield* repositoryKeyFromCommonDir("/home/alice/code/app/.git");
        const other = yield* repositoryKeyFromCommonDir("/home/alice/code/other/.git");
        assert.match(key, /^local__[0-9a-f]{16}$/u);
        assert.notStrictEqual(key, other);
        const again = yield* repositoryKeyFromCommonDir("/home/alice/code/app/.git");
        assert.strictEqual(again, key);
      })
    );
  });

  it("names the store file under the gate-history directory", () => {
    assert.strictEqual(
      `${STORE_DIRECTORY}/${storeFileName("github.com__acme__app")}`,
      "gate-history/github.com__acme__app.sqlite"
    );
  });
});
