## CONTEXTO GERAL

Tenho um repo central chamado `pepa667/insta-scraper` (recém criado, ainda a fazer push) que contém a lógica de scraping. Qualquer repo cliente (site de tatuador) chama o workflow deste repo central via GitHub Actions `workflow_call`, sem ter que manter nenhum código de scraping localmente.

O fluxo funciona assim:
1. O cron do repo cliente dispara
2. O `scrape-reusable.yml` do repo central corre
3. Faz checkout do repo cliente
4. Faz sparse-checkout apenas do script `insta/get-insta-feed.js` do repo central
5. Corre o script → descarrega 9 imagens para `www/images/insta/` → escreve `www/insta-links.json`
6. Faz commit + push das imagens e do JSON para o repo cliente

O site do cliente lê o `insta-links.json` para mostrar o feed Instagram sem depender da API oficial.

---

## STACK TÉCNICA

- **Node.js 24** (nativo, sem npm packages — só `https`, `fs`, `path`)
- **scrape.do** como proxy HTTP (conta gratuita, chave em `SCRAPER_API_KEY`)
- **GitHub Actions** com `workflow_call` para reusabilidade
- **Instagram API** (não oficial, requer session cookie):
  - Step 1: `GET https://www.instagram.com/api/v1/users/web_profile_info/?username=USERNAME`  
    Headers obrigatórios: `x-ig-app-id: 936619743392459`, `cookie: sessionid=SESSION_ID`  
    Retorna perfil do utilizador + `data.user.id` (o user_id numérico)
  - Step 2: `GET https://i.instagram.com/api/v1/feed/user/{USER_ID}/?count=9`  
    Mesmos headers. Retorna `items[]` com campos `code` (shortcode), `image_versions2.candidates[0].url`, `carousel_media[0].image_versions2...`

Ambas as chamadas passam pelo scrape.do com `customHeaders=true` para repassar os headers ao Instagram.

---

## ESTRUTURA DO REPO CENTRAL (`pepa667/insta-scraper`)

```
insta-scraper/
├── insta/
│   └── get-insta-feed.js          ← script de scraping (Node 24, sem deps)
├── .github/
│   └── workflows/
│       └── scrape-reusable.yml    ← workflow reutilizável (workflow_call)
└── examples/
    └── client-workflow.yml        ← template para cada cliente
```

O `scrape-reusable.yml` é **auto-referenciante**: usa `github.workflow_ref` para descobrir o próprio repo sem hardcode:
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

---

## SECRETS NECESSÁRIOS

Em cada repo cliente (Settings → Secrets → Actions):
| Secret | Descrição |
|--------|-----------|
| `SCRAPER_API_KEY` | Chave scrape.do (pode ser a mesma para todos os clientes) |
| `INSTA_USERNAME` | Username Instagram deste cliente (ex: `luaink.tattoo`) |
| `INSTA_SESSION_ID` | Cookie `sessionid` do Instagram (Chrome → F12 → Application → Cookies → sessionid) |

O `INSTA_SESSION_ID` expira periodicamente (semanas a meses) e precisa ser renovado manualmente.

---

## COMO O SCRIPT FUNCIONA (get-insta-feed.js)

```javascript
// Env vars:
// SCRAPER_API_KEY, INSTA_USERNAME, INSTA_SESSION_ID
// IMAGES_DIR      (default: ../www/images/insta)
// LINKS_JSON_PATH (default: ../www/insta-links.json)

// Strategy 1a: web_profile_info via scrape.do → extrai user_id
// Strategy 1b: feed/user/{user_id}/?count=9 via scrape.do → extrai items[]
// Strategy 2:  mesmo fluxo mas chamada directa (fallback, pode dar 429 em IPs Azure)

// extractPostsFromObject() suporta 3 formatos:
// 1. Antigo GraphQL: edge_owner_to_timeline_media.edges[].node.{shortcode, display_url}
// 2. Novo web:       media.edges[].node.{code, image_versions2}
// 3. Mobile API:     items[].{code, image_versions2, carousel_media[0].image_versions2}

// Output:
// www/images/insta/instaFoto_01.jpg ... instaFoto_09.jpg
// www/insta-links.json → { posts: [{ index, localImage, permalink }] }
```

---

## BETA TEST (repo `pepa667/luaink`)

O `luaink` foi usado como beta. O `cron-insta.yml` deste repo chama o scrape-reusable.yml local (ainda aponta para ele mesmo). Depois de o repo central estar no ar, devo actualizar o `cron-insta.yml` do `luaink` para apontar para `pepa667/insta-scraper/.github/workflows/scrape-reusable.yml@main`.

Último run confirmado: **Strategy 1b sucesso, 9 posts descarregados**.

---

## TAREFAS PENDENTES

1. **Fazer push do `insta-scraper` para GitHub**:
   ```bash
   cd ~/Desktop/insta-scraper
   git init
   git add .
   git commit -m "feat: initial commit — reusable instagram scraper"
   git remote add origin git@github.com:pepa667/insta-scraper.git
   git push -u origin main
   ```
   (Criar o repo no GitHub antes: github.com/new)

2. **Actualizar `luaink` para usar o repo central**:
   Em cron-insta.yml, mudar:
   ```yaml
   uses: ./.github/workflows/scrape-reusable.yml
   ```
   para:
   ```yaml
   uses: pepa667/insta-scraper/.github/workflows/scrape-reusable.yml@main
   ```

3. **Remover ficheiros de scraping do `luaink`** (opcional, após confirmar que o central funciona):
   - get-insta-feed.js
   - scrape-reusable.yml
   - example-client-workflow.yml

4. **Onboarding de novos clientes**:
   - Copiar `examples/client-workflow.yml` para `.github/workflows/update-instagram.yml` no repo do cliente
   - Substituir `SEU_USUARIO/insta-scraper` pelo repo correcto
   - Adicionar os 3 secrets no repo do cliente
   - O site do cliente precisa de ler insta-links.json e servir as imagens de insta