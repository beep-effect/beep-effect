// The generic tsconfig JSX-runtime vocabulary: a pure projection from decoded
// compiler options to the two JSX transform modes a bundler can actually
// configure. `"react-jsx"` / `"react-jsxdev"` select the automatic runtime
// (with `jsxImportSource` defaulting to `"react"` exactly as tsc does);
// `"react"` selects the classic runtime (the factory options, `jsxFactory` /
// `jsxFragmentFactory`, stay on `CompilerOptions` — classic consumers read
// them there). `"preserve"` and `"react-native"` leave JSX untransformed, so
// they project to `Option.none()` alongside an absent `jsx`.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "effect/Option";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import type { CompilerOptions } from "./CompilerOptions.ts";

const $I = $ScratchpadId.create("effected/tsconfig-json/JsxConfig");

const JsxRuntime = LiteralKit(["automatic", "classic"]).annotate(
	$I.annote("JsxRuntime", { description: "The automatic or classic JSX transform runtime." }),
);

const JsxVariants = JsxRuntime.toTaggedUnion("runtime")({
	automatic: {
		/** The automatic runtime's import source (`jsxImportSource`, defaulted to `"react"`). */
		importSource: S.String.annotateKey({ description: "The automatic runtime's required import source." }),
	},
	classic: {},
}).annotate($I.annote("JsxConfig", {
	description: "The JSX transform configuration, with a required import source only for the automatic runtime.",
}));

export type JsxConfig = typeof JsxVariants.Type;

// TypeScript cannot extend a constructor returning a union. Widen only the
// static carrier's instance type; the codecs, constructor input and result
// retain the discriminated union, and Opaque restores its public Type.
const JsxBase: Omit<typeof JsxVariants, "Type"> & S.Schema<object> = JsxVariants;

/**
 * The JSX transform configuration a `jsx` compiler option implies: which
 * runtime (`"automatic"` for `react-jsx` / `react-jsxdev`, `"classic"` for
 * `react`) and, for the automatic runtime, the import source the transform
 * emits (`jsxImportSource`, defaulting to `"react"` per tsc).
 *
 * @public
 */
export const JsxConfig = class extends S.Opaque<JsxConfig>()(JsxBase) {
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
		return Match.value(options.jsx).pipe(
			Match.whenOr("react-jsx", "react-jsxdev", () =>
				O.some(
					JsxConfig.make({
						runtime: "automatic",
						importSource: options.jsxImportSource ?? "react",
					}),
				),
			),
			Match.when("react", () => O.some(JsxConfig.make({ runtime: "classic" }))),
			Match.orElse(O.none<JsxConfig>),
		);
	}
};
