import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as P from "@beep/utils/Predicate";
improt * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Context from "effect/Context";
import * as EffConfig from "effect/Config";
import {JsonObject} from "@beep/schema/Json"
import { CodexSecurity, DEFAULT_CODEX_CONFIG } from "@openai/codex-security"

const $I = $ScratchpadId.create("codex-security/internal/codexSecurity");


export class ConfigShape extends S.Class<ConfigShape>($I`ConfigShape`)(
  {
    pluginPath: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault, $I.annoteKey(
      "ConfigShape.pluginPath", {
        description: "Plugin directory or ZIP; defaults to the bundled plugin."
      }
    )),
    pythonPath: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault, $I.annoteKey("ConfigShape.pythonPath", {
      description: "Python interpreter; overrides PYTHON."
    })
    ),
    codexOverrides: JsonObject.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey(
        "ConfigShape.codexOverrides",
        {
          description: "Supported settings to deep-merge into the isolated Codex configuration."
        }
      )
    )

  },
  $I.annote("ConfigShape", {
    description: "",
    documentation: 'https://github.com/openai/codex-security/tree/1a3ca64333f894426dde0c0a7721d717c99f8cba/sdk/typescript#sdk-configuration-and-scan-options'
  })
)

class Config extends Context.Service<Config, ConfigShape>()($I`Config`) {

}
