const githubModule = require("@changesets/changelog-github");
const fallbackModule = require("@changesets/cli/changelog");

const githubChangelog = githubModule.default ?? githubModule;
const fallbackChangelog = fallbackModule.default ?? fallbackModule;

const transientGitHubErrorMessages = [
  "Timeout on validation of query",
  "An error occurred when fetching data from GitHub",
  "Failed to parse data from GitHub",
  "GITHUB_TOKEN",
];

const errorMessage = (error) => (error instanceof Error ? error.message : String(error));

const transientGitHubError = (error) => {
  const message = errorMessage(error);
  return transientGitHubErrorMessages.some((transientMessage) => message.includes(transientMessage));
};

const fallbackWithWarning = async (operation, error, fallback) => {
  const message = errorMessage(error);
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
