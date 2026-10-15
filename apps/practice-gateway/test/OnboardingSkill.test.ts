import { PracticeCapability, PracticeProvider } from "@beep/law-practice-domain";
import { skillBody } from "@beep/practice-gateway/OnboardingSkill";
import { ONBOARDING_SKILL_BODY } from "@beep/practice-gateway/OnboardingSkill.generated";
import { SetupToolkit } from "@beep/practice-gateway/SetupTools";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
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

const readText = (url: URL) => Effect.promise(() => Bun.file(url).text());

const splitSkill = (text: string) => {
  const [, frontmatter = "", body = ""] = Str.split(text, "---\n");
  return { frontmatter: Bun.YAML.parse(frontmatter), body };
};

const backticked = (body: string) =>
  pipe(
    A.fromIterable(body.matchAll(/`([a-z0-9_-]+)`/g)),
    A.map((match) => O.getOrElse(O.fromUndefinedOr(match[1]), () => "")),
    A.dedupe
  );

describe("practice-onboarding skill", () => {
  it.effect("has spec-conformant frontmatter matching its folder and plugin", () =>
    Effect.gen(function* () {
      const { frontmatter } = splitSkill(yield* readText(skillUrl));
      const skill = yield* S.decodeUnknownEffect(SkillFrontmatter)(frontmatter, { onExcessProperty: "error" });
      const plugin = yield* S.decodeEffect(S.fromJsonString(PluginManifest))(yield* readText(pluginUrl));
      expect(skill.name).toBe("practice-onboarding");
      assertSome(R.get(skill.metadata, "version"), plugin.version);
    })
  );

  it.effect("stays under the 500-line skill budget", () =>
    Effect.gen(function* () {
      const lines = A.length(Str.split(yield* readText(skillUrl), "\n"));
      expect(lines).toBeLessThan(500);
    })
  );

  it.effect("names exactly the gateway's setup tools", () =>
    Effect.gen(function* () {
      const { body } = splitSkill(yield* readText(skillUrl));
      const named = A.filter(backticked(body), Str.startsWith("setup_"));
      expect(A.sort(named, Str.Order)).toEqual(A.sort(R.keys(SetupToolkit.tools), Str.Order));
    })
  );

  it.effect("lists every profile capability and provider literal", () =>
    Effect.gen(function* () {
      const words = backticked(splitSkill(yield* readText(skillUrl)).body);
      expect(A.every(PracticeCapability.literals, (literal) => A.contains(words, literal))).toBe(true);
      expect(A.every(PracticeProvider.literals, (literal) => A.contains(words, literal))).toBe(true);
    })
  );

  it.effect("serves the same text the skill ships (run `bun run sync:onboarding-skill` after editing SKILL.md)", () =>
    Effect.gen(function* () {
      expect(ONBOARDING_SKILL_BODY).toBe(skillBody(yield* readText(skillUrl)));
    })
  );
});
