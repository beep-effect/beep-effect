import { describe, expect, it } from "@effect/vitest";
import { AgentContract } from "@proto/party-contract/AgentApi.contract";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import { AgentApi } from "@proto/party-model/AgentApi.api";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import { groupShape } from "@proto/tooling/RpcParity";

// The contract's groups are declared over aggregate-free declarations; the
// Apis over the real Model. Same tags, same encoded schemas, same middleware.
const pairs = [
  ["ReviewerApi", ReviewerApi.group, ReviewerContract.group],
  ["IntakeApi", IntakeApi.group, IntakeContract.group],
  ["AgentApi", AgentApi.group, AgentContract.group],
] as const;

describe("contract parity", () => {
  for (const [name, api, contract] of pairs) {
    it(`${name}: the contract's RPC group equals the model Api's`, () => {
      const expected = groupShape(api);
      expect(expected.length).toBeGreaterThan(0);
      expect(groupShape(contract)).toEqual(expected);
    });
  }
});
