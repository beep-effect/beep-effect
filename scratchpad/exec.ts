import * as S from "effect/Schema";
import {$ScratchpadId} from "@beep/identity";
import * as EffectDrizzle from "@beep/effect-drizzle/pg";
import {NonNegativeInt} from "@beep/schema";

const $I = $ScratchpadId.create("exec");

export const {Model, pg} = EffectDrizzle.make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    id: NonNegativeInt.pipe(
      pg.primaryKey()
    ),
  }),
});

export class YAMLFrontMatter extends Model<YAMLFrontMatter>($I`YAMLFrontMatter`)(
    {
    name: S.String.pipe(pg.varchar(64))
  },
  $I.annote("Skill", {description: ""})
) {
}
