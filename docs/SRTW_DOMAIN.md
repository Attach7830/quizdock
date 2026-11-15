# srtw.win deployment and sender

Requested domain: https://srtw.win. Existing Worker: quizdock, existing account storage and Durable Object migrations retained. The Cloudflare custom-domain route is declared in wrangler.jsonc, with workers_dev explicitly enabled so existing links remain usable. Custom-domain deployment lets Cloudflare manage the routing record and TLS; do not replace Resend TXT/MX records with website DNS records.

EMAIL_FROM is the public sender `QuizDock <no-reply@srtw.win>`. The existing RESEND_API_KEY secret is retained through keep_vars. The owner confirmed that srtw.win is verified as a Resend sending domain and https://srtw.win is an authorized JavaScript origin on the existing Google OAuth client. The public Google client ID and strict-origin-when-cross-origin referrer header remain unchanged.

The domain's authoritative nameservers were confirmed as jacqueline.ns.cloudflare.com and jay.ns.cloudflare.com. Initial DNS inspection had no apex website A record. Route creation, managed TLS, actual served release and email delivery are separate checks; the configured sender alone does not prove inbox delivery.

The primary read-only health probe now targets https://srtw.win. QUIZDOCK_URL can target the existing workers.dev endpoint for comparison. GitHub's health workflow allows time for the first custom-domain deployment and TLS activation, then reports a failure if the expected release is unavailable. Authentication cookies remain bound to each hostname; a browser signs in on the new hostname to access its existing account records.

Validation before release includes source syntax, server/browser regressions, sender propagation in the Wrangler dry-run, exact committed trees, and production build status. After deployment, check HTTPS, /api/health, public assets, Google button loading, both hostnames and public DNS. Actual Google account selection and email-code inbox delivery require designated accounts and should be reported separately from public checks.
