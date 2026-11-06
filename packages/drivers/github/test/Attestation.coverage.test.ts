import { Attestation, AttestationRecord } from "@beep/github/Attestation";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import { harness } from "./support/harness.ts";

it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
  it.effect("both unstubbed operations name themselves", () =>
    Effect.sync(() => {
      const service = Attestation.makeTest();
      assert.throws(() => service.upload({}), /Attestation.makeTest: upload/);
      assert.throws(() => service.listForSubject("abc"), /Attestation.makeTest: listForSubject/);
    })
  );
  it.layer(Attestation.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("default layer retains fail-loud behavior", () =>
      Effect.gen(function* () {
        assert.throws(() => Attestation.makeTest().upload({}), /upload/);
        const service = yield* Attestation;
        assert.throws(() => service.listForSubject("abc"), /listForSubject/);
      })
    );
  });
  it.layer(
    Attestation.layerTest({
      upload: () => Effect.succeed(AttestationRecord.make({ url: "stub" })),
      listForSubject: dual(
        (args) => P.isString(args[0]),
        (_sha256: string, _options?: object) => Effect.succeed([])
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("overrides survive layer construction", () =>
      Effect.gen(function* () {
        const service = yield* Attestation;
        assert.strictEqual((yield* service.upload({})).url, "stub");
        const listForSubject1 = yield* service.listForSubject("abc");
        assert.deepStrictEqual(listForSubject1, []);
      })
    );
  });
});
const { base, script } = harness([
  { status: 201, body: {} },
  { status: 200, body: {} },
  { status: 200, body: { attestations: [{ id: 9 }, {}, { bundle_url: "", predicate_type: "p" }] } },
  { status: 403, body: { message: "Forbidden" } },
]);
it.layer(Attestation.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
  it.effect("handles absent IDs and lists, falls back to ID URLs, omits unusable entries and propagates errors", () =>
    Effect.gen(function* () {
      const service = yield* Attestation;
      const uploaded = yield* service.upload({ payload: "signed" });
      assert.strictEqual(uploaded.id, undefined);
      assert.strictEqual(uploaded.url, "https://github.com/acme/widget/attestations/");
      const listForSubject2 = yield* service.listForSubject("abc", {});
      assert.deepStrictEqual(listForSubject2, []);
      const entries = yield* service.listForSubject("sha256:abc", { predicateType: "p" });
      assert.deepStrictEqual(
        A.map(entries, (entry) => ({ url: entry.url, predicateType: entry.predicateType })),
        [
          { url: "https://github.com/acme/widget/attestations/9", predicateType: undefined },
          { url: "", predicateType: "p" },
        ]
      );
      assert.strictEqual(script.queryOf(2).get("predicate_type"), "p");
      const error = yield* Effect.flip(service.listForSubject("abc"));
      assert.strictEqual(error.status, 403);
    })
  );
});
