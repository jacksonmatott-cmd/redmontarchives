# Redmont Archives project instructions

The preferred delivery is now an update to the existing `jacksonmatott-cmd/redmontarchives` GitHub repository and its connected Cloudflare Pages project. Preserve the existing custom domain, DNS and D1 binding. Commit prebuilt runtime files at the repository root and in `dist/`, with editable source under `source/`, so the existing root-output or dist-output deployment can continue. Do not ask the user to recreate the project, reconnect DNS, run a launcher, or move files for a routine GitHub release. Use a guarded update of the current branch head and preserve intervening changes.

When a downloadable release is requested, also follow the ready-upload rules below.

The user wants a finished, working Cloudflare upload for every future version.

- Deliver a prebuilt `Redmont-Archives-Cloudflare-Upload.zip` as the primary download. Its ZIP root must contain `index.html`, `_worker.js`, `app.js`, styles, assets, and `_routes.json`, with no enclosing project or `dist` directory.
- Never require the user to build, run npm install, find a dist folder, copy individual source files, or execute a separate SQL migration to use a release.
- Retain the existing D1 `DB` binding, users, passwords, organization ownership, IDs and records. Handle additive database upgrades automatically in the server before serving API traffic.
- Keep shipped migration files immutable. Future schema changes belong in a new ordered migration. Test upgrade from a legacy database and from the preceding release. Handle simultaneous startup and do not run migrations once their version is recorded.
- Cloudflare prevents dashboard drag-and-drop for Git-connected projects. Include a `DEPLOY-CLOUDFLARE.cmd` with the prebuilt upload for the existing `redmontarchives` project. It must deploy the ready files without a local build or manual database command. Cloudflare sign-in and a missing DB binding are the only external setup dependencies to explain when applicable.
- Keep the full editable source package as a secondary deliverable; update its existing file identity. Do not substitute a source archive for the primary upload archive.
- Verify the primary ZIP by extracting it to a new folder and running that exact `_worker.js` with its assets. Exercise cold-start initialization against an existing legacy database and the editor/account/publishing paths.
- Save the upload-ready and source artifacts after testing, then give the primary upload link and only the few steps the user actually needs.
