# Bharat Sales

Open-source outreach assistant that runs as a website: find businesses, read their sites, write a personal first email, follow up, triage replies, and offer meeting times from the hours you are free.

- `/` marketing site, `/builder` about the builder, `/dashboard` the tool.
- No accounts and no database. Leads and settings live in the visitor's browser.
- Visitors paste their own AI key (Anthropic, OpenAI, Gemini or OpenRouter) in **Dashboard → Settings**. It goes from their browser straight to that provider.
- Nothing is sent for them: approved emails open in Gmail or the mail app and the visitor presses send.

## Deploy (GitHub + Vercel)

1. Unzip this folder.
2. Edit `assets/js/config.js` and set `SOURCE_URL` to your new repository's URL (the AGPL asks you to link the source).
3. Create an empty repository on GitHub, then in this folder:
   ```
   git init
   git add .
   git commit -m "Bharat Sales"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
   git push -u origin main
   ```
4. On vercel.com choose **Add New → Project**, import the repository, set **Framework Preset: Other**, leave Build Command and Output Directory empty, and press **Deploy**.
5. Vercel gives you the URL. Open it: the marketing site shows first, in the light theme. Visitors can switch to dark with the toggle.

The folder `api/` holds one serverless function (`/api/fetch`) that reads a public web page for the dashboard. It refuses private and internal network addresses. Everything else is static files.

## What to know

- **Light theme is the default** for everyone; the toggle remembers a visitor's choice in their browser.
- **Map search** uses the public OpenStreetMap services (Nominatim and Overpass). They have fair-use limits and coverage varies by region.
- **Email addresses are not verified.** Keep sending volume modest and honour opt-outs.
- **Data is per browser.** Settings → Export backup / Import backup moves it between devices.
- Run locally: any static server with clean URLs works, e.g. `npx vercel dev`.

## Licence

GNU AGPL-3.0-only. Based on [Sellbird](https://github.com/ethanplusai/sellbird). See `LICENSE` and `NOTICE`.
