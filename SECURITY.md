# Repository data and credentials

Production student names, emails, grades, reward ledgers and claims belong in the existing Cloudflare Durable Object storage. Do not commit data exports, screenshots of real student records, session cookies, email sign-in codes, provider keys or private keys. Browser tests use isolated fake accounts and generated local credentials; their `checks/` output is ignored.

Keep `RESEND_API_KEY` and any Cloudflare or GitHub credentials in provider secret storage. `GOOGLE_CLIENT_ID` is a public OAuth application identifier, not the client secret. Domains, Worker identifiers and application source are not credentials. Do not add a Google client secret to browser code.

`npm run check` scans tracked content for common credential formats and rejects tracked environment/key files. `node tools/check-sensitive.mjs --history` also checks local Git history. Output reports locations and rule names without printing matching material. Pattern matching does not certify the absence of every possible secret or personal record; review new files before committing. Enable GitHub secret scanning and push protection in repository settings when available.

If a credential was ever published, revoke or rotate it with its provider first. Removing a current file does not remove a credential from Git history. Coordinate any history rewrite with collaborators.

No license change is included in the November 17 study release. A root `LICENSE` file with the MIT text, copyright year and copyright holder is required to publish the project under MIT. Confirm ownership of any contributed or third-party material before licensing it.
