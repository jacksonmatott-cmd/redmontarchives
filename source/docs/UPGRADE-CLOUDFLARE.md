# Deploy the finished upload

**Direct Upload project:** upload `Redmont-Archives-Cloudflare-Upload.zip` and deploy.

**Existing Git-connected project:** extract the ZIP, run `DEPLOY-CLOUDFLARE.cmd`, and sign in to Cloudflare if prompted. The launcher requires Node.js installed once; it uploads the finished assets to the existing `redmontarchives` project with no application build or separate SQL action.

Keep the current D1 database attached as `DB`. The server creates missing feature tables and records versioned upgrades automatically, while retaining existing accounts, ownership and records. Reopening the site or deploying the next version does not repeat completed migrations.

For a new Pages project, attach your intended D1 database as `DB` once in its runtime bindings. Do not create a different database for an existing installation. Optional encrypted provider settings can stay attached.

Cloudflare permits ZIP drag-and-drop for Direct Upload projects, but not Git-connected projects. The included launcher handles the latter through Cloudflare's supported upload command.

References: [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) and [Pages database bindings](https://developers.cloudflare.com/pages/functions/bindings/).
