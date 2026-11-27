import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

class DeployFailed extends S.TaggedError<DeployFailed, { readonly brand: unique symbol }>()("DeployFailed", {
  release: S.String,
}) {}
class ParseFailed extends S.TaggedError<ParseFailed, { readonly brand: unique symbol }>()("ParseFailed", {
  line: S.Finite,
  column: S.Finite,
}) {}

const plainErrorWithOwnLine = (line: number): Error => Object.assign(new Error("located failure"), { line });

const runtimeOwnsErrorLocation = Object.getOwnPropertyDescriptor(new Error("probe"), "line")?.enumerable === false;

const WithoutStackHook = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      const hook = Error.prepareStackTrace;
      Reflect.set(Error, "prepareStackTrace", undefined);
      return hook;
    }),
    (hook) => Effect.sync(() => Reflect.set(Error, "prepareStackTrace", hook))
  )
);

describe("Error equality compatibility", () => {
  it.layer(WithoutStackHook, { timeout: "5 seconds" })(
    "without a stack trace hook: JavaScriptCore resolves site keys to 0 under Vitest's hook, and production Bun has none",
    (it) => {
      it.effect("treats errors constructed at different sites as structurally equal", () =>
        Effect.sync(() => {
          const first = new Error("deploy failed");
          const second = new Error("deploy failed");

          assert.isTrue(Equal.equals(first, second));
          assert.strictEqual(Hash.hash(first), Hash.hash(second));
          assert.isFalse(Equal.equals(first, new Error("rollback failed")));
        })
      );

      it.effect(
        "keeps Schema tagged errors built through make equal without the patch, since make constructs them at one site",
        () =>
          Effect.sync(() => {
            const first = DeployFailed.make({ release: "v1" });
            const second = DeployFailed.make({ release: "v1" });

            assert.isTrue(Equal.equals(first, second));
            assert.strictEqual(Hash.hash(first), Hash.hash(second));
            assert.isFalse(Equal.equals(first, DeployFailed.make({ release: "v2" })));
          })
      );

      it.effect("keeps payload fields named like location metadata in equality", () =>
        Effect.sync(() => {
          const first = ParseFailed.make({ line: 3, column: 7 });

          assert.isTrue(Equal.equals(first, ParseFailed.make({ line: 3, column: 7 })));
          assert.isFalse(Equal.equals(first, ParseFailed.make({ line: 4, column: 7 })));
          assert.strictEqual(
            Equal.equals(plainErrorWithOwnLine(3), plainErrorWithOwnLine(4)),
            runtimeOwnsErrorLocation,
            "a plain Error's own line leaves equality only on JavaScriptCore, whose every Error has a non-enumerable own line the patch erases with the location (patch-proofs-record.md)"
          );
        })
      );
    }
  );
});
