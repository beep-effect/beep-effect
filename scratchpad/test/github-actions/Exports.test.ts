import { assert, describe, it } from "@effect/vitest";
import * as ActionState from "../../effected/github-actions/ActionState.ts";
import * as CacheKey from "../../effected/github-actions/CacheKey.ts";
import * as CheckState from "../../effected/github-actions/CheckState.ts";
import * as DetachedProcess from "../../effected/github-actions/DetachedProcess.ts";
import {
	InvalidActionStateNameError,
	InvalidDigestLengthError,
	MissingProcessIdError,
	RejectedRegionDialectError,
	UnhandledCheckStateError,
} from "../../effected/github-actions/index.ts";
import * as ManagedDocument from "../../effected/github-actions/ManagedDocument.ts";

describe("github-actions entry-point exports", () => {
	it("exports the five existing tagged error classes", () => {
		assert.strictEqual(InvalidActionStateNameError, ActionState.InvalidActionStateNameError);
		assert.strictEqual(InvalidDigestLengthError, CacheKey.InvalidDigestLengthError);
		assert.strictEqual(UnhandledCheckStateError, CheckState.UnhandledCheckStateError);
		assert.strictEqual(MissingProcessIdError, DetachedProcess.MissingProcessIdError);
		assert.strictEqual(RejectedRegionDialectError, ManagedDocument.RejectedRegionDialectError);
	});
});
