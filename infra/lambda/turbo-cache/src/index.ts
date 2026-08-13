/**
 * Read-only shim entrypoint: the deployed reader Lambda serves GET/HEAD and
 * event acknowledgements directly from turborepo-remote-cache with
 * `READ_ONLY=true` and an S3-read-only role.
 *
 * @category handlers
 * @since 0.0.0
 */
export { handler } from "turborepo-remote-cache/aws-lambda";
