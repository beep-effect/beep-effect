import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Request identity triple both sides of the writer HMAC sign.
 *
 * @category models
 * @since 0.0.0
 */
export type SignedRequest = {
  readonly method: string;
  readonly rawPath: string;
  readonly requestId: string;
};

const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

/**
 * Timing-safe string equality over fixed-length sha256 digests, so inputs of
 * different lengths never short-circuit.
 *
 * @category utilities
 * @since 0.0.0
 */
export const constantTimeEqual = (left: string, right: string): boolean => timingSafeEqual(digest(left), digest(right));

/**
 * Canonical newline-joined message the authorizer and writer both sign.
 *
 * @category utilities
 * @since 0.0.0
 */
export const signatureMessage = ({ requestId, method, rawPath }: SignedRequest): string =>
  `${requestId}\n${method}\n${rawPath}`;

/**
 * Mint the hex HMAC-SHA256 signature for an allowed artifact write.
 *
 * @category utilities
 * @since 0.0.0
 */
export const signRequest = (secret: string, request: SignedRequest): string =>
  createHmac("sha256", secret).update(signatureMessage(request), "utf8").digest("hex");

/**
 * Verify a writer signature by re-deriving it and comparing constant-time.
 *
 * @category utilities
 * @since 0.0.0
 */
export const verifyRequestSignature = (secret: string, request: SignedRequest, signature: string): boolean =>
  constantTimeEqual(signRequest(secret, request), signature);
