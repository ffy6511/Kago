# Distribution

The unit is one npm-compatible package, `@ffy6511/magpie-skill-workspaces`, containing the page launcher, loopback service, sync engine and optional CLI. `package.json` declares `magpie.page`, its service and bilingual summary, alongside the ESM host `main`. It uses the established community page-with-host-part pattern.

## Local package

Install the checkout directly with `magpie plugin add /absolute/path/to/checkout`. This has been verified in the official desktop app. A packed copy extracted into a clean directory also loads in an isolated official Magpie host, including dependency resolution. `npm pack` builds the artifact without publishing; unpack it and pass the extracted package directory to Magpie to test it elsewhere.

The checkout must remain available while installed by path. To refresh code, disable and enable this plugin (or restart Magpie). Its host retries a port held briefly by a previous host, without blocking other plugins; a permanent port conflict needs a different port in Options.

## Later marketplace release

A private GitHub repository is compatible with local development and installation. A future public distribution needs an accessible package artifact, an appropriate license (the current private source is UNLICENSED), a reviewed minimum Magpie version, and a community registry submission using `kind: page`. Publishing a package does not itself add a registry listing. No public release, registry submission or publication of this private repository is part of this task.

Reference: https://github.com/magpie-community/plugins#pages
