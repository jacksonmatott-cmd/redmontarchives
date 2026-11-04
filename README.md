# Redmont Archives

This repository updates the existing Cloudflare Pages project for **redmontarchives.com**. Keep the current project, custom domain, DNS records and D1 binding named `DB`.

The repository includes the finished site at its root and in `dist/`. Existing deployments that publish either location can use it without a local build. If the existing build command is `npm run build`, the included build script copies the same finished files into `dist/`.

The server automatically applies compatible database upgrades while retaining existing accounts, passwords, owners and records. Main archive editing stays restricted to `kaelzvx`.

Editable application code and its tests are in [`source/`](source/). For development, run `npm ci`, `npm test`, and `npm run build` from that directory. Publish the resulting files in the repository root and `dist/` together. Source and build metadata are blocked by the site's HTTP handler.

Future updates should be committed to this existing repository and deployed through the same connected Cloudflare Pages project. A routine update does not require reconnecting DNS or moving the domain to a different project. The ready-upload ZIP remains an alternate download, rather than a required deployment step.

Validated before this update: 20 automated tests, including automatic legacy database upgrades, publishing, password recovery, permissions and protection of source paths. The upload version was also tested in Cloudflare's local runtime.
