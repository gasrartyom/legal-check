# legal-check

Check if you have done something legal or not. Describe a situation (English or Russian), pick a
US state, and the site looks up the statute text and explains which laws may apply, with links.
UI in English and Russian at `/en` and `/ru`. Not legal advice.

## Local development

```bash
npm ci
cp .env.example .env.local   # then set LEGAL_CHECK_API_KEY
npm run dev
```

Without Redis variables the daily limit is counted in memory, which is fine locally.

## Tests

- `npm test` runs unit tests; no API calls.
- `node scripts/cases.ts red-light [fight ...]` runs real cases against the API and **costs money**
  (about $0.5 per case on Opus 5.5, a few cents on `LEGAL_CHECK_MODEL=claude-haiku-5-5`).

## Deploy to Vercel

1. **Import the repository** in Vercel (New Project). Framework: Next.js, detected automatically;
   build command and output need no changes. Set the production branch to the branch you deploy.
2. **Add Redis for the daily limit**: Storage (Marketplace) → Upstash for Redis → create a database
   and connect it to the project. It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the
   `UPSTASH_REDIS_REST_*` pair); both naming schemes work.
3. **Environment variables** (Settings → Environment Variables):

   | Name | Environments | Value |
   |---|---|---|
   | `LEGAL_CHECK_API_KEY` | Production (Preview only if you need real checks there) | Anthropic API key, marked **Sensitive** |
   | `LEGAL_CHECK_MODEL` | optional | leave unset for `claude-opus-5-5` |
   | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Production, Preview | set by the Redis integration |

4. **Functions**: keep Fluid compute on (default for new projects). `/api/check` sets
   `maxDuration = 120` seconds; a check usually takes 20–40 s.
5. **Set a spend limit on the Anthropic side** (Console → workspace limits) as a backstop:
   the per-IP limit does not cap the total. Each check costs about $0.5 on Opus 5.5,
   so 100 visitors using all 3 checks is about $150 a day.
6. Leave Deployment Protection on for Preview deployments so previews are not public.

After deploying: open `/` (redirects to `/en` or `/ru`), switch the language, and run one check.
A 4th check from the same IP on the same UTC day should show the limit message.

The limit counts a check when the request is accepted, before the model runs, so failed checks
count too. Client IP comes from `x-forwarded-for`, which Vercel sets and does not let clients spoof;
behind another proxy that header would need to be trusted explicitly.
