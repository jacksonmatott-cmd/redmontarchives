# Redmont Archives 2.0.1

The main deliverable is **`Redmont-Archives-Cloudflare-Upload.zip`**. It contains the finished site with `index.html`, `_worker.js`, the browser bundle, styles, and assets at the ZIP root. It needs no application build or separate database upgrade.

## Deploy

For a Cloudflare Pages **Direct Upload** project, upload the ZIP and deploy.

For the existing **Git-connected `redmontarchives` project**, extract the ZIP and double-click `DEPLOY-CLOUDFLARE.cmd`. Sign in to Cloudflare if prompted. The launcher uploads the prebuilt site; it does not run an application build or ask you to execute SQL. It requires Node.js installed once. Cloudflare does not offer dashboard ZIP uploads on Git-connected projects.

Keep your existing D1 database attached with the binding name **`DB`**. The site automatically applies missing database upgrades on first API access. Existing accounts, passwords, sessions, owners, IDs and content are retained. A completely new Pages project requires selecting its D1 binding once; an upload cannot choose an account-owned database by itself.

Optional encrypted `GROQ_API_KEY` and `GROQ_MODEL` runtime settings continue to work. Without a provider key, search and archive answers still return matching published passages with source links.

## Included features

- Shared rich editor for main archive records and organization pages, including images, tables, fonts, colors, headings, headers/footers, links, alignment, checklists, lists, preview and undo/redo.
- Public formatted views, edited content refresh, drafts, publishing, trash, revision restore, audit history and conflict checks.
- Signup, login, logout, password changes and one-time recovery codes.
- Organization directory, owner/editor/viewer permissions, settings, reversible archiving and exports.
- Eight archive collections, published-record search, source links and optional model summaries.
- Automatic versioned schema upgrades, including simultaneous-startup handling and retry after an interrupted upgrade.

Only the account named `kaelzvx` can create or edit main archive records. Organization pages remain under their owners' and assigned editors' control. Existing users should generate a password-recovery code in Account; new registrations receive one immediately. Reset uses username plus recovery code because the original system has no verified email addresses.

HTTPS image URLs are supported; binary uploads are not required. Document headers/footers are content sections. Optional model answers should be checked against their linked records.

## Future releases

`AGENTS.md` records the user's standing requirement: every Redmont version must include a finished Cloudflare upload ZIP and automatic compatible database upgrades. A source archive alone is not a release.

## Developer source only

This complete source package is secondary to the upload ZIP. Developers can run:

```sh
npm ci
npm test
npm run package
```

Packaging builds the application and writes both the upload ZIP and this source ZIP to the parent folder. Users of the upload ZIP do not need those commands.

Do not modify a previously shipped SQL migration. Add a new ordered migration, test an upgrade from the previous version, rebuild, then verify the extracted upload archive. All server migration statements and version markers are bundled into `_worker.js`.

For a local sample site, use `START-WINDOWS.cmd`, or run `npm run demo` and `npm run dev` after building. Local sample login: `kaelzvx` / `RedmontDemo-2026!`. Sample accounts and data stay under `.local` and are excluded from deployment.

The live domain has not been deployed by creation of this package. See `docs/VALIDATION.md` for verification and limits.
