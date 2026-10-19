# PLAN

## Goal
Replace the FormSubmit contact form with our own Cloudflare Worker (Turnstile + Resend), without touching DNS for the
site or the root mail records.

## Next steps
- [x] Worker `worker/` built: origin lock, honeypot, Turnstile siteverify + hostname, validation, junk filter, Resend
- [x] `contact.html` wired to it (fetch, inline errors, redirect to thank-you.html); formsubmit removed from the repo
- [x] Local tests 2026-10-19 (wrangler dev + Turnstile test keys + mock Resend): good send, no/wrong origin, honeypot,
      missing token, failing token, hostname mismatch, name/email/phone/junk, Resend down, browser submit → thank-you
- [x] 2026-10-19: Resend domain send.tinytrailers.com.au (Tokyo) added; 3 records at VentraIP (TXT resend._domainkey.send,
      CNAME rsend.send → rsend-apne1.forge.rmta.net, CNAME send.send → send.forge.rmta.net), checked live from Claudio
      on ns1.nameserver.net.au and 1.1.1.1; root MX/SPF/A/www unchanged; no DMARC added (it would sit on the root)
- [x] Resend domain verified, sending-only key + Turnstile widget made by Mitch; site key 0x4AAAAAAFaxsJiRGGuRBoiy in
      contact.html; both secrets in secrets.env and on the Worker; both recorded in the monitor inventory
- [x] 2026-10-19 Worker deployed with Mitch's OK (version 826800b9). Live reject tests: no/wrong/http origin 403,
      honeypot 400, missing + invalid token 400, GET 405, preflight 204 with ACAO www only. Turnstile secret accepted
      by siteverify (only the dummy token was refused). Resend test to info@ accepted (id 01a15196…); arrival to be
      confirmed by Mitch
- [x] 2026-10-19 merged to main with Mitch's OK (70076a2), live on www. Resend test reached info@ (Mitch confirmed).
      Real enquiry sent from Chrome on www: Turnstile passed, Worker returned ok, page went to thank-you.html

- [x] 2026-10-19 info@ webmail filter "Block FormSubmit" (From contains formsubmit.co → Spam), set up by Mitch via Cowork

## Assumptions
- 2026-10-19: Site stays on GitHub Pages; the handler is a stand-alone Worker on workers.dev (Mitch chose this, no DNS change).
- 2026-10-19: Resend sending domain is `send.tinytrailers.com.au`, From `website@send.tinytrailers.com.au` (Mitch).
- 2026-10-19: Resend region Tokyo (ap-northeast-1), the closest to Brisbane. Resend now uses 2 CNAMEs for sending, not MX+TXT.
- 2026-10-19: Honeypot and bad Turnstile return a 400 with an error code (not a fake success), so tests can see it.
- 2026-10-19: No rate limit beyond Turnstile; add the Workers rate-limit binding if spam gets through.
- 2026-10-19: A form without JavaScript can't send (Turnstile needs JS); the phone number is beside the form.

## Waiting on Mitch
- Nothing. Form confirmed end to end by Mitch 2026-10-19 (his own test arrived in info@ with all fields).
