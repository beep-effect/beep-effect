import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Attestation, AttestationRecord } from "../../effected/github/Attestation.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { harness } from "./harness.ts";

it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
  it.effect("both unstubbed operations name themselves", () => Effect.sync(() => {
    const service = Attestation.makeTest();
    assert.throws(() => service.upload({}), /Attestation.makeTest: upload/);
    assert.throws(() => service.listForSubject("abc"), /Attestation.makeTest: listForSubject/);
  }));
  it.layer(Attestation.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("default layer retains fail-loud behavior", () => Effect.gen(function* () {
      assert.throws(() => (Attestation.makeTest()).upload({}), /upload/);
      const service = yield* Attestation;
      assert.throws(() => service.listForSubject("abc"), /listForSubject/);
    }));
  });
  it.layer(Attestation.layerTest({ upload: () => Effect.succeed(AttestationRecord.make({ url: "stub" })), listForSubject: () => Effect.succeed([]) }), { timeout: "30 seconds" })((it) => {
    it.effect("overrides survive layer construction", () => Effect.gen(function* () {
      const service = yield* Attestation;
      assert.strictEqual((yield* service.upload({})).url, "stub");
      assert.deepStrictEqual(yield* service.listForSubject("abc"), []);
    }));
  });
});
const { base, script } = harness([
  { status: 201, body: {} },
  { status: 200, body: {} },
  { status: 200, body: { attestations: [{ id: 9 }, {}, { bundle_url: "", predicate_type: "p" }] } },
  { status: 403, body: { message: "Forbidden" } },
]);
it.layer(Attestation.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
  it.effect("handles absent IDs and lists, falls back to ID URLs, omits unusable entries and propagates errors", () => Effect.gen(function* () {
    const service = yield* Attestation;
    const uploaded = yield* service.upload({ payload: "signed" });
    assert.strictEqual(uploaded.id, undefined);
    assert.strictEqual(uploaded.url, "https://github.com/acme/widget/attestations/");
    assert.deepStrictEqual(yield* service.listForSubject("abc", {}), []);
    const entries = yield* service.listForSubject("sha256:abc", { predicateType: "p" });
    assert.deepStrictEqual(entries.map((entry) => ({ url: entry.url, predicateType: entry.predicateType })), [{ url: "https://github.com/acme/widget/attestations/9", predicateType: undefined }, { url: "", predicateType: "p" }]);
    assert.strictEqual(script.queryOf(2).get("predicate_type"), "p");
    const error = yield* Effect.flip(service.listForSubject("abc"));
    assert.strictEqual(error.status, 403);
  }));
});
