import { InvalidActionStateNameError, InvalidDigestLengthError, MissingProcessIdError } from "@beep/github-actions";
import * as ActionState from "@beep/github-actions/ActionState";
import * as CacheKey from "@beep/github-actions/CacheKey";
import * as DetachedProcess from "@beep/github-actions/DetachedProcess";
import { assert, describe, it } from "@effect/vitest";

describe("github-actions entry-point exports", () => {
  it("exports the three existing tagged error classes", () => {
    assert.strictEqual(InvalidActionStateNameError, ActionState.InvalidActionStateNameError);
    assert.strictEqual(InvalidDigestLengthError, CacheKey.InvalidDigestLengthError);
    assert.strictEqual(MissingProcessIdError, DetachedProcess.MissingProcessIdError);
  });
});
