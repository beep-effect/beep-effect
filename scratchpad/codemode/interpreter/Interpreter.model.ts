/**
 * The Domain model for the `@beep/codemode` interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {
  SchemaUtils,
  NonEmptyTrimmedStr,
  TaggedErrorClass,
  LiteralKit
} from "@beep/schema";
import {Tuple, Result} from "effect";
import {A, P, O, R, flow, dual, pipe, Str, Struct} from "@beep/utils";
import type {TString} from "@beep/types";

export { SafeObject } from "@beep/schema/SafeObject";

const $I = $ScratchpadId.create("interpreter/Interpreter.model");

/**
 * TODO: verify if check constraints are correct given the usecase
 */
export class SourcePosition extends S.Class<SourcePosition>($I`SourcePosition`)(
  {
    line: S.Int.check(
      S.makeFilterGroup(
        [S.isGreaterThanOrEqualTo(1), S.isFinite()]
      ),
    ),
    column: S.Int.check(
      S.makeFilterGroup(
        [S.isGreaterThanOrEqualTo(1), S.isFinite()]
      ),
    ),
  },
  $I.annote("SourcePosition", {
    description: ""
  })
) {
}

export class SourceLocation extends S.Class<SourceLocation>($I`SourceLocation`)(
  {
    start: SourcePosition,
    end: SourcePosition
  },
  $I.annote("SourceLocation", {
    description: ""
  })
) {
}


export const AstNodeValue = S.StructWithRest(
  S.Struct({
    type: NonEmptyTrimmedStr,
    loc: SourceLocation.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  }),
  [S.Record(NonEmptyTrimmedStr, S.Unknown)]
).pipe(
  $I.annoteSchema("AstNodeValue", {
    description: ""
  })
);

export type AstNodeValue = typeof AstNodeValue.Type;

export declare namespace AstNodeValue {
  export interface Encoded {
    readonly type: typeof NonEmptyTrimmedStr.Encoded,
    readonly loc?: undefined | typeof SourceLocation.Encoded,

    readonly [key: typeof NonEmptyTrimmedStr.Encoded]: unknown
  }
}

export class AstNode extends S.Class<AstNode>($I`AstNode`)(
  {
    value: AstNodeValue,
  },
  $I.annote("AstNodeClass", {
    description: ""
  })
) {
  static readonly create = <const TypeTag extends TString.NonEmpty, Fields extends S.Struct.Fields>(
    typeTag: TypeTag,
    schemaFields: Fields,
    // Todo type properly
    // meta: S.Annotations.Bottom<S.Top, S.Top["~type.parameters"]>
    meta: {
      readonly description: string
    }
  ) => {
    S.asserts(S.NonEmptyString, typeTag);


    const identifier = `${$I.string()}/${typeTag}`;
    const SchemaValue = S.StructWithRest(
      S.Struct(
        {
          ...Struct.omit(AstNodeValue.schema.fields, ["type"]),
          ...schemaFields
        },
      ),
      AstNodeValue.records
    ).pipe(
      $I.annoteSchema(`${identifier}Value`, {
        description: `Node value for ${meta.description}`
      })
    );

    class Schema extends S.Class<Schema>(`${identifier}`)(
      {
        type: S.tag(typeTag),
        value: SchemaValue,
      },
      $I.annote(identifier,)
    ) {
    }

    return {
      [`${Str.toUpperCase(typeTag)}`]: Schema,
      [`${Str.toUpperCase(typeTag)}Value`]: SchemaValue,
    };
  };
}

export declare namespace AstNode {
  export interface Encoded {
    readonly value: AstNodeValue.Encoded;
  }
}

export const {
  ProgramNode,
  ProgramNodeValue,
} = AstNode.create(
  "ProgramNode",
  {
    body: S.Array(S.suspend((): S.Codec<AstNode, AstNode.Encoded> => AstNode))
  },
  {
    description: "The codemode program node"
  }
);


const DiagnosticKind = LiteralKit(
  [
    "ParseError",
    "UnsupportedSyntax",
    "UnknownTool",
    "InvalidToolInput",
    "InvalidToolOutput",
    "InvalidDataValue",
    "ToolCallLimitExceeded",
    "TimeoutExceeded",
    "ToolFailure",
    "ExecutionFailure",
  ]
).pipe(
  $I.annoteSchema("DiagnosticKind", {
    description: ""
  })
);

export type DiagnosticKind = typeof DiagnosticKind.Type;


export const DiagnosticKindRuntimeErrorValue = DiagnosticKind.mapMembers(
  (members) => {
    const make = <const Kind extends DiagnosticKind>(literalSchema: S.Literal<Kind>) => S.Struct({
      kind: S.tag(literalSchema.literal),
      node: AstNode.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      suggestions: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      message: S.String,
      errorName: S.String.pipe(S.mutableKey, SchemaUtils.withKeyDefaults("Error")),
    });

    return pipe(
      members,
      Tuple.evolve(
        [
          make,
          make,
          make,
          make,
          make,
          make,
          make,
          make,
          make,
          make,
        ]
      )
    );
  }
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DiagnosticKindRuntimeErrorValue", {
    description: ""
  })
);

export type DiagnosticKindRuntimeErrorValue = typeof DiagnosticKindRuntimeErrorValue.Type;

export declare namespace DiagnosticKindRuntimeErrorValue {
  export type Encoded = typeof DiagnosticKindRuntimeErrorValue.Encoded;
}

export const supportedSyntaxMessage =
  "Supported orchestration syntax: tools.* calls (they return promises - resolve them with await), data literals, destructuring, optional chaining, template literals, conditionals, switch, loops (incl. for...of and for...in over object/array/tools keys), arrow functions, spread, try/catch, array methods (map/filter/find/findIndex/some/every/reduce/flatMap/forEach/sort/slice/concat/indexOf/lastIndexOf/at/flat/reverse/includes/join), string methods (incl. match/matchAll/replace/split with regular expressions), Date/RegExp/Map/Set/URL/URLSearchParams, URI encoding helpers, Object/Math/JSON helpers, captured console.log/warn/error/dir/table, Promise.all/allSettled/race/any/resolve/reject over arrays mixing promises and plain values for parallel tool calls, promise chaining with .then/.catch/.finally, and new Promise((resolve, reject) => ...) construction.";

export class InterpreterRuntimeError extends TaggedErrorClass<InterpreterRuntimeError>($I`InterpreterRuntimeError`)(
  "InterpreterRuntimeError",
  {

    error: DiagnosticKindRuntimeErrorValue
  },
  $I.annote("InterpreterRuntimeError", {
    description: ""
  })
) {

  readonly as = (errorName: string): this => {
    this.error.errorName = errorName;
    return this
  }

  static readonly new = (
    message: string,
    node?: undefined | AstNode,
    kind: DiagnosticKind = DiagnosticKind.Enum.ExecutionFailure,
    suggestions?: ReadonlyArray<string>
  ) => InterpreterRuntimeError.make(
    {
      error: DiagnosticKindRuntimeErrorValue.make({
        kind,
        message,
        node: O.fromNullishOr(node),
        suggestions: O.fromNullishOr(suggestions)
      })
    }
  );

  static readonly unsupportedSyntax: {
    (kind: string, node: AstNode): InterpreterRuntimeError,
    (node: AstNode): (kind: string) => InterpreterRuntimeError
  } = dual(2, (kind: string, node: AstNode): InterpreterRuntimeError => InterpreterRuntimeError.new(
    `Syntax '${kind}' is not supported. ${supportedSyntaxMessage}`,
    node,
    "UnsupportedSyntax",
    [supportedSyntaxMessage],
  ));
}

const optionalShortCircuitSymbol = Symbol("codemode.optional-short-circuit");
export const OptionalShortCircuit = S.UniqueSymbol(optionalShortCircuitSymbol).pipe(
  SchemaUtils.withKeyDefaults(optionalShortCircuitSymbol)
);

export type OptionalShortCircuit = typeof OptionalShortCircuit.Type;

const isRecord = P.chainRefinements([P.isObjectKeyword, P.isNotNull]);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const asNode = flow((value: unknown, context: string): Result.Result<AstNode, InterpreterRuntimeError> => S.decodeUnknownResult(AstNode)(value), Result.getOrThrowWith());
