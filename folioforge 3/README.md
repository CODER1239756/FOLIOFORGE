# FolioForge: AI portfolio builder

Visitors fill in a short form, AI designs their portfolio, and they publish it to Netlify with one click and get a link to share. A **Buy me a coffee** button (top right and footer) opens your Fam Pay UPI QR.

## How it works

```
Browser (index.html)
  ├─ /.netlify/functions/generate  → calls the AI API (key stays on the server) → returns portfolio HTML
  ├─ Use quick template            → builds a portfolio in the browser, no AI needed
  └─ /.netlify/functions/publish   → creates a Netlify site + deploys index.html → returns the live URL
```

Why not Lovable's API? Lovable's public API only deploys existing projects (Business/Enterprise workspaces), and "Build with URL" opens Lovable for a logged-in user. So generation uses an LLM API instead. An **Open in Lovable** button is included for people who have a Lovable account.

## Project files

| File | Purpose |
|---|---|
| `index.html` | The whole frontend (landing page, form, preview, publish, share link, coffee popup) |
| `assets/fampay-qr.jpg` | Your Fam Pay QR (cropped) shown in the coffee popup |
| `netlify/functions/generate.js` | AI generation (Anthropic API by default) |
| `netlify/functions/publish.js` | Creates a Netlify site and deploys the page |
| `netlify.toml` | Netlify config |
| `.env.example` | Names of the keys you need (copy to `.env` for local testing) |
| `.gitignore` | Keeps your real `.env` out of GitHub |

## Add your API keys

You need two keys. Keys only ever go into **Netlify's environment variables** (or a local `.env` file). Never paste them into `index.html`, never commit them to GitHub, and never share them in chat.

**1. AI key (writes the portfolios)**
1. Open the Claude Console (linked from docs.claude.com) and sign in.
2. Add a little credit under Billing. Generation costs a small amount per portfolio.
3. Go to API keys → Create key → copy it. You only see it once.

**2. Netlify token (publishes the portfolios)**
1. In Netlify: click your avatar → User settings → Applications → Personal access tokens.
2. New access token → name it `folioforge` → copy it.

**3. Add them to your site**
1. Netlify → your site → Site configuration → Environment variables → Add a variable.
2. Add each of these (tick "Contains secret values" and keep scope "Functions" if asked):

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | the AI key |
   | `NETLIFY_AUTH_TOKEN` | the Netlify token |
   | `ACCESS_CODE` | recommended: a code visitors must enter to publish, so strangers can't fill your account with sites |
   | `AI_MODEL` | optional, defaults to `claude-haiku-5-5` |
   | `NETLIFY_ACCOUNT_SLUG` | optional, your team slug if you have several teams |

3. Deploys → Trigger deploy → Deploy site. New variables only apply to new deploys.

If a key is ever exposed, delete it in its dashboard and create a new one.

## Deploy (about 10 minutes)

1. Create a GitHub repo and upload this folder's contents (the `.gitignore` keeps secrets out).
2. Netlify → Add new site → Import an existing project → pick the repo. No build command; publish directory `.`
3. Add the environment variables above, then deploy.
4. Open your site, generate a portfolio, choose Publish.

Local testing: `npm i -g netlify-cli`, copy `.env.example` to `.env`, fill it in, then run `netlify dev` in this folder.

## Things to know

- **Time limit:** Netlify functions on the free plan stop after about 10 seconds by default (up to 26 on some plans). Generation uses a fast model with a capped length to fit, but if you see timeouts, raise the function timeout in Netlify's settings or host the `generate` function somewhere without that limit (Vercel, Cloudflare Workers). The quick template always works as a fallback.
- **Cost and abuse:** every generation costs AI credits and every publish creates a site in your Netlify account. Use `ACCESS_CODE`, and watch your usage on both dashboards.
- **Safety:** generated pages are stripped of scripts and previewed in a sandboxed iframe; `publish` rejects any HTML containing `<script>`.
- **Other AI providers:** change only `callModel()` in `generate.js`.
- **Payments:** the coffee popup is UPI-only (Fam Pay QR, UPI ID copy, and a "Pay in UPI app" button on phones). For cards, create a Razorpay or Stripe Payment Link and add a second button pointing to it.
- **Change your UPI details:** edit `UPI_ID` / `UPI_NAME` at the top of the script in `index.html`, and replace `assets/fampay-qr.jpg`.
