import { expect, it } from "@effect/vitest";
import { PartyDeployment } from "@proto/party-host/Party.descriptor";
import { checkFactRetirement, UnpublishedFact } from "@proto/tooling/FactRetirement";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { PracticeDeployment } from "../src/Deployment.ts";

const fact = (version: number) => ({ producer: "party", contract: "ClaimDecided", version });

it.effect("the composed deployment publishes every fact version it consumes; the newest, unconsumed, is not retirable", () =>
  Effect.gen(function* () {
    expect(A.map(PracticeDeployment, (d) => d.context)).toEqual(["authority", "party", "runs"]);
    // Version 2 has no consumer yet, but it is Party's newest: being introduced, not retired (D40).
    const retirable = yield* checkFactRetirement(PracticeDeployment);
    expect(retirable).toEqual([]);
  }),
);

it.effect("a producer that stops publishing a version some descriptor consumes fails the check", () =>
  Effect.gen(function* () {
    const withoutV1 = A.map(PracticeDeployment, (d) =>
      d.context === "party" ? { ...PartyDeployment, publishes: [fact(2)] } : d,
    );
    const unpublished = yield* Effect.flip(checkFactRetirement(withoutV1));
    expect(unpublished).toEqual(UnpublishedFact.make({ missing: [{ consumer: "runs", fact: fact(1) }] }));
    // Without the producer composed at all, the consumer's need is still caught.
    const withoutParty = A.filter(PracticeDeployment, (d) => d.context !== "party");
    const unproduced = yield* Effect.flip(checkFactRetirement(withoutParty));
    expect(unproduced).toMatchObject({ missing: [{ consumer: "runs", fact: fact(1) }] });
  }),
);

it.effect("once no descriptor consumes version 1, the producer may retire it; never the newest", () =>
  Effect.gen(function* () {
    const runsOnV2 = A.map(PracticeDeployment, (d) =>
      d.context === "runs" ? { ...d, consumes: [fact(2)] } : d,
    );
    const onV2 = yield* checkFactRetirement(runsOnV2);
    expect(onV2).toEqual([{ publisher: "party", fact: fact(1) }]);
    const nobodyConsumes = A.map(PracticeDeployment, (d) => (d.context === "runs" ? { ...d, consumes: [] } : d));
    const unconsumed = yield* checkFactRetirement(nobodyConsumes);
    expect(unconsumed).toEqual([{ publisher: "party", fact: fact(1) }]);
  }),
);
