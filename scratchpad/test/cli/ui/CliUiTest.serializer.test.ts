// Snapshots are the one place a test here uses `expect`: `assert` has no snapshot form. The serializer is registered
// through the Vitest config (`snapshotSerializers`, the root vitest.config.ts's @effected/cli project), by the module
// `@effected/cli/ui/testing/serializer` default-exports, never with `expect.addSnapshotSerializer`.
import { assert, describe, it } from "@effect/vitest";
import { expect } from "vitest";
import { Doc, Render, Status } from "../../../effected/cli/index.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import serializer from "../../../effected/cli/ui-testing-serializer.ts";

const ESC = String.fromCharCode(0x1b);
const painted = Render.ansi(
	[Doc.paragraph(Doc.status(Status.core, "success"), " ", "3 checks passed")],
	Render.contextOf({ audience: "human", color: "truecolor" }),
);

describe("@effected/cli/ui/testing/serializer", () => {
	it("default-exports CliUiTest.serializer itself", () => {
		assert.strictEqual(serializer, CliUiTest.serializer);
	});

	it("is registered through the config: an escape-laden string snapshots as token markup", () => {
		assert.include(painted, ESC, "control: the value carries escapes, so only the serializer can print it this way");
		expect(painted).toMatchInlineSnapshot(`[fg:green]✓[/fg] 3 checks passed`);
	});

	it("leaves a plain string to Vitest's own printer", () => {
		expect("no markup here").toMatchInlineSnapshot(`"no markup here"`);
	});
});
