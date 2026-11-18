import { expect, it } from "@effect/vitest";
import { IdText } from "@proto/kernel/Measure";
import { FixtureContactSource } from "@proto/party-host/Evidence/FixtureContactSource.adapter";
import { ContactSource, SourceAssertion } from "@proto/party-model/Evidence/ContactSource.external";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

// The fixture mailbox stands where a vendor adapter would, so it answers the port's contract: under
// any mailbox the port accepts, every finding is a source assertion the port declares, and it
// survives the wire form unchanged.

const Findings = S.Array(SourceAssertion);

it.layer(FixtureContactSource)("the fixture mailbox", (it) => {
  it.effect.prop("its findings are source assertions under any mailbox", [IdText, S.Finite], ([mailbox, since]) =>
    Effect.gen(function* () {
      const source = yield* ContactSource;
      const { assertions } = yield* source.observe({ mailbox, since });
      expect(assertions).not.toHaveLength(0);
      const wire = yield* S.encodeEffect(Findings)(assertions);
      const back = yield* S.decodeEffect(Findings)(wire);
      expect(back).toEqual(assertions);
    }),
  );
});
