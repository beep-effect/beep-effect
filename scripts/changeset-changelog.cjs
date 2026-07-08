const githubModule = require("@changesets/changelog-github");
const fallbackModule = require("@changesets/cli/changelog");

const githubChangelog = githubModule.default ?? githubModule;
const fallbackChangelog = fallbackModule.default ?? fallbackModule;

const transientGitHubError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Timeout on validation of query") ||
    message.includes("An error occurred when fetching data from GitHub") ||
    message.includes("Failed to parse data from GitHub") ||
    message.includes("GITHUB_TOKEN")
  );
};

const fallbackWithWarning = async (operation, error, fallback) => {
  const message = error instanceof Error ? error.message : String(error);
  if (!transientGitHubError(error)) {
    throw error;
  }
  process.stderr.write(
    `[changeset-changelog] GitHub changelog enrichment failed during ${operation}; using plain changelog fallback.\n${message}\n`
  );
  return fallback();
};

exports.getReleaseLine = async (changeset, type, options) =>
  githubChangelog
    .getReleaseLine(changeset, type, options)
    .catch((error) =>
      fallbackWithWarning("release line generation", error, () =>
        fallbackChangelog.getReleaseLine(changeset, type, options)
      )
    );

exports.getDependencyReleaseLine = async (changesets, dependenciesUpdated, options) =>
  githubChangelog
    .getDependencyReleaseLine(changesets, dependenciesUpdated, options)
    .catch((error) =>
      fallbackWithWarning("dependency release line generation", error, () =>
        fallbackChangelog.getDependencyReleaseLine(changesets, dependenciesUpdated, options)
      )
    );
