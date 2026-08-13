import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type SignedRequest = {
  readonly method: string;
  readonly rawPath: string;
  readonly requestId: string;
};

const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

export const constantTimeEqual = (left: string, right: string): boolean => timingSafeEqual(digest(left), digest(right));

export const signatureMessage = ({ requestId, method, rawPath }: SignedRequest): string =>
  `${requestId}\n${method}\n${rawPath}`;

export const signRequest = (secret: string, request: SignedRequest): string =>
  createHmac("sha256", secret).update(signatureMessage(request), "utf8").digest("hex");

export const verifyRequestSignature = (secret: string, request: SignedRequest, signature: string): boolean =>
  constantTimeEqual(signRequest(secret, request), signature);
