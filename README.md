# insta-scraper

> Reusable GitHub Actions workflow that scrapes an Instagram feed and commits static images + a JSON manifest to any client repo — zero dependencies, zero API keys from Meta.

---

## How it works

```
Client repo cron
      │
      ▼
pepa667/insta-scraper   ← scrape-reusable.yml (workflow_call)
      │
      ├─ checkout client repo
      ├─ sparse-checkout insta/get-insta-feed.js from this repo
      ├─ run script → downloads 9 images + writes insta-links.json
      └─ commit + push to client repo
```

The client site reads `www/insta-links.json` to render the feed — no Instagram API dependency at runtime.

---

## Repository structure

```
insta-scraper/
├── insta/
│   └── get-insta-feed.js          # scraping script (Node 24, no npm deps)
├── .github/
│   └── workflows/
│       └── scrape-reusable.yml    # reusable workflow (workflow_call)
└── examples/
    └── client-workflow.yml        # copy this to each client repo
```

---

## Onboarding a new client

### 1 — Add the workflow to the client repo

Copy [`examples/client-workflow.yml`](examples/client-workflow.yml) to `.github/workflows/update-instagram.yml` in the client repo.

```yaml
jobs:
  update-feed:
    uses: pepa667/insta-scraper/.github/workflows/scrape-reusable.yml@main
    secrets:
      SCRAPER_API_KEY: ${{ secrets.SCRAPER_API_KEY }}
      INSTA_USERNAME:  ${{ secrets.INSTA_USERNAME }}
      INSTA_SESSION_ID: ${{ secrets.INSTA_SESSION_ID }}
```

Adjust the `cron` schedule so clients don't all run at the same time.

### 2 — Add the three secrets

In the client repo: **Settings → Secrets and variables → Actions**

| Secret | Description |
|---|---|
| `SCRAPER_API_KEY` | [scrape.do](https://scrape.do) API key — can be shared across all clients |
| `INSTA_USERNAME` | Instagram handle for this client (e.g. `luaink.tattoo`) |
| `INSTA_SESSION_ID` | Instagram session cookie — see below |

#### Getting the session cookie

1. Open Chrome and log in to instagram.com
2. Open DevTools → **Application** → **Cookies** → `https://www.instagram.com`
3. Copy the value of `sessionid`

> **Note:** The session cookie expires every few weeks to months. When the workflow starts failing with a 401, just refresh this secret.

### Optional inputs

All inputs have sensible defaults and can be omitted entirely.

| Input | Default | Description |
|---|---|---|
| `post_count` | `9` | Number of posts to download |
| `image_prefix` | `instaFoto_` | Filename prefix — e.g. `instaFoto_01.jpg` |
| `image_ext` | `jpg` | Image file extension (without dot) |
| `images_dir` | `www/images/insta` | Destination folder for images (relative to repo root) |
| `images_public_path` | `images/insta` | Public path written into `insta-links.json` |
| `links_json_path` | `www/insta-links.json` | Output JSON path (relative to repo root) |

Example overriding some defaults:

```yaml
jobs:
  update-feed:
    uses: pepa667/insta-scraper/.github/workflows/scrape-reusable.yml@main
    with:
      post_count: 12
      image_prefix: foto_
      images_dir: public/img/insta
      images_public_path: img/insta
      links_json_path: public/insta-links.json
    secrets:
      SCRAPER_API_KEY: ${{ secrets.SCRAPER_API_KEY }}
      INSTA_USERNAME:  ${{ secrets.INSTA_USERNAME }}
      INSTA_SESSION_ID: ${{ secrets.INSTA_SESSION_ID }}
```

### 3 — Prepare the client site

The script writes two things to the client repo (paths are configurable via inputs):

| Path (defaults) | Contents |
|---|---|
| `www/images/insta/instaFoto_01.jpg` … `instaFoto_09.jpg` | Downloaded images |
| `www/insta-links.json` | JSON manifest |

`insta-links.json` format:

```json
{
  "posts": [
    {
      "index": "01",
      "localImage": "images/insta/instaFoto_01.jpg",
      "permalink": "https://www.instagram.com/p/SHORTCODE/"
    }
  ]
}
```

The client site reads this file to render the feed without any runtime dependency on Instagram.

---

## Technical stack

- **Node.js 24** — native modules only (`https`, `fs`, `path`), no `npm install`
- **[scrape.do](https://scrape.do)** — HTTP proxy to forward Instagram headers from GitHub Actions IPs
- **GitHub Actions `workflow_call`** — one central workflow, many client repos

---

## How the scraping works

The script tries two strategies in order, stopping as soon as it gets 9 posts:

### Strategy 1 (via scrape.do proxy)

1. `GET https://www.instagram.com/api/v1/users/web_profile_info/?username=USERNAME`  
   → extracts `data.user.id`
2. `GET https://i.instagram.com/api/v1/feed/user/{USER_ID}/?count=9`  
   → extracts `items[]`

Both requests pass through scrape.do with `customHeaders=true` so Instagram receives the session headers as-is.

### Strategy 2 (direct — fallback)

Same two requests but without the proxy. May get rate-limited (429) from GitHub Actions IPs, but useful as a fallback when the scrape.do quota is exhausted.

### Response format support

`extractPostsFromObject()` handles all known Instagram response shapes:

| Format | Fields used |
|---|---|
| Legacy GraphQL | `edge_owner_to_timeline_media.edges[].node.{shortcode, display_url}` |
| New web API | `media.edges[].node.{code, image_versions2}` |
| Mobile API | `items[].{code, image_versions2, carousel_media[0].image_versions2}` |

---

## Required headers

Both API calls must include:

```
x-ig-app-id: 936619743392459
cookie: sessionid=SESSION_ID
```

---

## Workflow self-reference

`scrape-reusable.yml` resolves its own repo name at runtime using `github.workflow_ref` — no hardcoded owner/repo anywhere:

```yaml
- name: Extract central repo
  id: central
  run: echo "repo=$(echo '${{ github.workflow_ref }}' | cut -d'/' -f1-2)" >> $GITHUB_OUTPUT

- name: Checkout scraper script
  uses: actions/checkout@v4
  with:
    repository: ${{ steps.central.outputs.repo }}
    path: _scraper
    sparse-checkout: |
      insta/get-insta-feed.js
    sparse-checkout-cone-mode: false
```

This means if you fork this repo, everything still works without changing a single line.

---

## License

[MIT](LICENSE)
