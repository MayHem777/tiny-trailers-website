# Tiny Trailers website

Marketing site for Tiny Trailers (custom tiny home trailers, Noosaville QLD), replacing the old Squarespace site
(cancelled 2026-10-03). Plain HTML/CSS, no build step, no framework.

## Pages
`index.html` (products, prices in Product schema, FAQ), `about.html`, `gallery.html`, `contact.html` (quote form),
`thank-you.html` (after a sent enquiry, noindex). Shared `style.css` (bump `?v=` when it changes). `sitemap.xml`,
`robots.txt`, `images/`.

## Hosting (checked 2026-10-19)
- **GitHub Pages** from `main` of MayHem777/tiny-trailers-website, custom domain from `CNAME` (`www.tinytrailers.com.au`).
  **A push to `main` is a live deploy** (ask Mitch first).
- **DNS is at VentraIP** (ns1-3.nameserver.net.au), not Cloudflare. Apex A records → GitHub Pages (185.199.108-111.153),
  which 301s to www; `www` CNAME → `mayhem777.github.io`. Our Cloudflare token has no DNS access and the zone is not on
  Cloudflare. Never change DNS without Mitch's OK.
- **Mail for @tinytrailers.com.au is VentraIP email hosting**: MX mx1-4.email-hosting.net.au, SPF
  `v=spf1 a mx include:spf.email-hosting.net.au ~all`, autodiscover → ventraip.email. info@ is a VentraIP mailbox (not
  in the M365 tenants). **Never touch the root MX or SPF.**

## Contact form
`contact.html` posts (fetch, FormData) to the Cloudflare Worker in `worker/`:
**https://tiny-trailers-contact.mitchjcroft.workers.dev/api/contact**. The site stays on GitHub Pages; only the handler
is on Cloudflare (Mitch's decision 2026-10-19, so no DNS change was needed to host it).
- Worker checks, in order: Origin is exactly `https://www.tinytrailers.com.au` (CORS locked to it, no Origin = 403) ·
  body ≤ 20 KB · `_honey` empty · Turnstile token verified server-side (siteverify, hostname must be
  `www.tinytrailers.com.au`) · name required · email valid · phone a plausible AU number if given (same regex as the
  page) · name/message not a single 15+ char letters-and-digits string with no spaces. Replies `{ok:true}` or
  `{ok:false,error:<code>}`; the page maps codes to friendly inline messages (always with the phone number) and on success
  goes to `thank-you.html`.
- Email: Resend API, from `Tiny Trailers website <website@send.tinytrailers.com.au>` to `info@tinytrailers.com.au`,
  Reply-To = the enquirer, subject "New quote enquiry — Tiny Trailers website", plain text + HTML (values HTML-escaped).
  Sending domain is the **subdomain** `send.tinytrailers.com.au` so the root MX/SPF are untouched.
- Turnstile widget `tiny-trailers-contact` (Managed mode, shown as `data-appearance="interaction-only"`, so it's
  invisible unless Cloudflare wants a check). The site key is public and lives in `contact.html`.
- Config: `worker/wrangler.toml` `[vars]` (ALLOWED_ORIGINS, TURNSTILE_HOSTNAMES, MAIL_FROM, MAIL_TO). Secrets
  `TURNSTILE_SECRET`, `RESEND_API_KEY` via `npx wrangler secret put` from `worker/`, never in the repo.
- Deploy the Worker: `cd worker && npx wrangler deploy` (production, ask first). Logs: `npx wrangler tail` from `worker/`.

## Testing the form locally
`worker/.dev.vars` (git-ignored) with Turnstile test secrets (`1x0000000000000000000000000000000AA` passes,
`2x0000000000000000000000000000000AA` fails; test site key `1x00000000000000000000AA`; test tokens report hostname
`example.com`), `ALLOWED_ORIGINS=http://localhost:8080`, and `RESEND_API_URL` pointed at a local mock that records the
payload. Serve a copy of the site on :8080 with the site key and form action swapped, run `npx wrangler dev --port 8787`,
then curl the reject cases and drive the page with Playwright
(`$HOME/.nvm/versions/node/v24.21.0/lib/node_modules/playwright`). Stop every server by PID afterwards.

## Old FormSubmit
The site used FormSubmit until 2026-10. Its endpoint `formsubmit.co/info@tinytrailers.com.au` keeps accepting direct
POSTs from anyone until it is shut off (see PLAN.md). No `formsubmit` reference may come back into the repo.

## Conventions
Australian English, metric, phone 0401 744 844, no gender assumptions. Keep pages hand-edited single files.
