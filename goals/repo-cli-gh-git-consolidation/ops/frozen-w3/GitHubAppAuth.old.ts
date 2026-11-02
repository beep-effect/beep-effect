/**
 * Frozen pre-W3 body for `ops/reviewer-ci-github-differential-w3.ts`: the hand-rolled reviewer App token cache, verbatim from
 * main 12ececd3b7 except for import paths, the identity namespace and the retired installation-token model inlined.
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ReviewerError } from "../../../../packages/tooling/tool/cli/src/commands/Reviewer/ReviewerErrors.ts";
import { reviewerWire } from "../../../../packages/tooling/tool/cli/src/commands/Reviewer/ReviewerModels.ts";
import type { ReviewerCredentials } from "../../../../packages/tooling/tool/cli/src/commands/Reviewer/ReviewerModels.ts";

const $I = $RepoCliId.create("goals/repo-cli-gh-git-consolidation/ops/frozen-w3/GitHubAppAuth.old");
const API = "https://api.github.com";
const JWT_HEADER = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9";
const TOKEN_SKEW = Duration.toMillis(Duration.minutes(5));
const JWT_BACKDATE = Duration.toSeconds(Duration.minutes(1));
const JWT_LIFETIME = Duration.toSeconds(Duration.minutes(9));
const JwtPayload = S.fromJsonString(S.Struct({ iat: S.Int, exp: S.Int, iss: S.String }));
const encodeJwtPayload = S.encodeEffect(JwtPayload);
const CredentialInput = S.Struct({
  appId: S.FiniteFromString,
  clientId: S.NonEmptyString,
  installationId: S.FiniteFromString,
  privateKey: S.Redacted(S.String),
});
const decodeCredentialInput = S.decodeUnknownEffect(CredentialInput);
const failure = (operation: string, message: string) => ReviewerError.make({ operation, message });
// The retired ReviewerInstallationToken model (W3 retires it for the kit's InstallationToken).
class ReviewerInstallationToken extends S.Class<ReviewerInstallationToken, { readonly brand: unique symbol }>(
  $I`ReviewerInstallationToken`
)({ token: S.RedactedFromValue(S.NonEmptyString), expires_at: S.DateTimeUtcFromString }) {}
const decodeToken = S.decodeUnknownEffect(ReviewerInstallationToken);

// Do not attach original exceptions: process and HTTP failures can contain credentials.
const secretRead = Effect.fn("Reviewer.secretRead")(function* (field: string, host: O.Option<string>) {
  const reference = `op://BEEP_SECRETS/beep-reviewer GitHub App/${field}`;
  const command = O.isSome(host) ? "ssh" : "op";
  const args = O.isSome(host)
    ? ["-o", "BatchMode=yes", "--", host.value, `op read '${reference}'`]
    : ["read", reference];
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const child = yield* ChildProcess.make(command, args, { stdout: "pipe", stderr: "ignore" });
      const [code, text] = yield* Effect.all([child.exitCode, child.stdout.pipe(Stream.decodeText, Stream.mkString)], {
        concurrency: 2,
      });
      return { code, text };
    })
  ).pipe(Effect.option);
  if (O.isNone(result) || result.value.code !== 0) {
    const doctorArgs = O.isSome(host) ? ["-o", "BatchMode=yes", "--", host.value, "op-doctor"] : [];
    yield* Effect.scoped(
      Effect.gen(function* () {
        const child = yield* ChildProcess.make(O.isSome(host) ? "ssh" : "op-doctor", doctorArgs, {
          stdout: "inherit",
          stderr: "ignore",
        });
        yield* child.exitCode;
      })
    ).pipe(Effect.ignore);
    return yield* failure(
      "credentials",
      `${command} op read field ${field} failed; op-doctor ran once. Secret path stopped.`
    );
  }
  return Redacted.make(Str.trim(result.value.text));
});

export const loadReviewerCredentials = Effect.gen(function* () {
  const host = yield* Config.option(Config.String("BEEP_REVIEWER_OP_SSH"));
  const resolve = Effect.fn("Reviewer.resolveCredential")(function* (env: string, field: string) {
    const value = yield* Config.option(Config.Redacted(env));
    return O.isSome(value) ? value.value : yield* secretRead(field, host);
  });
  const appId = yield* resolve("BEEP_REVIEWER_APP_ID", "app_id");
  const clientId = yield* resolve("BEEP_REVIEWER_CLIENT_ID", "client_id");
  const installationId = yield* resolve("BEEP_REVIEWER_INSTALLATION_ID", "installation_id");
  const privateKey = yield* resolve("BEEP_REVIEWER_PRIVATE_KEY", "private_key");
  const input = yield* decodeCredentialInput({
    appId: Redacted.value(appId),
    clientId: Redacted.value(clientId),
    installationId: Redacted.value(installationId),
    privateKey,
  });
  return yield* reviewerWire.credentials(input);
}).pipe(
  Effect.mapError((error) =>
    error._tag === "ReviewerError"
      ? error
      : failure("credentials", "Reviewer credentials could not be resolved or validated.")
  )
);

interface GitHubAppAuthShape {
  readonly appId: number;
  readonly token: Effect.Effect<Redacted.Redacted<string>, ReviewerError>;
}

export class GitHubAppAuth extends Context.Service<GitHubAppAuth, GitHubAppAuthShape>()($I`GitHubAppAuth`) {}

export const makeGitHubAppAuth = (credentials: ReviewerCredentials) =>
  Layer.effect(
    GitHubAppAuth,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient;
      const cached = yield* Ref.make(O.none<ReviewerInstallationToken>());
      const lock = yield* Semaphore.make(1);
      const token = Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const previous = yield* Ref.get(cached);
        if (O.isSome(previous) && now < DateTime.toEpochMillis(previous.value.expires_at) - TOKEN_SKEW)
          return previous.value.token;
        const seconds = Math.floor(now / 1000);
        const payload = yield* encodeJwtPayload({
          iat: seconds - JWT_BACKDATE,
          exp: seconds + JWT_LIFETIME,
          iss: credentials.clientId,
        });
        const unsigned = `${JWT_HEADER}.${Buffer.from(payload).toString("base64url")}`;
        const der = yield* Effect.try({
          try: () => {
            const pem = Redacted.value(credentials.privateKey);
            const bytes = Buffer.from(Str.replace(/-----[^-]+-----/g, "")(pem), "base64");
            if (!Str.includes("BEGIN RSA PRIVATE KEY")(pem)) return bytes;
            // PKCS#8 PrivateKeyInfo: version 0, rsaEncryption AlgorithmIdentifier, PKCS#1 OCTET STRING.
            const length = (size: number) => {
              if (size < 128) return Buffer.from([size]);
              const hex = size.toString(16);
              const encoded = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, "hex");
              return Buffer.concat([Buffer.from([0x80 | encoded.length]), encoded]);
            };
            const octets = Buffer.concat([Buffer.from([4]), length(bytes.length), bytes]);
            const content = Buffer.concat([Buffer.from("020100300d06092a864886f70d0101010500", "hex"), octets]);
            return Buffer.concat([Buffer.from([0x30]), length(content.length), content]);
          },
          catch: () => failure("jwt", "Unable to convert the signing key in memory."),
        });
        const key = yield* Effect.tryPromise({
          try: () =>
            crypto.subtle.importKey(
              "pkcs8",
              new Uint8Array(der),
              { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
              false,
              ["sign"]
            ),
          catch: () => failure("jwt", "Unable to import the signing key."),
        });
        const signature = yield* Effect.tryPromise({
          try: () => crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
          catch: () => failure("jwt", "Unable to sign the reviewer JWT."),
        });
        const jwt = Redacted.make(`${unsigned}.${Buffer.from(signature).toString("base64url")}`);
        const request = yield* HttpClientRequest.post(
          `${API}/app/installations/${credentials.installationId}/access_tokens`
        ).pipe(
          HttpClientRequest.setHeaders({
            accept: "application/vnd.github+json",
            authorization: `Bearer ${Redacted.value(jwt)}`,
            "x-github-api-version": "2022-11-28",
          }),
          HttpClientRequest.bodyJson({
            repositories: ["beep-effect"],
            permissions: {
              checks: "write",
              pull_requests: "write",
              issues: "write",
              contents: "read",
              metadata: "read",
            },
          })
        );
        const response = yield* http.execute(request);
        if (response.status !== 201)
          return yield* failure("token", `Installation token exchange returned HTTP ${response.status}.`);
        const fresh = yield* decodeToken(yield* response.json);
        if (DateTime.toEpochMillis(fresh.expires_at) <= now + TOKEN_SKEW)
          return yield* failure("token", "GitHub returned a token with insufficient remaining lifetime.");
        yield* Ref.set(cached, O.some(fresh));
        return fresh.token;
      }).pipe(
        Effect.mapError(() => failure("token", "Reviewer installation token exchange failed.")),
        lock.withPermits(1)
      );
      return GitHubAppAuth.of({ appId: credentials.appId, token });
    })
  );

export const GitHubAppAuthLive = Layer.unwrap(Effect.map(loadReviewerCredentials, makeGitHubAppAuth));
