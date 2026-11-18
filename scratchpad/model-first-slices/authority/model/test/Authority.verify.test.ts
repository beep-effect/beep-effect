import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { AuthorityModel } from "@proto/authority-model/Authority.model";

it("the model is well defined", () => {
  expect(Domain.verify(AuthorityModel)).toEqual([]);
});
