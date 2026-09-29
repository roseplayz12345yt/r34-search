# R34 Search

Unofficial **client-side** search UI for [Rule34.xxx](https://rule34.xxx). It runs entirely in the browser on GitHub Pages and talks to the official API.

**18+ only. Explicit adult content.**

## Live site

After GitHub Pages is enabled this repo is served at:

https://roseplayz12345yt.github.io/r34-search/

If that 404s, open the repo **Settings → Pages**, set Source to **GitHub Actions** (or Deploy from branch `main` / `/`), then wait a minute.

## Why you need an API key

In August 2025 Rule34.xxx started requiring `user_id` and `api_key` on `api.rule34.xxx`. This site never embeds a shared key (that would violate their terms and get keys banned).

1. Create a Rule34 account
2. Open [Account Options](https://rule34.xxx/index.php?page=account&s=options)
3. Under **API Access Credentials**, generate a key and save
4. Paste User ID + API key into this site. They stay in `localStorage` on your device.

You can paste the whole `&api_key=…&user_id=…` string into either field.

## What this is / is not

- Is: a static frontend with tag search, autocomplete, rating/sort filters, AI exclusion, blacklist, pagination, and a lightbox for images/video
- Is not: a host, scraper, cache, or official Rule34 product
- Follow [Rule34 API terms](https://api.rule34.xxx/): no ads or paywalls on the client, don’t rotate multiple keys

## Local preview

Open `index.html` in a browser. No build step.
