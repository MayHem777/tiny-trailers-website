# PLAN

## Goal
Replace the FormSubmit contact form with our own Cloudflare Worker (Turnstile + Resend), without touching DNS for the
site or the root mail records.

## Next steps
- [x] Worker `worker/` built: origin lock, honeypot, Turnstile siteverify + hostname, validation, junk filter, Resend
- [x] `contact.html` wired to it (fetch, inline errors, redirect to thank-you.html); formsubmit removed from the repo
- [x] Local tests 2026-10-19 (wrangler dev + Turnstile test keys + mock Resend): good send, no/wrong origin, honeypot,
      missing token, failing token, hostname mismatch, name/email/phone/junk, Resend down, browser submit → thank-you
- [ ] Mitch: Resend domain + key, Turnstile widget, DNS records at VentraIP (see Waiting on Mitch)
- [ ] Put the real site key in `contact.html` (replace `TURNSTILE_SITE_KEY`), set the 2 Worker secrets
- [ ] Deploy the Worker (ask), check it: curl reject cases against workers.dev, Resend test send to info@
- [ ] Merge `turnstile-contact` to main (ask: goes live), real submission on www, confirm it lands in info@
- [ ] Record the Turnstile secret and Resend key in claude-monitor inventory/credentials.json

## Assumptions
- 2026-10-19: Site stays on GitHub Pages; the handler is a stand-alone Worker on workers.dev (Mitch chose this, no DNS change).
- 2026-10-19: Resend sending domain is `send.tinytrailers.com.au`, From `website@send.tinytrailers.com.au` (Mitch).
- 2026-10-19: Resend region Tokyo (ap-northeast-1), the closest to Brisbane. Only changes the MX value on send.send.
- 2026-10-19: Honeypot and bad Turnstile return a 400 with an error code (not a fake success), so tests can see it.
- 2026-10-19: No rate limit beyond Turnstile; add the Workers rate-limit binding if spam gets through.
- 2026-10-19: A form without JavaScript can't send (Turnstile needs JS); the phone number is beside the form.

## Waiting on Mitch
- **Resend + DNS for the contact form**: add domain `send.tinytrailers.com.au` in Resend (Tokyo), add its 3 records
  at VentraIP DNS, create a sending-only API key and store it with `set-secret TINY_TRAILERS_RESEND_KEY`; tell me when
  the records are in (recommend yes: needed before the form can go live).
- **Turnstile widget**: create `tiny-trailers-contact` (Managed, hostname tinytrailers.com.au), paste me the site key,
  store the secret with `set-secret TINY_TRAILERS_TURNSTILE_SECRET` (recommend yes; our token can't create widgets).
- **Deploy the Worker, then merge to main** once both are done (recommend yes: both go live, so they're yours to OK).
- **FormSubmit**: block mail from formsubmit.co in the info@ VentraIP mailbox after go-live (recommend yes).
