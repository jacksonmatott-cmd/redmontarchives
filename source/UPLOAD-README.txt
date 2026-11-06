REDMONT ARCHIVES 2.0.1 - FINISHED CLOUDFLARE UPLOAD

DIRECT UPLOAD PROJECT
Upload Redmont-Archives-Cloudflare-Upload.zip to Cloudflare Pages and deploy.
The ZIP already has index.html, _worker.js and every asset at its top level.

YOUR EXISTING GIT-CONNECTED PROJECT
Extract the ZIP and double-click DEPLOY-CLOUDFLARE.cmd. Sign in to Cloudflare
if asked. This uploads the finished site to redmontarchives without a build.
The launcher needs Node.js installed once; it explains this if Node is absent.
Cloudflare does not provide dashboard ZIP upload for Git-connected projects.

The site upgrades the database automatically. Keep your existing D1 database
attached with binding name DB. Your accounts, owners and records are retained.
An upload cannot attach an account-owned database on your behalf; a new Pages
project must have that binding selected once in its Cloudflare settings.

All future Redmont releases use this prebuilt upload and automatic upgrade
format. No separate npm install/build or SQL commands are required of you.
