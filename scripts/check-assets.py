#!/usr/bin/env python3
"""Check built pages for matching asset versions and Figure 1 script order."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import json
import re
import sys


def require(condition, message):
    if not condition:
        raise SystemExit(f"Asset check failed: {message}")


class Assets(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.styles, self.scripts = [], []
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "link" and "stylesheet" in attrs.get("rel", "").split():
            self.styles.append(attrs)
        if tag == "script" and "src" in attrs:
            self.scripts.append(attrs)


output = Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve()
pages = sorted(output.rglob("*.html"))
require(output / "index.html" in pages, "missing homepage")
versions = set()
references = 0
for page in pages:
    assets = Assets(page.read_text(encoding="utf-8"))
    paths = {"styles": [], "scripts": []}
    for kind, entries, attribute in (
        ("styles", assets.styles, "href"),
        ("scripts", assets.scripts, "src"),
    ):
        for attrs in entries:
            url = urlsplit(attrs.get(attribute, ""))
            if url.scheme or url.netloc:
                continue
            label = f"{page.relative_to(output)}: {url.path}"
            version = parse_qs(url.query).get("v", [])
            require(len(version) == 1 and re.fullmatch(r"(?:[0-9a-f]{40}|[0-9]{10})", version[0]), f"missing build version in {label}")
            versions.add(version[0])
            target = output / url.path.lstrip("/") if url.path.startswith("/") else page.parent / url.path
            require(target.is_file() and target.stat().st_size > 0, f"missing asset for {label}")
            paths[kind].append(url.path)
            if kind == "scripts":
                require("defer" in attrs and "async" not in attrs, f"unordered script loading in {label}")
            references += 1
    require(paths["styles"] == ["/assets/css/site.css", "/assets/css/landscape.css"], f"missing styles in {page.relative_to(output)}")
    require(paths["scripts"] == ["/assets/js/kuramoto.js", "/assets/js/site.js", "/assets/js/landscape.js"], f"Figure 1 dependency order in {page.relative_to(output)}")
require(len(versions) == 1, "pages mix different asset versions")
print(json.dumps({"assets": "passed", "pages": len(pages), "references": references, "version": next(iter(versions))}))
