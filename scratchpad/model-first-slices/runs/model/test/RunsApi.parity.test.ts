import { expect, it } from "@effect/vitest";
import { RunsContract } from "@proto/runs-contract/RunsApi.contract";
import { RunsApi } from "@proto/runs-model/RunsApi.api";
import { groupShape } from "@proto/tooling/RpcParity";

it("the runs contract's RPC group equals the model Api's", () => {
  const expected = groupShape(RunsApi.group);
  expect(expected.length).toBeGreaterThan(2);
  expect(groupShape(RunsContract.group)).toEqual(expected);
});
