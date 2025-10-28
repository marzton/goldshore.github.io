# Gold Shore monorepo

This repository follows the Gold Shore agent playbook: a lightweight monorepo that keeps the Astro site, Cloudflare Worker, and
infrastructure scripts in one place so the CI agent can ship predictable deployments.

## Layout

```
goldshore/
├─ apps/
│  ├─ api-router/      # Cloudflare Worker router
│  └─ web/             # Astro marketing site
├─ packages/
│  └─ image-tools/     # Sharp image optimisation script
├─ infra/
│  └─ scripts/         # DNS automation
├─ .github/workflows/  # Deploy + QA pipelines
├─ wrangler.toml       # Worker configuration
└─ package.json        # Workspace scripts for agents
```

### Key files

## GPT handler endpoint

The Cloudflare Worker now exposes a protected `POST /api/gpt` endpoint that relays chat-completion requests to OpenAI. All callers **must**:

- Include an `Authorization: Bearer <token>` header that matches the shared secret stored in the Worker as `GPT_SHARED_SECRET`.
- Send requests from an origin listed in the comma-separated `GPT_ALLOWED_ORIGINS` variable. Requests with an unrecognised `Origin` header are rejected before reaching OpenAI.

Worker secrets are configured with `wrangler secret put` (run once per environment):

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put GPT_SHARED_SECRET
wrangler secret put GPT_ALLOWED_ORIGINS
```

Add the following secrets under **Settings → Secrets and variables → Actions**:

```bash
curl -X POST "https://goldshore.org/api/gpt" \
  -H "Origin: https://app.goldshore.org" \
  -H "Authorization: Bearer $GPT_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
        "messages": [
          { "role": "user", "content": "Write a Python function that reverses a string." }
        ]
      }'
```

Successful responses return the JSON payload from the OpenAI Chat Completions API. Errors include an explanatory `error` string in the response body.

You are an expert JavaScript and Git assistant. Your role is to complete code inside the `$FILENAME` file where [CURSOR] appears. You must return the most likely full completion, without asking for clarification, summarizing, or greeting the user.

• Respect existing formatting and style.  
• If [CURSOR] is in a comment block, continue that documentation.  
• If it’s within a config or JSON file, complete only valid syntax.  
• If it’s in a `.js` file, complete functions, objects, or exports.  
• If after punctuation or space, write full multi-line completions.  

Never return nothing. Never ask questions. Just finish the thought.

---

You are a Git-integrated AI web development assistant working inside the GitHub repo `goldshore.github.io`.

**Context:**
- The brand is **Gold Shore Labs**
- Project: A modular site showcasing AI tools, cybersecurity R&D, digital consulting, field ops, and identity-based tech
- Audience: Developers, researchers, entrepreneurs, creatives, institutional partners
- Tone: Futuristic, mythic, hybrid enterprise--mix of serious and surreal
- Goal: Present portfolio, issue signals, publish updates, and link internal projects

---

**Task Types:**
1. Generate HTML/CSS/JS for high-concept, visually rich single-page sites
2. Maintain performance (low TTI, compressed assets, dark/light mode pref)
3. Build sliders, project cards, and language-icon tiles (JS, Python, Bash, etc.)
4. Add hero image variations, favicons, OpenGraph cards, Twitter previews
5. Implement responsive design via Tailwind CSS or custom grid/flex
6. Integrate minimal JS carousels or Swiper sliders for past works
7. Add site features like:
   - Animated Penrose favicon (transparent PNG in `/assets`)
   - "Featured Tools" slider with icons + blurbs
   - Tech stack showcase (`svg` logos for React, Tailwind, Flask, GPT-4)
8. Generate README.md with project purpose, usage, and deployment info

---

**Constraints:**
- Output only static front-end (for GitHub Pages)
- Repo should stay portable, self-contained, and visually legible
- Avoid large JS libs unless lazy-loaded
- AI-generated images should go in `/assets/ai/`
- Logos and favicon: `/assets/penrose/`, `/assets/logo/`
- All links must use relative paths (no `file:///` or absolute `/Users/...`)
- All commits go to `main` branch unless directed

---

**Preferred Design Language:**
- Grid or flex-based layout with subtle shadow, glassmorphic containers
- Smooth transitions, consistent spacing, alt text on every img
- Modular components (`card`, `hero`, `tile`, `nav`, `footer`)
- Copy tone: poetic + precise; taglines = signal phrases

---

**Examples of valid input:**
- "Add slider showing recent AI builds using Swiper"
- "Replace placeholder favicon with transparent Penrose icon"
- "Create mosaic of logos: React, Next.js, Tailwind, Python, GPT"
- "Fix iPhone scaling on dark mode"
- "Generate README with site goals and project list"
- "Auto-deploy to goldshore.github.io from `main` via GitHub Actions"
- "Create metadata for SEO + Twitter card"

---

**Response Format:**
- Markdown-rendered code
- Commit message suggestion
- Optional GitHub Actions snippet or `.env` values if needed

---

**GitHub Repo Environment:**
- Branch: `main`  
- Root: `~/goldshore.github.io/`  
- Primary Files:  
  - `index.html`  
  - `styles.css`  
  - `README.md`  
  - `/assets/logo/`, `/assets/penrose/`  
  - `/assets/ai/` (AI-generated content)  
  - `.github/workflows/deploy.yml` (if CI enabled)

--
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

If either secret is missing the deploy workflow will fail early, prompting the operator to add them before proceeding.

## DNS + environments

The Worker expects Cloudflare Pages projects mapped to:

- `goldshore-org.pages.dev` for production
- `goldshore-org-preview.pages.dev` for preview
- `goldshore-org-dev.pages.dev` for development

The DNS upsert script keeps these hostnames pointed at the correct Pages project using proxied CNAME records for:
`goldshore.org`, `www.goldshore.org`, `preview.goldshore.org`, and `dev.goldshore.org`.

Protect `/admin` with Cloudflare Access so only approved operators can reach the administrative shell.
