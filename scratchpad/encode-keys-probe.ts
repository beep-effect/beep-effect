/**
 * Probe: what actually works with S.encodeKeys + Class factories today.
 *
 * Q1: does `S.Class` accept a Struct piped through `S.encodeKeys`? (user hoped yes)
 * Q2: does use-site `S.encodeKeys` on an effect-drizzle model's `json` variant static work?
 * Q3: what breaks when a fields record uses a quoted kebab key ("allowed-tools") instead?
 */
import * as EffectDrizzle from "@beep/effect-drizzle/pg";
import * as S from "effect/Schema";

// --- Q1: S.Class + encodeKeys-piped struct -------------------------------
const RenamedStruct = S.Struct({
  name: S.String,
  approvedSkills: S.String,
}).pipe(S.encodeKeys({ approvedSkills: "approved-skills" }));

// standalone decode works:
export const q1Standalone = S.decodeSync(RenamedStruct)({
  name: "x",
  "approved-skills": "Bash",
});

// @ts-expect-error decodeTo<...> does not satisfy `S extends Struct<Struct.Fields>`
export class Q1Class extends S.Class<Q1Class>("Q1Class")(RenamedStruct) {}

// --- Q2: use-site encodeKeys on a model's json variant static ------------
const kit = EffectDrizzle.make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    id: S.Int.pipe(pg.primaryKey(), pg.serial()),
  }),
});

export class Frontmatter extends kit.Entity<Frontmatter>("Frontmatter")({
  name: S.String.check(S.isMaxLength(64)).pipe(kit.pg.varchar()),
  approvedSkills: S.String.pipe(kit.pg.text(), kit.pg.columnName("approved_skills")),
}) {}

export const FrontmatterWire = Frontmatter.json.pipe(
  S.encodeKeys({ approvedSkills: "approved-skills" })
);

export const q2Decoded = S.decodeSync(FrontmatterWire)({
  id: 1,
  name: "doc-skill",
  "approved-skills": "Bash, Read",
});
