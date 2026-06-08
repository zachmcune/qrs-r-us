# New Project

Blank starter for your next site.

## 1. Open in Cursor

```bash
cd ~/GitRepos/starter-project
cursor .
```

## 2. Create a GitHub repo

On GitHub: **New repository** → name it (e.g. `my-new-app`) → create empty repo.

Then in this folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/my-new-app.git
git push -u origin main
```

## 3. Deploy on Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages**
2. **Connect to Git** → pick your new repo
3. Build settings:
   - **Build command:** (empty)
   - **Build output directory:** `/`
4. **Save and Deploy**

Your new site gets its own `*.pages.dev` URL, separate from Productivity Hub.

## Productivity Hub (saved separately)

Your finished app lives in `~/GitRepos/Test` and deploys from:

https://github.com/zachmcune/productivity
