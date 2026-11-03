import { PracticeCapability, PracticeProvider } from "@beep/law-practice-domain";
import { skillBody } from "@beep/practice-gateway/OnboardingSkill";
import { ONBOARDING_SKILL_BODY } from "@beep/practice-gateway/OnboardingSkill.generated";
import { SetupToolkit } from "@beep/practice-gateway/SetupTools";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Yaml from "effect/encoding/Yaml";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const skillUrl = new URL("../plugin/skills/practice-onboarding/SKILL.md", import.meta.url);
const pluginUrl = new URL("../plugin/.claude-plugin/plugin.json", import.meta.url);

// Agent Skills frontmatter (agentskills.io) as the AGENTS.md law admits it.
const SkillFrontmatter = S.Struct({
  name: S.String.check(S.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/), S.isMaxLength(64)),
  description: S.String.check(S.isMinLength(1), S.isMaxLength(1024)),
  license: S.String,
  compatibility: S.String.check(S.isMaxLength(500)),
  metadata: S.Record(S.String, S.String),
});

const PluginManifest = S.Struct({ name: S.String, version: S.String });

const PluginManifestJson = S.fromJsonString(PluginManifest);

const readText = (url: URL) => Effect.promise(() => Bun.file(url).text());

const splitSkill = (text: string) => {
  const [, frontmatter = "", body = ""] = Str.split(text, "---\n");
  return { frontmatter: Yaml.parse(frontmatter), body };
};

const backticked = (body: string) =>
  pipe(
    A.fromIterable(Str.matchAll(/`([a-z0-9_-]+)`/g)(body)),
    A.map((match) => O.getOrElse(O.fromUndefinedOr(match[1]), () => "")),
    A.dedupe
  );

describe("practice-onboarding skill", () => {
  it.effect("has spec-conformant frontmatter matching its folder and plugin", () =>
    Effect.gen(function* () {
      const readText1 = yield* readText(skillUrl);
      const { frontmatter } = splitSkill(readText1);
      const skill = yield* S.decodeUnknownEffect(SkillFrontmatter)(frontmatter, { onExcessProperty: "error" });
      const argument = S.decodeEffect(PluginManifestJson);
      const readText5 = yield* readText(pluginUrl);
      const plugin = yield* argument(readText5);
      expect(skill.name).toBe("practice-onboarding");
      assertSome(R.get(skill.metadata, "version"), plugin.version);
    })
  );

  it.effect("stays under the 500-line skill budget", () =>
    Effect.gen(function* () {
      const readText2 = yield* readText(skillUrl);
      const lines = A.length(Str.split(readText2, "\n"));
      expect(lines).toBeLessThan(500);
    })
  );

  it.effect("names exactly the gateway's setup tools", () =>
    Effect.gen(function* () {
      const readText3 = yield* readText(skillUrl);
      const { body } = splitSkill(readText3);
      const named = A.filter(backticked(body), Str.startsWith("setup_"));
      expect(A.sort(named, Str.Order)).toEqual(A.sort(R.keys(SetupToolkit.tools), Str.Order));
    })
  );

  it.effect("lists every profile capability and provider literal", () =>
    Effect.gen(function* () {
      const readText4 = yield* readText(skillUrl);
      const words = backticked(splitSkill(readText4).body);
      expect(A.every(PracticeCapability.literals, (literal) => A.contains(words, literal))).toBe(true);
      expect(A.every(PracticeProvider.literals, (literal) => A.contains(words, literal))).toBe(true);
    })
  );

  it.effect("serves the same text the skill ships (run `bun run sync:onboarding-skill` after editing SKILL.md)", () =>
    Effect.gen(function* () {
      const expectation = expect(ONBOARDING_SKILL_BODY);
      const readText6 = yield* readText(skillUrl);
      expectation.toBe(skillBody(readText6));
    })
  );
});
