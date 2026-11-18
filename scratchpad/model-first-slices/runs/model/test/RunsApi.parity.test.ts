import { expect, it } from "@effect/vitest";
import { RunsContract } from "@proto/runs-contract/RunsApi.contract";
import { RunsApi } from "@proto/runs-model/RunsApi.api";
import { RunState } from "@proto/runs-model/Run/RunState.query";
import { groupShape } from "@proto/tooling/RpcParity";
import * as A from "@beep/utils/Array";

it("the runs contract's RPC group equals the model Api's", () => {
  const expected = groupShape(RunsApi.group);
  expect(expected.length).toBeGreaterThan(2);
  // The comparison reaches the query: the contract's `RunState` is the model's on the wire.
  expect(A.map(expected, (shape) => shape.tag)).toContain(RunState.queryName);
  expect(groupShape(RunsContract.group)).toEqual(expected);
});
