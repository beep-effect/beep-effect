// The generic tsconfig JSX-runtime vocabulary: a pure projection from decoded
// compiler options to the two JSX transform modes a bundler can actually
// configure. `"react-jsx"` / `"react-jsxdev"` select the automatic runtime
// (with `jsxImportSource` defaulting to `"react"` exactly as tsc does);
// `"react"` selects the classic runtime (the factory options, `jsxFactory` /
// `jsxFragmentFactory`, stay on `CompilerOptions` — classic consumers read
// them there). `"preserve"` and `"react-native"` leave JSX untransformed, so
// they project to `Option.none()` alongside an absent `jsx`.

import { $ScratchpadId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { CompilerOptions } from "./CompilerOptions.ts";

const $I = $ScratchpadId.create("effected/tsconfig-json/JsxConfig");

/**
 * The JSX transform configuration a `jsx` compiler option implies: which
 * runtime (`"automatic"` for `react-jsx` / `react-jsxdev`, `"classic"` for
 * `react`) and, for the automatic runtime, the import source the transform
 * emits (`jsxImportSource`, defaulting to `"react"` per tsc).
 *
 * @public
 */
export class JsxConfig extends S.Class<JsxConfig>($I`JsxConfig`)({
	/** The JSX transform runtime: `"automatic"` (`react-jsx` / `react-jsxdev`) or `"classic"` (`react`). */
	runtime: S.Literals(["automatic", "classic"]).annotateKey({ description: "The JSX transform runtime: `\"automatic\"` (`react-jsx` / `react-jsxdev`) or `\"classic\"` (`react`)." }),
	/** The automatic runtime's import source (`jsxImportSource`, defaulted to `"react"`); absent for classic. */
	importSource: S.optionalKey(S.String).annotateKey({ description: "The automatic runtime's import source (`jsxImportSource`, defaulted to `\"react\"`); absent for classic." }),
}, $I.annote("JsxConfig", { description: "The JSX transform configuration a `jsx` compiler option implies: which runtime (`\"automatic\"` for `react-jsx` / `react-jsxdev`, `\"classic\"` for `react`) and, for the automatic runtime, the import source the transform emits (`jsxImportSource`, defaulting to `\"react\"` per tsc)." })) {
	/**
	 * Project decoded compiler options to their implied JSX transform
	 * configuration. `"react-jsx"` and `"react-jsxdev"` yield the automatic
	 * runtime with `importSource` taken from `jsxImportSource` (defaulting to
	 * `"react"`, tsc's own default); `"react"` yields the classic runtime with
	 * no `importSource`. `"preserve"`, `"react-native"` and an absent `jsx`
	 * yield `Option.none()` — JSX is left untransformed (or absent entirely),
	 * so there is nothing for a bundler to configure.
	 */
	static fromCompilerOptions(options: CompilerOptions.Type): O.Option<JsxConfig> {
		switch (options.jsx) {
			case "react-jsx":
			case "react-jsxdev":
				return O.some(
					JsxConfig.make({
						runtime: "automatic",
						importSource: options.jsxImportSource ?? "react",
					}),
				);
			case "react":
				return O.some(JsxConfig.make({ runtime: "classic" }));
			default:
				return O.none();
		}
	}
}
