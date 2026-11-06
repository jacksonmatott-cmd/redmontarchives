# Redmont Archives 2.0.1 — November 3, 2026

## Finished upload delivery

The primary download is now `Redmont-Archives-Cloudflare-Upload.zip`, with all finished assets at the ZIP root. There is no application build, dist-folder hunting or separate SQL command for the user.

The server applies versioned, additive database upgrades automatically before serving API requests. Completed migrations are recorded, simultaneous startup is handled, and failed upgrades can retry. Existing accounts, sessions, ownership and content are retained.

The upload includes `DEPLOY-CLOUDFLARE.cmd` for the existing Git-connected project, which Cloudflare excludes from dashboard drag-and-drop. It deploys the prebuilt files with the user's Cloudflare sign-in and needs Node.js installed once. Direct Upload projects can upload the ZIP in their dashboard. The existing D1 binding must remain named `DB`.

The same delivery requirements are recorded for every future Redmont release in `AGENTS.md`. There are 19 passing automated tests, plus a successful extracted-ZIP Cloudflare runtime check against a legacy database.

## Earlier 2.0 feature work

## Fixed from the inspected repository

- Removed Markdown code fences from the HTML and stylesheet. The root document begins with a real doctype.
- Replaced public templates that escaped all saved editor content. Both main archive records and organization pages now display sanitized rich HTML.
- Removed duplicate and placeholder search/create code. Searches query actual public data; record creation persists to the database.
- Closed the unauthenticated `/api/create-page` write path. Its compatibility alias now uses the same server-side permissions as the normal editor.
- Unified create/edit/load/publish paths so a saved edit is fetched again when viewing the record. Public API responses are not cached.
- Replaced legacy signup destinations with `/register`, including redirects from `/signup.html` and `/register.html`.
- Added a usable password-recovery flow for accounts without email fields, including code rotation and session revocation.
- Removed public debug endpoints and raw database error responses.
- Added the two previously missing archive collections, Organizations and Other Records.
- Corrected selected font sizes to use saved pixel values rather than browser keywords that disappear during sanitization.

## Completed platform flows

- One shared rich editor, preview, draft recovery and sources for both types of records.
- Public record and organization page views, working collections, directory, search, account area and mobile layouts.
- Organization owner/editor/viewer roles and guarded team settings.
- Draft/published/trash states, versioned revisions, restore, audit history and conflict detection.
- Reversible organization archiving and owner data export.
- Public archive search with sources, plus optional Groq answers and a provider-independent excerpt fallback.
- Existing password-format compatibility and additive D1 migration.
- Local Windows demo and complete prebuilt Pages output.

## Practical limits

This release was tested with local fixtures and Cloudflare's local Worker/D1 runtime. The production database and deployed domain were not changed or exhaustively audited. The live domain was unavailable to the initial public-page lookup; the source repository was the authoritative code input.

Password reset uses recovery codes, not email. Existing accounts must establish a code while logged in. HTTPS image insertion is supported; binary image uploads are not included. Headers and footers are document sections. Rich editing uses the browser's content-editing commands; modern desktop Chrome/Edge is the primary tested environment.

Search returns up to 30 ranked matches, using at most 100 candidate records per content type. Large deployments may benefit from a later full-text index. Directory listings are capped at 500 organizations; revision and audit views show the latest 100 entries, while exports include the complete owned revision history.

The optional external model was not called with a production key. Provider failure, missing configuration, or invalid citations falls back to published passages. Model-generated statements still require source checking.
