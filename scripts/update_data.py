#!/usr/bin/env python3
"""Live.City automation (runs every 6h in GitHub Actions, stdlib only).

1. Refreshes data/snapshot.json (weather + AQI for every city, 24h quake count)
   - used as instant fallback when browsers can't reach live APIs.
2. Generates static, crawlable SEO pages city/<slug>/index.html from city.html
   + data/cities.json (skip with --no-pages).
3. Rebuilds sitemap.xml with fresh lastmod dates.

Add a city: append one object to data/cities.json and push. Everything else is automatic.
"""
import datetime as dt, html, json, pathlib, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://live.city/'
CITIES = json.loads((ROOT / 'data/cities.json').read_text(encoding='utf-8'))
NOW = dt.datetime.now(dt.timezone.utc)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'LiveCityBot/1.0 (+https://live.city)'})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode('utf-8'))


def snapshot():
    la = ','.join(str(c['la']) for c in CITIES)
    lo = ','.join(str(c['lo']) for c in CITIES)
    out = {'updated': NOW.isoformat(timespec='seconds'), 'cities': {}, 'quakes24': None}
    try:
        w = get(f'https://api.open-meteo.com/v1/forecast?latitude={la}&longitude={lo}&current=temperature_2m,weather_code,is_day,wind_speed_10m,relative_humidity_2m')
        w = w if isinstance(w, list) else [w]
    except Exception as e:
        print('weather failed', e); w = []
    try:
        a = get(f'https://air-quality-api.open-meteo.com/v1/air-quality?latitude={la}&longitude={lo}&current=us_aqi')
        a = a if isinstance(a, list) else [a]
    except Exception as e:
        print('aqi failed', e); a = []
    for i, c in enumerate(CITIES):
        cw = (w[i].get('current') if i < len(w) else None) or {}
        ca = (a[i].get('current') if i < len(a) else None) or {}
        out['cities'][c['s']] = {'t': cw.get('temperature_2m'), 'code': cw.get('weather_code'), 'day': cw.get('is_day'),
                                 'wind': cw.get('wind_speed_10m'), 'hum': cw.get('relative_humidity_2m'), 'aqi': ca.get('us_aqi')}
    try:
        out['quakes24'] = get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')['metadata']['count']
    except Exception as e:
        print('usgs failed', e)
    old = ROOT / 'data/snapshot.json'
    if not any(v['t'] is not None for v in out['cities'].values()) and old.exists():
        print('no fresh weather; keeping previous snapshot'); return
    old.write_text(json.dumps(out, separators=(',', ':')), encoding='utf-8')
    print('snapshot written')


def city_pages():
    tpl = (ROOT / 'city.html').read_text(encoding='utf-8')
    for c in CITIES:
        e = lambda s: html.escape(s, quote=True)
        title = f"{c['n']} Live — Time, Weather, Air Quality, News &amp; Cams | Live.City"
        desc = e(f"Live {c['n']}, {c['c']} dashboard: local time, current weather, 7-day forecast, air quality, sunrise and sunset, news, earthquakes and live cams. Moving to {c['n']}? Get a free relocation plan.")
        url = f"{SITE}city/{c['s']}/"
        p = tpl
        p = p.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../../">', 1)
        p = p.replace(p[p.index('<title>'):p.index('</title>') + 8], f'<title>{title}</title>', 1)
        p = p.replace(p[p.index('<meta name="description"'):p.index('>', p.index('<meta name="description"')) + 1], f'<meta name="description" content="{desc}">', 1)
        p = p.replace('href="https://live.city/city.html"', f'href="{url}"').replace('content="https://live.city/city.html"', f'content="{url}"')
        p = p.replace('<body data-page="city">', f'<body data-page="city" data-slug="{c["s"]}">')
        p = p.replace('<h1 id="cityname" style="margin:10px 0 4px">Loading…</h1>', f'<h1 id="cityname" style="margin:10px 0 4px">{e(c["n"])}</h1>')
        p = p.replace('<p id="citydesc"></p>', f'<p id="citydesc">{e(c["d"])}</p>')
        p = p.replace('<ul class="checks" id="cityhl"></ul>', '<ul class="checks" id="cityhl">' + ''.join(f'<li>{e(h)}</li>' for h in c['h']) + '</ul>')
        p = p.replace('<span id="citybt"></span>', f'<span id="citybt">{e(c["bt"])}</span>')
        p = p.replace('<span data-city>City</span>', f'<span data-city>{e(c["n"])}</span>')
        ld = {'@context': 'https://schema.org', '@type': 'City', 'name': c['n'], 'description': c['d'],
              'geo': {'@type': 'GeoCoordinates', 'latitude': c['la'], 'longitude': c['lo']},
              'containedInPlace': {'@type': 'Country', 'name': c['c']}, 'url': url}
        p = p.replace('</head>', f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n</head>', 1)
        d = ROOT / 'city' / c['s']; d.mkdir(parents=True, exist_ok=True)
        (d / 'index.html').write_text(p, encoding='utf-8')
    print(f'{len(CITIES)} city pages written')


def sitemap(with_pages):
    today = NOW.date().isoformat()
    urls = []
    for f in sorted(ROOT.rglob('*.html')):
        rel = f.relative_to(ROOT).as_posix()
        if rel in ('404.html', 'city.html') or rel.startswith(('city/', 'scripts/', '.github/')):
            continue
        urls.append((rel.replace('index.html', ''), '0.8' if '/' in rel else '0.9'))
    for c in CITIES:
        urls.append((f"city/{c['s']}/" if with_pages else f"city.html?c={c['s']}", '0.9'))
    body = ''.join(f'<url><loc>{SITE}{html.escape(u)}</loc><lastmod>{today}</lastmod><changefreq>hourly</changefreq><priority>{p}</priority></url>\n' for u, p in urls)
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '</urlset>\n', encoding='utf-8')
    print(f'sitemap: {len(urls)} urls')


if __name__ == '__main__':
    pages = '--no-pages' not in sys.argv
    snapshot()
    if pages:
        city_pages()
    sitemap(pages or (ROOT / 'city').exists())
