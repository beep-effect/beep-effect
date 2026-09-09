// Single definition of the hosted job environment policy used by
// .github/actions/setup-monorepo-ci. Every Turbo-backed workflow job used to
// hand-copy the credential selection below (quality-lane audit 2026-09-09,
// finding D2: seven copies that had already drifted). The composite action now
// runs this script once per job and appends the result to $GITHUB_ENV.
//
// Policy:
// - Turbo remote cache: trusted `push` events receive read-write access through
//   TURBO_TOKEN; same-repository `pull_request` events receive read-only access
//   through TURBO_READ_TOKEN; forks and every other event stay local-only. A
//   partial credential tuple (missing API host, team, or token) also stays
//   local-only. TURBO_LOG_ORDER=stream streams task logs line by line so a
//   wedged lane task shows its last live output.
// - Application secrets: exported only on `push`. Every other event exports
//   empty values so Turbo's hashed environment stays stable and pull requests
//   never observe them.
//
// Inputs (environment):
//   GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_ENV (runner defaults)
//   BEEP_CI_HEAD_REPOSITORY   github.event.pull_request.head.repo.full_name
//   BEEP_CI_TURBO_REMOTE_CACHE "true" to export the Turbo credential tuple
//   BEEP_CI_APP_SECRETS        "true" to export the application secret block
//   BEEP_CI_TURBO_API          vars.TURBO_API
//   BEEP_CI_TURBO_TEAM         vars.TURBO_TEAM
//   BEEP_CI_SECRET_<NAME>      one variable per secret the policy reads
//                              (TURBO_TOKEN, TURBO_READ_TOKEN, and every
//                              APP_SECRET_NAMES entry), mapped by the composite
//                              action from its explicit inputs. The calling job
//                              passes only those names, never toJSON(secrets),
//                              so no step input carries the repository's secret
//                              inventory. Nothing is printed.
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";

const APP_SECRET_NAMES = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "EMAIL_RESEND_API_KEY",
  "AUTH_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "SECURITY_TRUSTED_ORIGINS",
  "LIVEBLOCKS_SECRET_KEY",
];

const env = process.env;
const outputPath = env.GITHUB_ENV;
if (!outputPath) {
  console.error("ci-job-env: GITHUB_ENV is not set");
  process.exit(1);
}

const secret = (name) => env[`BEEP_CI_SECRET_${name}`] ?? "";

const eventName = env.GITHUB_EVENT_NAME ?? "";
const repository = env.GITHUB_REPOSITORY ?? "";
const headRepository = env.BEEP_CI_HEAD_REPOSITORY ?? "";
const trustedPush = eventName === "push";
const sameRepositoryPullRequest = eventName === "pull_request" && repository !== "" && headRepository === repository;

const entries = [];
const exportEntry = (name, value) => {
  entries.push([name, value]);
};

let turboMode = "not requested";
if (env.BEEP_CI_TURBO_REMOTE_CACHE === "true") {
  const api = env.BEEP_CI_TURBO_API ?? "";
  const team = env.BEEP_CI_TURBO_TEAM ?? "";
  const writeToken = secret("TURBO_TOKEN");
  const readToken = secret("TURBO_READ_TOKEN");
  let selected = { api: "", team: "", token: "", cache: "local:rw", mode: "local-only" };
  if (trustedPush && api !== "" && team !== "" && writeToken !== "") {
    selected = { api, team, token: writeToken, cache: "local:rw,remote:rw", mode: "read-write (trusted push)" };
  } else if (sameRepositoryPullRequest && api !== "" && team !== "" && readToken !== "") {
    selected = {
      api,
      team,
      token: readToken,
      cache: "local:rw,remote:r",
      mode: "read-only (same-repository pull request)",
    };
  }
  exportEntry("TURBO_API", selected.api);
  exportEntry("TURBO_TOKEN", selected.token);
  exportEntry("TURBO_TEAM", selected.team);
  exportEntry("TURBO_CACHE", selected.cache);
  exportEntry("TURBO_LOG_ORDER", "stream");
  exportEntry("BEEP_CI_TURBO_REMOTE_MODE", selected.mode);
  turboMode = selected.mode;
}

let appSecretsMode = "not requested";
if (env.BEEP_CI_APP_SECRETS === "true") {
  for (const name of APP_SECRET_NAMES) {
    exportEntry(name, trustedPush ? secret(name) : "");
  }
  appSecretsMode = trustedPush ? "exported (trusted push)" : "blank";
}

// GITHUB_ENV heredoc form: a random delimiter keeps any value shape (including
// newlines) intact without ever echoing the value to the step log.
const rendered = entries
  .map(([name, value]) => {
    const delimiter = `beep_ci_env_${randomUUID()}`;
    return `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  })
  .join("");
appendFileSync(outputPath, rendered);
console.log(`ci-job-env: turbo remote cache ${turboMode}; application secrets ${appSecretsMode}`);
