import { assert, describe, it } from "@effect/vitest";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import { AudienceFlagInput, CliAudienceFlagsOptions } from "../../effected/cli/CliAudience.ts";
import { CliEnvTestOptions } from "../../effected/cli/CliEnv.ts";
import { CliMessageOptions } from "../../effected/cli/CliMessage.ts";
import { CliThemeOptions, CliThemeTestOptions } from "../../effected/cli/CliTheme.ts";
import { AudienceFlagValues, AudienceTally, scanAudience, tallyAudience } from "../../effected/cli/internal/scanAudience.ts";

const roundTrips = <A, I>(schema: S.Codec<A, I>, value: unknown) => {
	const decoded = S.decodeUnknownExit(schema)(value);
	assert.deepStrictEqual(Exit.isSuccess(decoded) ? decoded.value : decoded, value);
	assert.isTrue(S.is(schema)(value));
};

const rejects = <A, I>(schema: S.Codec<A, I>, value: unknown) => {
	assert.isTrue(Exit.isFailure(S.decodeUnknownExit(schema)(value)));
	assert.isFalse(S.is(schema)(value));
};

describe("audience flag schemas", () => {
	it("AudienceFlagValues and AudienceFlagInput own the four flag arrays", () => {
		const flags = { audience: ["agent", "ci"], human: [false, true], agent: [], ci: [true] };
		roundTrips(AudienceFlagValues, flags);
		roundTrips(AudienceFlagInput, flags);
		rejects(AudienceFlagValues, { audience: ["robot"], human: [], agent: [], ci: [] });
		rejects(AudienceFlagInput, { audience: [], human: ["yes"], agent: [], ci: [] });
		rejects(AudienceFlagInput, { audience: [], human: [], agent: [] });
	});

	it("AudienceTally describes the plain result of the tally and the argv scan", () => {
		const parsed = tallyAudience({ audience: ["ci"], human: [false], agent: [true], ci: [] });
		assert.deepStrictEqual(parsed, { given: ["ci", "agent"], conflict: true });
		roundTrips(AudienceTally, parsed);
		roundTrips(AudienceTally, scanAudience(["--human", "--", "--ci"]));
		rejects(AudienceTally, { given: ["human"] });
		rejects(AudienceTally, { given: ["nobody"], conflict: false });
	});

	it("CliAudienceFlagsOptions keeps hidden optional and accepts explicit undefined", () => {
		roundTrips(CliAudienceFlagsOptions, {});
		roundTrips(CliAudienceFlagsOptions, { hidden: true });
		roundTrips(CliAudienceFlagsOptions, { hidden: undefined });
		rejects(CliAudienceFlagsOptions, { hidden: "yes" });
	});
});

describe("theme, env and message option schemas", () => {
	it("CliThemeOptions accepts partial token overrides and the three glyph choices", () => {
		roundTrips(CliThemeOptions, {});
		roundTrips(CliThemeOptions, { tokens: undefined, glyphs: undefined });
		roundTrips(CliThemeOptions, { tokens: { accent: { fg: "red", bold: true } }, glyphs: "auto" });
		roundTrips(CliThemeOptions, { tokens: {}, glyphs: "ascii" });
		rejects(CliThemeOptions, { glyphs: "emoji" });
		rejects(CliThemeOptions, { tokens: { accent: { bold: "yes" } } });
		rejects(CliThemeOptions, { tokens: { accent: undefined } });
	});

	it("CliThemeTestOptions accepts colour levels and the two fixed glyph sets", () => {
		roundTrips(CliThemeTestOptions, {});
		roundTrips(CliThemeTestOptions, { color: "truecolor", stderrColor: "basic", glyphs: "unicode" });
		roundTrips(CliThemeTestOptions, { color: undefined, stderrColor: undefined, glyphs: undefined });
		rejects(CliThemeTestOptions, { glyphs: "auto" });
		rejects(CliThemeTestOptions, { color: "neon" });
	});

	it("CliEnvTestOptions composes the audience, colour and theme schemas", () => {
		roundTrips(CliEnvTestOptions, {});
		roundTrips(CliEnvTestOptions, {
			tty: true,
			term: "dumb",
			audience: "ci",
			columns: 120,
			color: "256",
			theme: { glyphs: "auto" },
		});
		roundTrips(CliEnvTestOptions, { tty: undefined, term: undefined, audience: undefined, columns: undefined, color: undefined, theme: undefined });
		rejects(CliEnvTestOptions, { audience: "robot" });
		rejects(CliEnvTestOptions, { theme: { glyphs: "emoji" } });
		rejects(CliEnvTestOptions, { columns: "80" });
	});

	it("CliMessageOptions accepts only the two stream names", () => {
		roundTrips(CliMessageOptions, {});
		roundTrips(CliMessageOptions, { stream: "stderr" });
		roundTrips(CliMessageOptions, { stream: undefined });
		rejects(CliMessageOptions, { stream: "stdin" });
	});
});
