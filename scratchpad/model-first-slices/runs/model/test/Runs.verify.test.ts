import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { RunsModel } from "@proto/runs-model/Runs.model";

it("the model is well defined", () => {
  expect(Domain.verify(RunsModel)).toEqual([]);
});
