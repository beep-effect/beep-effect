import { signedRequestFromEvent } from "./event.ts";
import { constantTimeEqual, signRequest } from "./hmac.ts";
import { loadAuthorizerSecrets } from "./ssm.ts";
import type { HttpApiEvent } from "./event.ts";
import type { AuthorizerSecrets } from "./ssm.ts";

type AuthorizerResponse = {
  readonly context: Readonly<Record<string, string>>;
  readonly isAuthorized: boolean;
};

type AuthorizerDependencies = {
  readonly loadSecrets: () => Promise<AuthorizerSecrets>;
};

const deny = (): AuthorizerResponse => ({ isAuthorized: false, context: {} });
const allow = (context: Readonly<Record<string, string>> = {}): AuthorizerResponse => ({
  isAuthorized: true,
  context,
});

const artifactPathPattern = /^\/v8\/artifacts\/[^/]+$/u;
const nonArtifactPaths = new Set(["/v8/artifacts/clean", "/v8/artifacts/events", "/v8/artifacts/status"]);

const isArtifactPath = (rawPath: string): boolean =>
  artifactPathPattern.test(rawPath) && !nonArtifactPaths.has(rawPath);

const isReadRequest = (method: string, rawPath: string): boolean => {
  if (method === "GET" && rawPath === "/v8/artifacts/status") return true;
  if ((method === "GET" || method === "HEAD") && isArtifactPath(rawPath)) return true;
  if (method === "POST" && rawPath === "/v8/artifacts") return true;
  return method === "POST" && rawPath === "/v8/artifacts/events";
};

const isWriteRequest = (method: string, rawPath: string): boolean => method === "PUT" && isArtifactPath(rawPath);

const authorizationHeader = (headers: HttpApiEvent["headers"]): string | undefined => {
  if (headers === undefined) return undefined;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "authorization") return value;
  }
  return undefined;
};

const bearerToken = (headers: HttpApiEvent["headers"]): string | undefined => {
  const header = authorizationHeader(headers)?.trim();
  if (header === undefined || header.length === 0) return undefined;
  const match = /^Bearer\s+(.+)$/iu.exec(header);
  const token = (match?.[1] ?? header).trim();
  return token.length === 0 ? undefined : token;
};

export const createAuthorizerHandler =
  ({ loadSecrets }: AuthorizerDependencies) =>
  async (event: HttpApiEvent): Promise<AuthorizerResponse> => {
    try {
      const token = bearerToken(event.headers);
      if (token === undefined) return deny();

      const secrets = await loadSecrets();
      const matchesRead = constantTimeEqual(token, secrets.readOnlyToken);
      const matchesWrite = constantTimeEqual(token, secrets.trustedWriteToken);
      if (matchesRead === matchesWrite) return deny();

      const { method, rawPath } = signedRequestFromEvent(event);
      if (isReadRequest(method, rawPath)) return allow();
      if (!matchesWrite || !isWriteRequest(method, rawPath)) return deny();

      return allow({
        writerSignature: signRequest(secrets.writerSharedSecret, signedRequestFromEvent(event)),
      });
    } catch {
      return deny();
    }
  };

export const handler = createAuthorizerHandler({ loadSecrets: loadAuthorizerSecrets });
