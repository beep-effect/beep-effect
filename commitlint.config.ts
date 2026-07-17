export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message: string) => /^Squashed '[^']+' content from commit [0-9a-f]+(?:\n|$)/u.test(message)],
  rules: {
    "body-max-line-length": [2, "always", 100],
  },
};
