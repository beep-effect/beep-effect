/**
 * Errors for the `@beep/codemode` interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {
  FilePath,
  LiteralKit,
  NonEmptyTrimmedStr,
  SchemaUtils
} from "@beep/schema";
import {P} from "@beep/utils";
import type {Effect} from "effect";

const $I = $ScratchpadId.create("OpenAPI.types");

/**
 * A parsed OpenAPI 3.x document. YAML must be parsed by the host.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Document } from "@beep/codemode";
 *
 * const document: Document = Document.make()
 *
 * console.log(document); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const Document = S.Record(S.String, S.Unknown).pipe(
  S.brand("Document"),
  $I.annoteSchema("Document", {
    description: ""
  })
);

/**
 *
 * Companion runtime type for {@link Document}
 *
 *
 * **Example **
 *
 * @example
 * ```ts
 * import { Document } from "@beep/codemode";
 *
 * const document: Document = Document.make()
 *
 * console.log(document); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Document = typeof Document.Type;

/**
 * Companion namespace for {@link Document}
 *
 * @since 0.0.0
 */
export declare namespace Document {
  /**
   * Companion encoded type for {@link Document}
   *
   * **Example**
   *
   * @example
   * ```ts
   * import { Document } from "@beep/codemode";
   * import * as S from "effect/Schema";
   * const documentEncoded: Document.Encoded = S.encodeSync(Document)(Document.make({}));
   *
   * console.log(documentEncoded); // `{}`
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof Document.Encoded
}

/**
 * A parsed OpenAPI 3.x document. YAML must be parsed by the host.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { OperationId } from "@beep/codemode";
 *
 * const operationId: OperationId = OperationId.make("beep-beep")
 *
 * console.log(document); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const OperationId = NonEmptyTrimmedStr.pipe(
  S.brand("OperationId"),
  $I.annoteSchema("OperationId", {
    description: ""
  })
);

/**
 *
 * Companion runtime type for {@link OperationId}
 *
 *
 * **Example **
 *
 * @example
 * ```ts
 * import { OperationId } from "@beep/codemode";
 *
 * const operationId: OperationId = OperationId.make()
 *
 * console.log(operationId); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OperationId = typeof OperationId.Type;

/**
 * Companion namespace for {@link OperationId}
 *
 * @since 0.0.0
 */
export declare namespace OperationId {
  /**
   * Companion encoded type for {@link OperationId}
   *
   * **Example**
   *
   * @example
   * ```ts
   * import { OperationId } from "@beep/codemode";
   * import * as S from "effect/Schema";
   * const operationEncoded: OperationId.Encoded = S.encodeSync(OperationId)(OperationId.make({}));
   *
   * console.log(operationId); // `{}`
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof OperationId.Encoded
}


/**
 * The operation identity handed to auth resolution and errors.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Operation } from "@beep/codemode";
 *
 * const operation: Operation = Operation.make()
 *
 * console.log(operation); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Operation extends S.Class<Operation>($I`Operation`)(
  {
    operationId: OperationId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
    ),
    method: NonEmptyTrimmedStr,
    path: FilePath,
    summary: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    description: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("Operation", {
    description: "The `Operation` model"
  })
) {
}

/**
 * Companion namespace for {@link Operation}
 *
 * @since 0.0.0
 */
export declare namespace Operation {
  /**
   * Companion encoded type for {@link Operation}
   *
   * **Example**
   *
   * @example
   * ```ts
   * import { Operation } from "@beep/codemode";
   * import * as S from "effect/Schema";
   * const operationEncoded: Operation.Encoded = S.encodeSync(Operation)(Operation.make());
   *
   * console.log(operationEncoded); // `{}`
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
  }
}

/**
 * The `Thing` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Thing } from "@beep/codemode";
 *
 * const thing: Thing = Thing.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const Thing = LiteralKit(["thing"]).pipe(
  $I.annoteSchema("Thing", {
    description: ""
  })
);

/**
 *
 * Companion runtime type for {@link Thing}
 *
 *
 * **Example **
 *
 * @example
 * ```ts
 * import { Thing } from "@beep/codemode";
 *
 * const thing: Thing = Thing.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Thing = typeof Thing.Type;

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemaApiKeyForBase extends S.Class<SecuritySchemaApiKeyForBase>($I`SecuritySchemaApiKeyForBase`)(
  {
    name: S.String.annotateKey({
      description: "todo"
    })
  },
  $I.annote("SecuritySchemaApiKeyForBase", {})
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemaApiKeyForHeader extends SecuritySchemaApiKeyForBase.extend<SecuritySchemaApiKeyForHeader>($I`SecuritySchemaApiKeyForHeader`)(
  {
    in: S.tag("header")
  },
  $I.annote("SecuritySchemaApiKeyForHeader", {
    description: ""
  })
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemaApiKeyForQuery extends SecuritySchemaApiKeyForBase.extend<SecuritySchemaApiKeyForQuery>($I`SecuritySchemaApiKeyForQuery`)(
  {
    in: S.tag("query")
  },
  $I.annote("SecuritySchemaApiKeyForQuery", {
    description: ""
  })
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemaApiKeyForCookie extends SecuritySchemaApiKeyForBase.extend<SecuritySchemaApiKeyForCookie>($I`SecuritySchemaApiKeyForCookie`)(
  {
    in: S.tag("query")
  },
  $I.annote("SecuritySchemaApiKeyForCookie", {
    description: ""
  })
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SecuritySchemaApiKeyFor = S.Union(
  [
    SecuritySchemaApiKeyForHeader,
    SecuritySchemaApiKeyForQuery,
    SecuritySchemaApiKeyForCookie
  ]
).pipe(
  S.toTaggedUnion("in"),
  $I.annoteSchema("SecuritySchemaApiKeyFor", {
    description: ""
  })
);

/**
 * Companion runtime type for {@link SecuritySchemaApiKeyFor}
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SecuritySchemaApiKeyFor = typeof SecuritySchemaApiKeyFor.Type;

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeApiKey extends S.Class<SecuritySchemeApiKey>($I`SecuritySchemeApiKey`)(
  {
    type: S.tag("apiKey"),
    for: SecuritySchemaApiKeyFor
  },
  $I.annote("SecuritySchemeApiKey", {
    description: ""
  })
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeHttp extends S.Class<SecuritySchemeHttp>($I`SecuritySchemeHttp`)(
  {
    type: S.tag("http"),
    scheme: S.String,
  },
  $I.annote("SecuritySchemeHttp", {})
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeOAuth2 extends S.Class<SecuritySchemeOAuth2>($I`SecuritySchemeOAuth2`)(
  {
    type: S.tag("oauth2")
  },
  $I.annote("SecuritySchemeOAuth2", {})
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeOpenIdConnect extends S.Class<SecuritySchemeOpenIdConnect>($I`SecuritySchemeOpenIdConnect`)(
  {
    type: S.tag("openIdConnect")
  },
  $I.annote("SecuritySchemeOpenIdConnect", {})
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeHeader extends S.Class<SecuritySchemeHeader>($I`SecuritySchemeHeader`)(
  {
    type: S.tag("")
  },
  $I.annote("SecuritySchemeHeader", {})
) {
}

/**
 * A resolved OpenAPI security scheme from `components.securitySchemes`.
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SecurityScheme = S.Union(
  [
    SecuritySchemeApiKey,
    SecuritySchemeHttp,
    SecuritySchemeOAuth2,
    SecuritySchemeOpenIdConnect
  ]
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("SecurityScheme", {
    description: ""
  })
);

/**
 * Companion runtime type for {@link SecurityScheme}
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SecurityScheme = typeof SecurityScheme.Type;

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CredentialBearer extends S.Class<CredentialBearer>($I`CredentialBearer`)(
  {
    type: S.tag("bearer"),
    token: S.Redacted(S.String).annotateKey({
      description: ""
    })
  },
  $I.annote("CredentialBearer", {
    description: ""
  })
) {
}


/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CredentialBasic extends S.Class<CredentialBasic>($I`CredentialBasic`)(
  {
    type: S.tag("basic"),
    username: S.Redacted(S.String).annotateKey({
      description: ""
    }),
    password: S.Redacted(S.String).annotateKey({
      description: ""
    })
  },
  $I.annote("CredentialBasic", {
    description: ""
  })
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CredentialApiKey extends S.Class<CredentialApiKey>($I`CredentialApiKey`)(
  {
    type: S.tag("apiKey"),
    value: S.Redacted(S.String).annotateKey({
      description: ""
    })
  },
  $I.annote("CredentialApiKey", {
    description: ""
  })
) {
}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CredentialHeader extends S.Class<CredentialHeader>($I`CredentialHeader`)(
  {
    type: S.tag("header"),
    name: S.String,
    value: S.Redacted(S.String).annotateKey({
      description: ""
    })
  },
  $I.annote("CredentialHeader", {
    description: ""
  })
) {
}

/**
 * Credential material returned by a host auth resolver. `apiKey` uses the scheme's carrier;
 * `header` supports nonstandard schemes.
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Credential = S.Union(
  [
    CredentialBearer,
    CredentialBasic,
    CredentialApiKey,
    CredentialHeader
  ]
).pipe(
  $I.annoteSchema("Credential", {
    description: "todo"
  })
);

/**
 * Companion runtime type for {@link Credential}
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Credential = typeof Credential.Type;

/**
 * Resolves credentials at call time. `undefined` tries the next OR alternative; failure aborts.
 *
 * **Example**
 * @example
 * ```ts
 * TODO
 * ```
 *
 * @category TODO
 * @since 0.0.0
 */
export type AuthResolver = (context: {
  readonly name: string
  readonly definition: SecurityScheme
  readonly scopes: ReadonlyArray<string>
  readonly operation: Operation
}) => Effect.Effect<Credential | undefined, unknown>

const AuthResolver = S.declare((u: unknown): u is AuthResolver => P.isFunction(u)).pipe(
  $I.annoteSchema("AuthResolver", {
    description: "TODO"
  })
);

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO: example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Options extends S.Class<Options>($I`Options`)(
  {
    spec: Document.annotateKey({
      description: "TODO"
    }),
    /** Overrides all document, path, and operation `servers`. Required when no applicable absolute server URL exists. */
    baseUrl: S.URLFromString.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Overrides all document, path, and operation `servers`. Required when no applicable absolute server URL exists."
      })
    ),
    /** Host credential resolution, keyed by security scheme name. */
    auth: S.Struct({
      resolve: AuthResolver
    }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Host credential resolution, keyed by security scheme name."
      })
    ),
     /** Static headers on every request. Not model-visible; declared header params may override them, auth always wins. */
     headers: S.Record(S.String, S.String).pipe(
       S.OptionFromOptionalKey,
       SchemaUtils.withNoneDefault,
       S.annotateKey({
         description: "Static headers on every request. Not model-visible; declared header params may override them, auth always wins."
       })
     )
  },
  $I.annote("Options", {
    description: ""
  })
) {
}

/**
 * An operation that could not be represented as a tool, and why.
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO: example
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Skipped extends S.Class<Skipped>($I`Skipped`)(
  {
    method: S.String,
    path: FilePath,
    reason: S.String,
  },
  $I.annote("Skipped", {
  description: "An operation that could not be represented as a tool, and why."
})) {}
