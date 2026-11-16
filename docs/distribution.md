# Distribution

The unit is one public npm package, `@jhzhuo/kago`, containing the page launcher, loopback service, sync engine, optional `kago` CLI and README icon assets. `package.json` declares `magpie.page`, its service and bilingual summary, alongside the ESM host `main`. It uses the established community page-with-host-part pattern.

## Published package

Install with `magpie plugin add @jhzhuo/kago`; Magpie resolves the package dependencies. The optional standalone CLI is installed with `npm install --global @jhzhuo/kago`. The npm package contains the runtime and documentation, so installing it does not require access to the source repository.

`magpie.name` and `magpie.icon` describe the market card; `magpie.page.icon` points to the bundled sidebar image. README images use relative paths to the assets included in the repository and package.

## Local package

Install the checkout directly with `magpie plugin add /absolute/path/to/checkout`. This has been verified in the official desktop app. A packed copy extracted into a clean directory also loads in an isolated official Magpie host, including dependency resolution. `npm pack` builds the artifact without publishing; unpack it and pass the extracted package directory to Magpie to test it elsewhere.

The checkout must remain available while installed by path. To refresh code, disable and enable this plugin (or restart Magpie). Its host retries a port held briefly by a previous host, without blocking other plugins; a permanent port conflict needs a different port in Options.

## Marketplace registration

Register the published package in `magpie-community/plugins/registry.json` with `package: "@jhzhuo/kago"`, `name: "Kago"`, `kind: "page"`, an HTTPS icon URL and English/Chinese summaries. An independently maintained package omits `community` and `providers`. Publishing a package does not itself add a registry listing.

Submit the entry as a pull request to the community repository. The registry is cached for up to six hours. A public GitHub repository carrying the `magpie-plugin` topic can also appear in GitHub discovery; this is separate from npm installation and registry review.

## Continuous integration

`.github/workflows/ci.yml` checks every branch push and pull request on Ubuntu and macOS with Node 22 and 24. Each job installs dependencies with the frozen Bun lockfile, checks JavaScript syntax and formatting, runs the tests and inspects the npm package file list. It can also be started manually from Actions.

## Automated releases

Pushing a `vMAJOR.MINOR.PATCH` tag starts `.github/workflows/release.yml`. Tags are separate from branch pushes: the tagged commit must already be reachable from `main`, and the tag version must match `package.json`. Prerelease tags are not accepted by this workflow.

The release job runs the checks again, packs the exact tagged checkout, publishes the tarball to npm with provenance, and creates a GitHub Release with the same tarball attached. Its body combines `docs/releases/<version>.md` (English, then `## 中文`) with GitHub's generated change notes. The health endpoint reads the package version directly; the market icon uses the repository asset, so neither needs a separate version bump.

### One-time npm setup

Configure a Trusted Publisher for `@jhzhuo/kago` on npm:

- Provider: GitHub Actions.
- Repository: `ffy6511/Kago`.
- Workflow filename: `release.yml`.
- Environment: leave blank.
- Allowed actions: enable direct `npm publish`.

The same configuration can be created with the npm CLI after the workflow is pushed:

```sh
npm trust github @jhzhuo/kago --file release.yml --repo ffy6511/Kago \
  --allow-publish --registry=https://registry.npmjs.org/ -y
```

npm may ask the package owner to complete two-factor verification for this one-time account change. Actions then uses OIDC through `id-token: write`; no `NPM_TOKEN` secret or interactive login is needed in the workflow. The GitHub repository must permit Actions to create releases with `contents: write`.

### Publish a version

Update `package.json`, run `bun install --lockfile-only` to synchronize the lockfile, and add bilingual notes at `docs/releases/<version>.md`. Commit those files and merge them to `main`. For example, once the version is `0.1.1`:

```sh
git switch main
git pull --ff-only
git tag -a v0.1.1 -m "Kago v0.1.1"
git push origin main
git push origin v0.1.1
```

The first release managed by these workflows must use a new version; `0.1.0` was already published manually. Runs for the same tag are serialized without canceling a running publish. If npm publication succeeded but GitHub Release creation failed, rerun the failed job: it compares the packed tarball's integrity against npm, skips an identical published version, and finishes the release. A version already published with different contents fails without overwriting it. Repeated runs update the attached tarball while preserving an existing release's text.

Reference: https://github.com/magpie-community/plugins#pages
