const config = require("@nicxe/semantic-release-config")({
  kind: "assets",
  projectName: "F1TV Token Helper",
  repoSlug: "Nicxe/f1tv-token-helper",
  assets: [
    {
      path: "dist/f1tv-token-helper.zip",
      label: "f1tv-token-helper.zip",
    },
  ],
});

const githubPlugin = config.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/github",
);

if (githubPlugin?.[1]) {
  githubPlugin[1].successCommentCondition = false;
}

module.exports = config;
