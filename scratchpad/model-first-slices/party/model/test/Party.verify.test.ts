import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { PartyModel } from "@proto/party/Party.model";

it("the model is well defined", () => {
  expect(Domain.verify(PartyModel)).toEqual([]);
});
