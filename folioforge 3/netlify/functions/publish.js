// POST /.netlify/functions/publish
// Creates a new Netlify site for the visitor and deploys their portfolio HTML to it.
// Uses Netlify's file-digest deploy API, so no zip library or dependencies are needed.

const crypto = require("crypto");
const API = "https://api.netlify.com/api/v1";

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "portfolio";

const rand = () => crypto.randomBytes(3).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nf(path, token, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function createSite(token, base) {
  // Site names must be globally unique, so retry with a random suffix on collision.
  const candidates = [`${base}-${rand()}`, `${base}-${rand()}`, `${base}-${rand()}${rand()}`];
  for (const name of candidates) {
    const body = { name };
    if (process.env.NETLIFY_ACCOUNT_SLUG) body.account_slug = process.env.NETLIFY_ACCOUNT_SLUG;
    const r = await nf("/sites", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.data;
    if (r.status !== 422) throw new Error(`Netlify createSite ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
  }
  throw new Error("Could not find a free site name, please try again");
}

async function deployHtml(token, siteId, html) {
  const buf = Buffer.from(html, "utf8");
  const sha1 = crypto.createHash("sha1").update(buf).digest("hex");

  const d = await nf(`/sites/${siteId}/deploys`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: { "/index.html": sha1 } }),
  });
  if (!d.ok) throw new Error(`Netlify deploy ${d.status}: ${JSON.stringify(d.data).slice(0, 200)}`);

  const deployId = d.data.id;
  if ((d.data.required || []).includes(sha1)) {
    const up = await nf(`/deploys/${deployId}/files/index.html`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: buf,
    });
    if (!up.ok) throw new Error(`Netlify upload ${up.status}`);
  }

  // Wait briefly until the deploy is live.
  for (let i = 0; i < 8; i++) {
    const s = await nf(`/deploys/${deployId}`, token);
    if (s.ok && s.data.state === "ready") return s.data;
    if (s.ok && s.data.state === "error") throw new Error("Netlify reported a deploy error");
    await sleep(700);
  }
  return d.data;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });

  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) return json(500, { error: "Server is missing NETLIFY_AUTH_TOKEN" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid JSON" }); }

  // Optional gate so strangers can't fill your Netlify account with sites.
  const code = process.env.ACCESS_CODE;
  if (code && body.accessCode !== code) return json(401, { error: "Access code required" });

  const html = String(body.html || "");
  if (html.length < 200 || html.length > 900000) return json(400, { error: "Portfolio HTML is missing or too large" });
  if (/<script/i.test(html)) return json(400, { error: "Scripts are not allowed in portfolios" });

  try {
    const site = await createSite(token, slugify(body.name));
    await deployHtml(token, site.id, html);
    const url = site.ssl_url || site.url || `https://${site.name}.netlify.app`;
    return json(200, { url, siteId: site.id });
  } catch (e) {
    console.error(e);
    return json(502, { error: "Publishing failed. Please try again in a moment." });
  }
};
