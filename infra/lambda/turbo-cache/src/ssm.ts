import { GetParameterCommand, GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { GetParameterCommandOutput, GetParametersCommandOutput } from "@aws-sdk/client-ssm";

export const SECRET_CACHE_TTL_MS = 5 * 60 * 1_000;

type Clock = () => number;

type CacheEntry<Value> = {
  readonly expiresAt: number;
  readonly value: Promise<Value>;
};

type GetParametersClient = {
  readonly send: (command: GetParametersCommand) => Promise<GetParametersCommandOutput>;
};

type GetParameterClient = {
  readonly send: (command: GetParameterCommand) => Promise<GetParameterCommandOutput>;
};

export type AuthorizerSecrets = {
  readonly readOnlyToken: string;
  readonly trustedWriteToken: string;
  readonly writerSharedSecret: string;
};

export type AuthorizerSecretEnvironment = {
  readonly READ_ONLY_TOKEN_SSM_PARAMETER_ARN?: string;
  readonly TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN?: string;
  readonly WRITER_SHARED_SECRET_SSM_PARAMETER_ARN?: string;
};

export type WriterSecretEnvironment = {
  readonly WRITER_SHARED_SECRET_SSM_PARAMETER_ARN?: string;
};

const required = (value: string | undefined, name: string): string => {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

// GetParameters echoes plain parameter paths in `Name` even when queried by
// full ARN; the requested ARN only appears in the `ARN` response field.
const nonEmptyParameterValue = (output: GetParametersCommandOutput, name: string): string => {
  const value = output.Parameters?.find((parameter) => parameter.Name === name || parameter.ARN === name)?.Value;
  if (value === undefined || value.length === 0) {
    throw new Error(`SSM parameter did not resolve to a non-empty value: ${name}`);
  }
  return value;
};

export const createAuthorizerSecretsLoader = (
  client: GetParametersClient,
  environment: AuthorizerSecretEnvironment,
  now: Clock = Date.now
): (() => Promise<AuthorizerSecrets>) => {
  let cache: CacheEntry<AuthorizerSecrets> | undefined;

  return async () => {
    const currentTime = now();
    if (cache !== undefined && cache.expiresAt > currentTime) {
      return cache.value;
    }

    const readOnlyTokenArn = required(
      environment.READ_ONLY_TOKEN_SSM_PARAMETER_ARN,
      "READ_ONLY_TOKEN_SSM_PARAMETER_ARN"
    );
    const trustedWriteTokenArn = required(
      environment.TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN,
      "TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN"
    );
    const writerSharedSecretArn = required(
      environment.WRITER_SHARED_SECRET_SSM_PARAMETER_ARN,
      "WRITER_SHARED_SECRET_SSM_PARAMETER_ARN"
    );
    const names = [readOnlyTokenArn, trustedWriteTokenArn, writerSharedSecretArn];
    const value = client.send(new GetParametersCommand({ Names: names, WithDecryption: true })).then((output) => {
      if ((output.InvalidParameters?.length ?? 0) > 0) {
        throw new Error("One or more SSM parameters were invalid");
      }
      return {
        readOnlyToken: nonEmptyParameterValue(output, readOnlyTokenArn),
        trustedWriteToken: nonEmptyParameterValue(output, trustedWriteTokenArn),
        writerSharedSecret: nonEmptyParameterValue(output, writerSharedSecretArn),
      };
    });
    const nextCache = { expiresAt: currentTime + SECRET_CACHE_TTL_MS, value };
    cache = nextCache;

    try {
      return await value;
    } catch (error) {
      if (cache === nextCache) {
        cache = undefined;
      }
      throw error;
    }
  };
};

export const createWriterSecretLoader = (
  client: GetParameterClient,
  environment: WriterSecretEnvironment,
  now: Clock = Date.now
): (() => Promise<string>) => {
  let cache: CacheEntry<string> | undefined;

  return async () => {
    const currentTime = now();
    if (cache !== undefined && cache.expiresAt > currentTime) {
      return cache.value;
    }

    const name = required(environment.WRITER_SHARED_SECRET_SSM_PARAMETER_ARN, "WRITER_SHARED_SECRET_SSM_PARAMETER_ARN");
    const value = client.send(new GetParameterCommand({ Name: name, WithDecryption: true })).then((output) => {
      const secret = output.Parameter?.Value;
      if (secret === undefined || secret.length === 0) {
        throw new Error(`SSM parameter did not resolve to a non-empty value: ${name}`);
      }
      return secret;
    });
    const nextCache = { expiresAt: currentTime + SECRET_CACHE_TTL_MS, value };
    cache = nextCache;

    try {
      return await value;
    } catch (error) {
      if (cache === nextCache) {
        cache = undefined;
      }
      throw error;
    }
  };
};

const ssmClient = new SSMClient({});

export const loadAuthorizerSecrets = createAuthorizerSecretsLoader(
  { send: (command) => ssmClient.send(command) },
  {
    READ_ONLY_TOKEN_SSM_PARAMETER_ARN: process.env.READ_ONLY_TOKEN_SSM_PARAMETER_ARN,
    TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN: process.env.TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN,
    WRITER_SHARED_SECRET_SSM_PARAMETER_ARN: process.env.WRITER_SHARED_SECRET_SSM_PARAMETER_ARN,
  }
);

export const loadWriterSecret = createWriterSecretLoader(
  { send: (command) => ssmClient.send(command) },
  {
    WRITER_SHARED_SECRET_SSM_PARAMETER_ARN: process.env.WRITER_SHARED_SECRET_SSM_PARAMETER_ARN,
  }
);
