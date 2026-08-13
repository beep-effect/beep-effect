# beep CI Turbo remote-cache Lambda

This standalone package builds the three Node.js 22 Lambda handlers consumed by
`infra/src/CiTurboCache.ts`. It is intentionally outside the root Bun workspace
and owns its own `bun.lock`.

## Pinned shim

- Package: `turborepo-remote-cache@2.12.0`
- Lockfile integrity:
  `sha512-X34C/eyL+cIDQRDBAln0zEa5QsqpCbbbxS7qtiIhgmNGKlQQPFPo6snbOyq7xhRfVKFeyVEIAypTrR7XDZV6pw==`
- Published export verified: `turborepo-remote-cache/aws-lambda`

The pin was selected as the latest stable npm release when this package was
built. The integrity above is recorded in `bun.lock` and matches the published
npm tarball.

## Handler and environment contract

The ZIP contains these handlers at its root:

| Handler | Purpose | Environment |
| --- | --- | --- |
| `index.handler` | Read-only upstream shim | `AUTH_MODE=none`, `STORAGE_PROVIDER=s3`, `STORAGE_PATH=<bucket>`, `READ_ONLY=true` |
| `authorizer.handler` | HTTP API v2 REQUEST authorizer | `READ_ONLY_TOKEN_SSM_PARAMETER_ARN`, `TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN`, `WRITER_SHARED_SECRET_SSM_PARAMETER_ARN` |
| `writer.handler` | HMAC-gated upstream shim | `AUTH_MODE=none`, `STORAGE_PROVIDER=s3`, `STORAGE_PATH=<bucket>`, `READ_ONLY=false`, `WRITER_SHARED_SECRET_SSM_PARAMETER_ARN` |

The authorizer fetches all three SecureStrings in one decrypted
`GetParameters` call and caches the result for five minutes per warm Lambda
environment. The writer fetches only its shared-secret SecureString with
`GetParameter` and uses the same TTL. Resolution, decoding, token, route, and
signature failures all fail closed.

For an allowed artifact `PUT`, the authorizer places a hex HMAC-SHA256 in
`context.writerSignature`. The writer reads it from
`requestContext.authorizer.lambda.writerSignature` and recomputes the HMAC from
its own event before delegating the untouched event to the shim.

## Verified upstream contract

The installed `2.12.0` package's export map points `./aws-lambda` to
`dist/aws-lambda.js`. Its actual runtime code confirms:

- `AUTH_MODE=none` registers no shim authentication because authentication is
  handled by API Gateway;
- `STORAGE_PROVIDER=s3` selects the S3 storage provider;
- `STORAGE_PATH` is required by that provider and is interpreted as the S3
  bucket name;
- environment boolean coercion turns `READ_ONLY=true|false` into booleans; and
- `READ_ONLY=true` rejects artifact `PUT` with HTTP 403.

No component environment-variable mismatch was found.

Route-contract note: pinned shim `2.12.0` does not register
`POST /v8/artifacts` (the Vercel artifact-query endpoint). The Pulumi
component therefore exposes no such route and the authorizer matrix denies
the path, so clients receive a plain API Gateway 404 instead of
allow-then-404. Turbo's cache read/write cycle (`status`, `GET`/`HEAD`
artifact, `events`, `PUT` artifact) never requires the query endpoint. If a
future shim version implements it, re-add the route, the matrix row, and the
matching tests together.

## Rebuild

From this directory:

```sh
./build.sh
```

The script performs a frozen Bun install, TypeScript checking, 31 unit tests,
three bundled-handler smoke checks, and three unminified CommonJS esbuild
bundles targeting Node.js 22. It writes the resulting ZIP to:

```text
/home/elpresidank/beep-infra-artifacts/turbo-cache/2.12.0/turbo-cache.zip
```

All npm dependencies, including `@aws-sdk/client-ssm`, are bundled. Node.js
built-ins are supplied by the Node.js 22 Lambda runtime.

Oversized cache artifacts need no special handler logic. API Gateway's 10 MB
request limit and Lambda's approximately 6 MB synchronous payload limit reject
them before the shim can store them; Turbo treats a failed cache upload as a
non-fatal warning.
