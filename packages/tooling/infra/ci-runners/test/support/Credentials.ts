/**
 * Test-only App credentials that pass the production loader's shape checks
 * and authenticate nothing: a structural PEM block with a filler body (no
 * real key), and a webhook secret of hex digits. The PEM header is built at
 * runtime so no committed text looks like a private key.
 */
import * as A from "effect/Array";
import * as Base64 from "effect/encoding/Base64";
import * as Str from "effect/String";

const label = A.join(["RSA", "PRIVATE", "KEY"], " ");
const body = A.join(A.replicate(Str.repeat(64)("A"), 26), "\n");

/** A base64 PEM-shaped block the loader accepts; it is not a usable key. */
export const fakeAppKeyBase64 = Base64.encode(`-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`);

/** A 32-character hex webhook secret with 16 distinct characters. */
export const fakeWebhookSecret = A.join(
  A.makeBy(32, (index) => (index % 16).toString(16)),
  ""
);

/** The three production variables, set to the fakes. */
export const productionCredentialEnv = {
  CI_RUNNERS_GITHUB_APP_ID: "12345",
  CI_RUNNERS_GITHUB_APP_KEY_BASE64: fakeAppKeyBase64,
  CI_RUNNERS_GITHUB_WEBHOOK_SECRET: fakeWebhookSecret,
};
