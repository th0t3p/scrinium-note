# Scrinium Community

- This is an isolated, source-available, noncommercial community snapshot. It must not modify, deploy or connect to the private production Scrinium app.
- Read and maintain CHANGELOG.md with meaningful code/configuration changes, validation and actual delivery state.
- Browser-only vault: encryption, decryption, notes, search and keys stay client-side. Persist only ciphertext, wrapped keys and minimal ordering metadata in the separate `scrinium-community-v1` IndexedDB database.
- A local vault password is not an online account. Do not add account registration, email, SRP, cloud sync, payment, analytics, AI or Pro features.
- Preserve the source app's purple accent, dark theme, system-compatible font stack, Milkdown editing behavior and semantic design tokens. Do not redesign it or invent visual assets.
- Keep the community snapshot feature-frozen. `tools/check-upstream.mjs` reports allowlisted upstream drift; it must never automatically import or overwrite files.
- PolyForm Noncommercial applies to the owned application code. Preserve unmodified third-party notices and licenses. Do not describe this as OSI-approved open source or audited security.
- All fixtures must be synthetic. Never copy production databases, account files, secrets, .env files or the private repository's Git history.
- Run typecheck, core/repository tests, a production build and actual browser create/edit/lock/unlock/recovery/backup checks. Record Docker build/run separately from static-browser verification.
- Use `th0t3p <th0t3p@users.noreply.github.com>`. The user authorized creating and pushing this community snapshot to the public `th0t3p/scrinium-community` repository on 2026-11-18. Use the `github.com-th0t3p` SSH alias; never use the retired account or macOS HTTPS credential. Commit and push authorized changes. This does not authorize publishing private Scrinium code, deploying a public service or uploading a container image.
