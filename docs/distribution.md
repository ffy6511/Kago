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

Future versions increment `package.json` and update versioned image URLs before publication. Run the project checks, pack and inspect the artifact, then verify installation in an isolated Magpie configuration. Publish with `npm publish --access public --registry=https://registry.npmjs.org/`; npm may require browser or two-factor verification.

Reference: https://github.com/magpie-community/plugins#pages
