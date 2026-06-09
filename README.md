# QR's R Us

Create customized QR codes with logos, colors, and styles. Save to your account, edit anytime, and download as PNG, SVG, or PDF.

## Features

- Website URL QR codes with custom colors and dot styles
- Logo upload with resize, reposition, rounded-square crop, and border
- Adjustable error correction (L / M / Q / H)
- Export as PNG, SVG, or PDF
- Sign in to save and manage QR codes

## Local development

```bash
npm install
npm run db:local
npm run dev
```

Open http://localhost:8788

## Deploy on Cloudflare Pages

1. Push this repo to GitHub
2. **Workers & Pages** → **Create** → **Pages** → connect the repo
3. Build settings:
   - **Build command:** `npm install`
   - **Build output directory:** `/`
4. Add a **D1** database binding named `DB` (database: `qrs-r-us`)
5. Run the schema against production:

   ```bash
   npm run db:migrate
   ```
