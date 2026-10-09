declare module "typescript/unstable/ast" {
	export const LanguageVariant: { readonly Standard: 0 };
	export const SyntaxKind: {
		readonly EndOfFile: number;
		readonly TemplateHead: number;
		readonly TemplateMiddle: number;
		readonly OpenBraceToken: number;
		readonly CloseBraceToken: number;
		readonly Identifier: number;
		readonly DotToken: number;
	};
	export type SyntaxKind = number;
	export function computeLineStarts(text: string): ReadonlyArray<number>;
	export function createScanner(skipTrivia: boolean, languageVariant: 0, text: string): {
		scan(): SyntaxKind;
		reScanTemplateToken(isTaggedTemplate: boolean): SyntaxKind;
		getTokenValue(): string;
		getTokenStart(): number;
	};
}
