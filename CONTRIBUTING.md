# How to Contribute

We'd love to accept your patches and contributions to this project. There are a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a  Developer Certificate of Origin (DCO). You (or your employer) retain the copyright to your contribution; this gives us permission to use and redistribute your contributions as part of the project. Head over to <https://developercertificate.org/> to see your current agreements on file or to sign a new one.

You only need to submit a DTO once, so if you've already submitted one (even if it was for a different project), you probably don't need to do it again.

## Commit Guidelines

Commits to this project must follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification, especially the commit message structure.

Besides, we recommend that you could use [gitmoji](https://gitmoji.dev/related-tools) tool in your IDE to add proper emoji prefix to each commit.

## Code reviews

All submissions, including submissions by project members, require review. We use GitHub pull requests for this purpose. Consult [GitHub Help](https://help.github.com/articles/about-pull-requests/) for more information on using pull requests.

## Testing

### Debugging in VS Code

VS Code provides awesome Node.js debugging features, including the ability to automatically attach debugging to certain Node.js processes that have been launched from VS Code's Integrated Terminal.

Please refer this [guide](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_auto-attach) to toggle "Auto Attach" feature, and the default `smart` mode is already good enough for debugging our framework.

Once set up Auto Attach, you can create some breakpoints in your codes and run `npm t` in VS Code's Integrated Terminal to check whether the breakpoints work as expected.

> After enabling Auto Attach, you'll need to restart your terminal. This can be done by clicking the ⚠ icon in the top right of the terminal, or just creating a new one.

### Unit Tests

All pull requests should have an associated test to ensure foward compatibility.

> Make sure you have installed [Dapr](https://dapr.io/) before running unit tests, check out [Install Dapr CLI](https://docs.dapr.io/getting-started/install-dapr-cli/) for more details

To run an individual test, you can run a command such as the following:

```sh
npm run test -- -g 'loading function'
```

### Manual Testing

When developing a feature locally, you can install a local version of the Functions Framework using `npm link`. First compile your local clone of the Functions Framework:

> You'll need to install typescript first by: `npm install typescript --save-dev`

```sh
npx tsc
```

Then link the Functions Framework using `npm link`.

```sh
npm link
```

You can then run the Functions Framework locally using `functions-framework`.

## Publishing (Admins only)

This module is published using Release Please. When you merge a release PR, the npm package will be automatically published.

```sh
# Login to npm registry, contact repo admin for https://www.npmjs.com/ user name and password
npm login
# First run a dry run to find out errors
npm publish ./ --access public --dry-run
# Then publish the package
npm publish --access public
```

### Reverting a Publish

If the release process fails, you can revert the publish by running the following (i.e. unpublishing `1.10.0`):

```sh
# Unpublish the package (must be done within 72 hours of publishing).
# If >72 hours, deprecate a specific release and publish a newer version.
# i.e. `npm deprecate @openfunction/functions-framework@0.3.6 "archive old version"` 
# See https://docs.npmjs.com/policies/unpublish#what-to-do-if-your-package-does-not-meet-the-unpublish-criteria
npm unpublish @openfunction/functions-framework@0.3.6
# Set the default version to the previous working version.
npm dist-tag add @openfunction/functions-framework@0.3.3 latest
```

### API Extractor

To generate the API Extractor documentation, run the API extractor with the following command:

> You'll need to install `api-extractor` first by `npm install -g @microsoft/api-extractor` and then install `gts` by `npm install gts`

```sh
npm run docs
```

The docs will be generated in [`docs/generated/`](docs/generated/).

## Community Guidelines

This project follows [CNCF openness guidelines](https://www.cncf.io/blog/2019/06/11/cncf-openness-guidelines/).
