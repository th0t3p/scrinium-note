# Change Log

## Unreleased — 0.1.0 community snapshot

- User authorized publishing the community snapshot to public `th0t3p/scrinium-community`. Verified the acting SSH identity, community extraction hashes, commit authors and tracked-file credential/artifact scan; no private repository history is included. Public push verification will be recorded after upload.
- Clarified the English and Chinese README: the download is source, not a desktop installer; documented first setup, later startup and Docker stop commands. Moved optional developer tests out of the end-user startup path. Documentation checked against package scripts and Compose; application code and license are unchanged.
- Extracted an isolated browser-only Scrinium community edition with basic Markdown editing, encrypted local persistence, local search, folders, outline, recoverable trash, import, backup, recovery and password changes. Separate IndexedDB storage never opens the production app's database.
- Removed online accounts, cloud services, payment and Pro features. Optional nonroot Docker/Nginx serves static files only; notes remain in each browser's database. No runtime credentials or environment variables are required.
- Included the unmodified PolyForm Noncommercial 1.0.0 license, third-party license texts and a feature-frozen/manual-upstream-review policy. Upstream checks report changes without importing code.
- Validated on 2026-11-18: crypto/search suites, 14 vault behavior checks, TypeScript, production build, dependency audit (0 reported vulnerabilities), source boundary check, actual desktop/375px browser workflows and a built/running healthy Docker container. Added source-fingerprinted screenshot coverage tooling with pending states marked explicitly.
- Limits: browser download-file receipt was not verified because the browser blocked its internal download page; backup serialization/validation passed isolated tests and a synthetic encrypted backup was restored through the UI. Password rotation and permanent deletion passed isolated tests, not browser submission. No independent security audit.
- Delivery: committed local candidate; no GitHub remote, public repository, public deployment, registry upload or release created. Existing private Scrinium files/history remain separate.
