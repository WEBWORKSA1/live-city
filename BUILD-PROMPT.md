# Live.City — Concept, Revenue Model & Phase-Wise Build Prompt

## 1. The idea (and why it wins)

**Live.City = "the live pulse of the world's cities" + "help to live in a city."**

The domain carries two meanings, and this build uses both on purpose:

| Meaning | Product | Why it makes money |
|---|---|---|
| **Live** (adj., right now) | Real-time city dashboards: local time, weather, 7-day forecast, air quality, sunrise/sunset, live news, nearby earthquakes, live cams, map | Repeat daily visits, long sessions, many page views → AdSense inventory |
| **Live** (verb, to reside) | Relocation hub: compare cities, moving guides, "Get a free relocation plan" lead form | Lead buyers (movers, realtors, mortgage brokers, immigration consultants, schools, coworking) pay per lead or per month |

**Position taken:** AdSense is the floor, not the business. Relocation leads and city sponsorships are the business. A live-data site with no lead capture tops out at display-ad RPM; a live-data site that converts "just looking" traffic into "moving to Lisbon in 90 days" leads earns 10x+ per visitor.

### Unit economics (assumptions, not promises — tune with real data)

| Line | Assumption | Monthly |
|---|---|---|
| Traffic | 100,000 page views / 30,000 sessions | — |
| AdSense | $4–8 blended page RPM (travel / relocation / real-estate adjacent) | **$400–800** |
| Relocation leads | 20% of sessions see the relocate CTA → 8% complete the 4-step form → 480 leads × $15–30 | **$7,200–14,400** |
| City page sponsorships | 5 cities × $299 | **$1,495** |
| Featured listings / newsletter | 20 × $49 + 2 issues × $149 | **$1,278** |
| Donations | 0.1% of sessions × $15 | **$450** |

Lead revenue dominates. Every design decision below routes traffic toward `/relocate.html`.

## 2. Competitive research — 35 world-class sites in the niche

Grouped by what Live.City borrows from each.

**Live data & dashboards (10):** IQAir (AQI scale, health advice), AccuWeather, Weather.com, Windy (map-first data layers), Open-Meteo demo pages, timeanddate.com (world clock, sunrise/sunset), World Time Buddy (time-zone compare), Flightradar24 (live map + ad-supported freemium), Liveuamap (live news map), CASA CityDashboard (single-screen city overview).
→ *Borrowed:* one-screen city dashboard, colour-coded AQI bands, ticking local clocks, live map with layers, "updated X min ago" stamps.

**Live cams (5):** EarthCam, SkylineWebcams, Windy Webcams, WebcamTaxi, Panomax.
→ *Borrowed:* click-to-play facades (fast pages), city-tagged cam lists, sponsor branding on cams.

**City guides & editorial (8):** Time Out, Lonely Planet, Culture Trip, Atlas Obscura, Wikivoyage, Thrillist, Secret Media network, Condé Nast Traveler.
→ *Borrowed:* "best time to visit", highlight lists, rankings, long-form evergreen guides (AdSense approval needs real text).

**Relocation & livability data (7):** Nomads.com (ex-Nomad List), Numbeo, Expatistan, Teleport-style city scores, AreaVibes, Niche, Walk Score.
→ *Borrowed:* city cards with quick stats, filters by region/vibe, side-by-side compare with shareable URL, favourites, °C/°F toggle, membership/lead prompts on every section, email capture.

**Events, local & community (5):** Eventbrite, Meetup, Yelp, Fever, Patch.
→ *Borrowed:* "submit your event / business" funnels, featured (paid) placements, local-business advertising packages.

**Key patterns adopted from all 35:** sticky search with autocomplete · grid + map views · compare mode · dark mode · favourites · urgency cues ("live now") · multi-step lead forms with progress bars · trust strips (free / no obligation / 24h reply) · sponsor slots clearly labelled · newsletter capture · FAQ · transparent legal pages.

## 3. Phase-wise build prompt

> Copy any phase into an AI builder to reproduce or extend the site.

### Phase 1 — Foundation & compliance
Build a static, GitHub-Pages-ready site for **Live.City** (no build step, relative paths, `.nojekyll`). Add on every page: the AdSense script `ca-pub-6620975821265271` in `<head>`, `<meta name="google-adsense-account">`, a top bar reading "Contact, if you are interested in this website / domain name / Sponsorship / Advertisement / Partnership" linked to `https://web.works/contact`, a shared header/footer, cookie notice, and legal pages (Privacy with Google ad-cookie disclosures and opt-out links, Terms, Disclaimer with trademark/copyright disclosure, About, Contact). Add `ads.txt`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, 404 page. Never use the single-word spelling of the brand; always "Live.City".

### Phase 2 — Live data engine
Use only free, key-less, CORS-enabled sources: Open-Meteo forecast + air-quality APIs, Wikipedia REST summaries, USGS earthquake GeoJSON, GDELT DOC 2.0 news, wheretheiss.at, OpenStreetMap tiles via Leaflet. Cache responses in `sessionStorage`, time out after 8s, fall back to `data/snapshot.json`. Build a city dataset (`data/cities.json`) with original descriptions, highlights, best time to visit, timezone, currency, language.

### Phase 3 — Core experiences
- **Home:** live hero with world clocks, search, live city grid (one batched Open-Meteo call), "live now" stats, relocation CTA, guides, contest + donate teasers, newsletter, FAQ.
- **Cities directory:** filter by region, search, sort by temperature / local time / name, favourites, map view.
- **City dashboard:** live clock, current weather, 24h sparkline, 7-day forecast, AQI with health advice, sunrise/sunset/daylight, Wikipedia overview, live news, nearby earthquakes, map, live-cam links, sponsor slot, relocation + business CTAs.
- **Live wall:** all cities' clocks sorted by local time, live world map (temperature markers + earthquakes + ISS), featured 24/7 YouTube live stream (click-to-load), global news pulse.
- **Compare:** two cities side by side (time difference, weather, AQI, daylight, distance, flight estimate), shareable URL.

### Phase 4 — Revenue pages
- **Relocate (dedicated lead generation):** 4-step form with progress bar, pre-filled destination from any CTA, service checkboxes (movers, rentals, buy, mortgage, visa, schools, jobs, insurance, car shipping), timeline, budget, consent; trust strip; FAQ.
- **Advertise / Partner:** city-page sponsorship, featured listings, newsletter sponsorship, lead-partner programme (pay-per-lead), custom partnerships; partner application form.
- **Support (donations):** tiers mapped to uses — operations, promotions & marketing, hiring talent, contests & prizes; pledge form; optional payment links in config.
- **Contests:** monthly skill-judged photo contest, prizes, rules (no purchase necessary), entry form, "sponsor a prize" form.
- **Careers:** correspondents, cam curator, developer, growth marketer, video creator, partnerships; application form.
All forms post via AJAX to a form relay; the destination address is assembled in JavaScript at runtime and never appears in HTML or on screen.

### Phase 5 — Content for AdSense approval
Six or more original long-form guides (AQI, relocation checklist, data-first city comparison, live webcams, time-zone work, forecast reading), each 600+ words, internal links to tools, no scraped text.

### Phase 6 — Automation (self-updating)
GitHub Action every 6 hours: refresh `data/snapshot.json` (weather + AQI for every city, 24h quake count), regenerate static SEO pages `city/<slug>/index.html` from `data/cities.json`, rebuild `sitemap.xml` with fresh `lastmod`, commit, and request a Pages build. Adding a city = adding one JSON object.

### Phase 7 — QA & launch
Headless-browser check of every page (no console errors, forms reach success state, email address absent from all source), Lighthouse ≥90 mobile, push to `main`, enable GitHub Pages (main / root), point Live.City DNS to GitHub Pages, add site in AdSense, enable Google's certified CMP for EEA/UK, request review.

### Phase 8 — Scale
Add 100+ cities, per-city event submissions, city newsletters, sponsor dashboards, affiliate blocks (insurance, eSIM, coworking), localisation (FR/ES/HI), and YouTube channel of city "live minutes".
