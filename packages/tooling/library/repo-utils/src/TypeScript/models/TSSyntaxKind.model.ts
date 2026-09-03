/**
 * Shared TypeScript syntax kind model definitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Struct } from "@beep/utils";

/**
 * Canonical TypeScript SyntaxKind name entries.
 *
 * @category models
 * @since 0.0.0
 */
const TSSyntaxKindEntries = [
  ["Unknown", 0],
  ["EndOfFileToken", 1],
  ["SingleLineCommentTrivia", 2],
  ["MultiLineCommentTrivia", 3],
  ["NewLineTrivia", 4],
  ["WhitespaceTrivia", 5],
  ["ShebangTrivia", 6],
  ["ConflictMarkerTrivia", 7],
  ["NonTextFileMarkerTrivia", 8],
  ["NumericLiteral", 9],
  ["BigIntLiteral", 10],
  ["StringLiteral", 11],
  ["JsxText", 12],
  ["JsxTextAllWhiteSpaces", 13],
  ["RegularExpressionLiteral", 14],
  ["NoSubstitutionTemplateLiteral", 15],
  ["TemplateHead", 16],
  ["TemplateMiddle", 17],
  ["TemplateTail", 18],
  ["OpenBraceToken", 19],
  ["CloseBraceToken", 20],
  ["OpenParenToken", 21],
  ["CloseParenToken", 22],
  ["OpenBracketToken", 23],
  ["CloseBracketToken", 24],
  ["DotToken", 25],
  ["DotDotDotToken", 26],
  ["SemicolonToken", 27],
  ["CommaToken", 28],
  ["QuestionDotToken", 29],
  ["LessThanToken", 30],
  ["LessThanSlashToken", 31],
  ["GreaterThanToken", 32],
  ["LessThanEqualsToken", 33],
  ["GreaterThanEqualsToken", 34],
  ["EqualsEqualsToken", 35],
  ["ExclamationEqualsToken", 36],
  ["EqualsEqualsEqualsToken", 37],
  ["ExclamationEqualsEqualsToken", 38],
  ["EqualsGreaterThanToken", 39],
  ["PlusToken", 40],
  ["MinusToken", 41],
  ["AsteriskToken", 42],
  ["AsteriskAsteriskToken", 43],
  ["SlashToken", 44],
  ["PercentToken", 45],
  ["PlusPlusToken", 46],
  ["MinusMinusToken", 47],
  ["LessThanLessThanToken", 48],
  ["GreaterThanGreaterThanToken", 49],
  ["GreaterThanGreaterThanGreaterThanToken", 50],
  ["AmpersandToken", 51],
  ["BarToken", 52],
  ["CaretToken", 53],
  ["ExclamationToken", 54],
  ["TildeToken", 55],
  ["AmpersandAmpersandToken", 56],
  ["BarBarToken", 57],
  ["QuestionToken", 58],
  ["ColonToken", 59],
  ["AtToken", 60],
  ["QuestionQuestionToken", 61],
  /** Only the JSDoc scanner produces BacktickToken. The normal scanner produces NoSubstitutionTemplateLiteral and related kinds. */
  ["BacktickToken", 62],
  /** Only the JSDoc scanner produces HashToken. The normal scanner produces PrivateIdentifier. */
  ["HashToken", 63],
  ["EqualsToken", 64],
  ["PlusEqualsToken", 65],
  ["MinusEqualsToken", 66],
  ["AsteriskEqualsToken", 67],
  ["AsteriskAsteriskEqualsToken", 68],
  ["SlashEqualsToken", 69],
  ["PercentEqualsToken", 70],
  ["LessThanLessThanEqualsToken", 71],
  ["GreaterThanGreaterThanEqualsToken", 72],
  ["GreaterThanGreaterThanGreaterThanEqualsToken", 73],
  ["AmpersandEqualsToken", 74],
  ["BarEqualsToken", 75],
  ["BarBarEqualsToken", 76],
  ["AmpersandAmpersandEqualsToken", 77],
  ["QuestionQuestionEqualsToken", 78],
  ["CaretEqualsToken", 79],
  ["Identifier", 80],
  ["PrivateIdentifier", 81],
  ["BreakKeyword", 83],
  ["CaseKeyword", 84],
  ["CatchKeyword", 85],
  ["ClassKeyword", 86],
  ["ConstKeyword", 87],
  ["ContinueKeyword", 88],
  ["DebuggerKeyword", 89],
  ["DefaultKeyword", 90],
  ["DeleteKeyword", 91],
  ["DoKeyword", 92],
  ["ElseKeyword", 93],
  ["EnumKeyword", 94],
  ["ExportKeyword", 95],
  ["ExtendsKeyword", 96],
  ["FalseKeyword", 97],
  ["FinallyKeyword", 98],
  ["ForKeyword", 99],
  ["FunctionKeyword", 100],
  ["IfKeyword", 101],
  ["ImportKeyword", 102],
  ["InKeyword", 103],
  ["InstanceOfKeyword", 104],
  ["NewKeyword", 105],
  ["NullKeyword", 106],
  ["ReturnKeyword", 107],
  ["SuperKeyword", 108],
  ["SwitchKeyword", 109],
  ["ThisKeyword", 110],
  ["ThrowKeyword", 111],
  ["TrueKeyword", 112],
  ["TryKeyword", 113],
  ["TypeOfKeyword", 114],
  ["VarKeyword", 115],
  ["VoidKeyword", 116],
  ["WhileKeyword", 117],
  ["WithKeyword", 118],
  ["ImplementsKeyword", 119],
  ["InterfaceKeyword", 120],
  ["LetKeyword", 121],
  ["PackageKeyword", 122],
  ["PrivateKeyword", 123],
  ["ProtectedKeyword", 124],
  ["PublicKeyword", 125],
  ["StaticKeyword", 126],
  ["YieldKeyword", 127],
  ["AbstractKeyword", 128],
  ["AccessorKeyword", 129],
  ["AsKeyword", 130],
  ["AssertsKeyword", 131],
  ["AssertKeyword", 132],
  ["AnyKeyword", 133],
  ["AsyncKeyword", 134],
  ["AwaitKeyword", 135],
  ["BooleanKeyword", 136],
  ["ConstructorKeyword", 137],
  ["DeclareKeyword", 138],
  ["GetKeyword", 139],
  ["InferKeyword", 140],
  ["IntrinsicKeyword", 141],
  ["IsKeyword", 142],
  ["KeyOfKeyword", 143],
  ["ModuleKeyword", 144],
  ["NamespaceKeyword", 145],
  ["NeverKeyword", 146],
  ["OutKeyword", 147],
  ["ReadonlyKeyword", 148],
  ["RequireKeyword", 149],
  ["NumberKeyword", 150],
  ["ObjectKeyword", 151],
  ["SatisfiesKeyword", 152],
  ["SetKeyword", 153],
  ["StringKeyword", 154],
  ["SymbolKeyword", 155],
  ["TypeKeyword", 156],
  ["UndefinedKeyword", 157],
  ["UniqueKeyword", 158],
  ["UnknownKeyword", 159],
  ["UsingKeyword", 160],
  ["FromKeyword", 161],
  ["GlobalKeyword", 162],
  ["BigIntKeyword", 163],
  ["OverrideKeyword", 164],
  ["OfKeyword", 165],
  ["DeferKeyword", 166],
  ["QualifiedName", 167],
  ["ComputedPropertyName", 168],
  ["TypeParameter", 169],
  ["Parameter", 170],
  ["Decorator", 171],
  ["PropertySignature", 172],
  ["PropertyDeclaration", 173],
  ["MethodSignature", 174],
  ["MethodDeclaration", 175],
  ["ClassStaticBlockDeclaration", 176],
  ["Constructor", 177],
  ["GetAccessor", 178],
  ["SetAccessor", 179],
  ["CallSignature", 180],
  ["ConstructSignature", 181],
  ["IndexSignature", 182],
  ["TypePredicate", 183],
  ["TypeReference", 184],
  ["FunctionType", 185],
  ["ConstructorType", 186],
  ["TypeQuery", 187],
  ["TypeLiteral", 188],
  ["ArrayType", 189],
  ["TupleType", 190],
  ["OptionalType", 191],
  ["RestType", 192],
  ["UnionType", 193],
  ["IntersectionType", 194],
  ["ConditionalType", 195],
  ["InferType", 196],
  ["ParenthesizedType", 197],
  ["ThisType", 198],
  ["TypeOperator", 199],
  ["IndexedAccessType", 200],
  ["MappedType", 201],
  ["LiteralType", 202],
  ["NamedTupleMember", 203],
  ["TemplateLiteralType", 204],
  ["TemplateLiteralTypeSpan", 205],
  ["ImportType", 206],
  ["ObjectBindingPattern", 207],
  ["ArrayBindingPattern", 208],
  ["BindingElement", 209],
  ["ArrayLiteralExpression", 210],
  ["ObjectLiteralExpression", 211],
  ["PropertyAccessExpression", 212],
  ["ElementAccessExpression", 213],
  ["CallExpression", 214],
  ["NewExpression", 215],
  ["TaggedTemplateExpression", 216],
  ["TypeAssertionExpression", 217],
  ["ParenthesizedExpression", 218],
  ["FunctionExpression", 219],
  ["ArrowFunction", 220],
  ["DeleteExpression", 221],
  ["TypeOfExpression", 222],
  ["VoidExpression", 223],
  ["AwaitExpression", 224],
  ["PrefixUnaryExpression", 225],
  ["PostfixUnaryExpression", 226],
  ["BinaryExpression", 227],
  ["ConditionalExpression", 228],
  ["TemplateExpression", 229],
  ["YieldExpression", 230],
  ["SpreadElement", 231],
  ["ClassExpression", 232],
  ["OmittedExpression", 233],
  ["ExpressionWithTypeArguments", 234],
  ["AsExpression", 235],
  ["NonNullExpression", 236],
  ["MetaProperty", 237],
  ["SyntheticExpression", 238],
  ["SatisfiesExpression", 239],
  ["TemplateSpan", 240],
  ["SemicolonClassElement", 241],
  ["Block", 242],
  ["EmptyStatement", 243],
  ["VariableStatement", 244],
  ["ExpressionStatement", 245],
  ["IfStatement", 246],
  ["DoStatement", 247],
  ["WhileStatement", 248],
  ["ForStatement", 249],
  ["ForInStatement", 250],
  ["ForOfStatement", 251],
  ["ContinueStatement", 252],
  ["BreakStatement", 253],
  ["ReturnStatement", 254],
  ["WithStatement", 255],
  ["SwitchStatement", 256],
  ["LabeledStatement", 257],
  ["ThrowStatement", 258],
  ["TryStatement", 259],
  ["DebuggerStatement", 260],
  ["VariableDeclaration", 261],
  ["VariableDeclarationList", 262],
  ["FunctionDeclaration", 263],
  ["ClassDeclaration", 264],
  ["InterfaceDeclaration", 265],
  ["TypeAliasDeclaration", 266],
  ["EnumDeclaration", 267],
  ["ModuleDeclaration", 268],
  ["ModuleBlock", 269],
  ["CaseBlock", 270],
  ["NamespaceExportDeclaration", 271],
  ["ImportEqualsDeclaration", 272],
  ["ImportDeclaration", 273],
  ["ImportClause", 274],
  ["NamespaceImport", 275],
  ["NamedImports", 276],
  ["ImportSpecifier", 277],
  ["ExportAssignment", 278],
  ["ExportDeclaration", 279],
  ["NamedExports", 280],
  ["NamespaceExport", 281],
  ["ExportSpecifier", 282],
  ["MissingDeclaration", 283],
  ["ExternalModuleReference", 284],
  ["JsxElement", 285],
  ["JsxSelfClosingElement", 286],
  ["JsxOpeningElement", 287],
  ["JsxClosingElement", 288],
  ["JsxFragment", 289],
  ["JsxOpeningFragment", 290],
  ["JsxClosingFragment", 291],
  ["JsxAttribute", 292],
  ["JsxAttributes", 293],
  ["JsxSpreadAttribute", 294],
  ["JsxExpression", 295],
  ["JsxNamespacedName", 296],
  ["CaseClause", 297],
  ["DefaultClause", 298],
  ["HeritageClause", 299],
  ["CatchClause", 300],
  ["ImportAttributes", 301],
  ["ImportAttribute", 302],
  ["PropertyAssignment", 304],
  ["ShorthandPropertyAssignment", 305],
  ["SpreadAssignment", 306],
  ["EnumMember", 307],
  ["SourceFile", 308],
  ["Bundle", 309],
  ["JSDocTypeExpression", 310],
  ["JSDocNameReference", 311],
  ["JSDocMemberName", 312],
  ["JSDocAllType", 313],
  ["JSDocUnknownType", 314],
  ["JSDocNullableType", 315],
  ["JSDocNonNullableType", 316],
  ["JSDocOptionalType", 317],
  ["JSDocFunctionType", 318],
  ["JSDocVariadicType", 319],
  ["JSDocNamepathType", 320],
  ["JSDoc", 321],
  ["JSDocText", 322],
  ["JSDocTypeLiteral", 323],
  ["JSDocSignature", 324],
  ["JSDocLink", 325],
  ["JSDocLinkCode", 326],
  ["JSDocLinkPlain", 327],
  ["JSDocTag", 328],
  ["JSDocAugmentsTag", 329],
  ["JSDocImplementsTag", 330],
  ["JSDocAuthorTag", 331],
  ["JSDocDeprecatedTag", 332],
  ["JSDocClassTag", 333],
  ["JSDocPublicTag", 334],
  ["JSDocPrivateTag", 335],
  ["JSDocProtectedTag", 336],
  ["JSDocReadonlyTag", 337],
  ["JSDocOverrideTag", 338],
  ["JSDocCallbackTag", 339],
  ["JSDocOverloadTag", 340],
  ["JSDocEnumTag", 341],
  ["JSDocParameterTag", 342],
  ["JSDocReturnTag", 343],
  ["JSDocThisTag", 344],
  ["JSDocTypeTag", 345],
  ["JSDocTemplateTag", 346],
  ["JSDocTypedefTag", 347],
  ["JSDocSeeTag", 348],
  ["JSDocPropertyTag", 349],
  ["JSDocThrowsTag", 350],
  ["JSDocSatisfiesTag", 351],
  ["JSDocImportTag", 352],
  ["SyntaxList", 353],
  ["NotEmittedStatement", 354],
  ["NotEmittedTypeElement", 355],
  ["PartiallyEmittedExpression", 356],
  ["CommaListExpression", 357],
  ["SyntheticReferenceExpression", 358],
  ["Count", 359],
  ["FirstAssignment", 64],
  ["LastAssignment", 79],
  ["FirstCompoundAssignment", 65],
  ["LastCompoundAssignment", 79],
  ["FirstReservedWord", 83],
  ["LastReservedWord", 118],
  ["FirstKeyword", 83],
  ["LastKeyword", 166],
  ["FirstFutureReservedWord", 119],
  ["LastFutureReservedWord", 127],
  ["FirstTypeNode", 183],
  ["LastTypeNode", 206],
  ["FirstPunctuation", 19],
  ["LastPunctuation", 79],
  ["FirstToken", 0],
  ["LastToken", 166],
  ["FirstTriviaToken", 2],
  ["LastTriviaToken", 7],
  ["FirstLiteralToken", 9],
  ["LastLiteralToken", 15],
  ["FirstTemplateToken", 15],
  ["LastTemplateToken", 18],
  ["FirstBinaryOperator", 30],
  ["LastBinaryOperator", 79],
  ["FirstStatement", 244],
  ["LastStatement", 260],
  ["FirstNode", 167],
  ["FirstJSDocNode", 310],
  ["LastJSDocNode", 352],
  ["FirstJSDocTagNode", 328],
  ["LastJSDocTagNode", 352],
] as const;

type TSSyntaxKindEntries = typeof TSSyntaxKindEntries;

const toNameOptions = <
  const Entries extends readonly [readonly [string, number], ...ReadonlyArray<readonly [string, number]>],
>(
  entries: Entries
) => A.map(entries, ([name]) => name) as unknown as readonly [Entries[0][0], ...Array<Entries[number][0]>];

const TSSyntaxKindNames = toNameOptions(TSSyntaxKindEntries);

/**
 * Lookup table from canonical SyntaxKind names to their numeric codes.
 *
 * **Example** (Lookup SourceFile kind code)
 *
 * ```ts
 * import { TSSyntaxKindCode } from "@beep/repo-utils/TypeScript/models/TSSyntaxKind.model"
 * const sourceFileCode = TSSyntaxKindCode.SourceFile
 * console.log(sourceFileCode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TSSyntaxKindCode = Struct.fromEntries(TSSyntaxKindEntries) as {
  readonly [K in TSSyntaxKindEntries[number][0]]: Extract<TSSyntaxKindEntries[number], readonly [K, number]>[1];
};

const TSSyntaxKindBase = LiteralKit(TSSyntaxKindNames);

/**
 * Literal schema kit for canonical TypeScript SyntaxKind names.
 *
 * **Details**
 *
 * `From` is kept as a compatibility alias for callers that previously reached
 * for the literal-name side of the old mapped model.
 *
 * **Example** (Access SyntaxKind code map)
 *
 * ```ts
 * import { TSSyntaxKind } from "@beep/repo-utils/TypeScript/models/TSSyntaxKind.model"
 * const syntaxKind = TSSyntaxKind
 * console.log(syntaxKind.Code.SourceFile)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TSSyntaxKind = TSSyntaxKindBase.pipe(
  SchemaUtils.withStatics(() => ({
    From: TSSyntaxKindBase,
    Code: TSSyntaxKindCode,
  }))
);

/**
 * Companion namespace for {@link TSSyntaxKind}.
 *
 * **Example** (Annotate SyntaxKind type value)
 *
 * ```ts
 * import type { TSSyntaxKind } from "@beep/repo-utils/TypeScript/models/TSSyntaxKind.model"
 * const kind: TSSyntaxKind.Type = "SourceFile"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TSSyntaxKind {
  /**
   * Decoded representation of a TSSyntaxKind value.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = typeof TSSyntaxKind.Type;
  /**
   * Encoded representation of a TSSyntaxKind value.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof TSSyntaxKind.Encoded;
}

/**
 * Literal union of all canonical TypeScript SyntaxKind string names.
 *
 * **Example** (Inspect SyntaxKind literal union)
 *
 * ```ts
 * import { TSSyntaxKindLiteral } from "@beep/repo-utils/TypeScript/models/TSSyntaxKind.model"
 * const syntaxKind = TSSyntaxKindLiteral
 * console.log(syntaxKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TSSyntaxKindLiteral = TSSyntaxKind.From;

/**
 * Inferred type for {@link TSSyntaxKindLiteral}.
 *
 * **Example** (Annotate SyntaxKind literal type)
 *
 * ```ts
 * import type { TSSyntaxKindLiteral } from "@beep/repo-utils/TypeScript/models/TSSyntaxKind.model"
 * const kind: TSSyntaxKindLiteral = "SourceFile"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSSyntaxKindLiteral = typeof TSSyntaxKindLiteral.Type;
