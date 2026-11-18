import { expect, it } from "@effect/vitest";
import { AuthorityContract } from "@proto/authority-contract/AuthorityApi.contract";
import { AuthorityApi } from "@proto/authority-model/AuthorityApi.api";
import { groupShape } from "@proto/tooling/RpcParity";

it("the authority contract's RPC group equals the model Api's", () => {
  const expected = groupShape(AuthorityApi.group);
  expect(expected.length).toBe(8);
  expect(groupShape(AuthorityContract.group)).toEqual(expected);
});
