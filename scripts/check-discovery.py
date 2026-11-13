#!/usr/bin/env python3
"""Check the actual Jekyll output for crawler files and research metadata."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import sys
import xml.etree.ElementTree as ET


def require(condition, message):
    if not condition:
        raise SystemExit(f"Discovery check failed: {message}")


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.meta, self.scripts, self.markers = [], [], []
        self.publications = {}
        self.script = self.publication = None
        self.in_title = False
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "meta":
            self.meta.append(attrs)
        if tag == "script":
            self.script = {"attrs": attrs, "text": ""}
        if "data-landscape-marker" in attrs:
            self.markers.append(attrs["data-landscape-marker"])
        if tag == "li" and attrs.get("id", "").startswith("paper-"):
            self.publication = {"title": "", "text": "", "links": []}
            self.publications[attrs["id"][6:]] = self.publication
        if self.publication is not None:
            if tag == "h3":
                self.in_title = True
            if tag == "a" and "href" in attrs:
                self.publication["links"].append(attrs["href"])

    def handle_data(self, data):
        if self.script is not None:
            self.script["text"] += data
        if self.publication is not None:
            self.publication["text"] += data
            if self.in_title:
                self.publication["title"] += data

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.scripts.append(self.script)
            self.script = None
        if tag == "h3":
            self.in_title = False
        if tag == "li":
            self.publication = None


output = Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve()
source = Path(__file__).resolve().parents[1]
canonical = "https://acanal.me/"
texts = {}
for filename in ("robots.txt", "llms.txt", "llms-full.txt", "index.md"):
    path = output / filename
    require(path.is_file(), f"missing {filename}")
    text = path.read_text(encoding="utf-8").strip()
    require(text, f"empty {filename}")
    require(not re.search(r"<!doctype|<html\b|<head\b|<body\b", text, re.I), f"HTML layout in {filename}")
    require("{{" not in text and "{%" not in text and not text.startswith("---"), f"unrendered Jekyll content in {filename}")
    require("mailto:" not in text.lower(), f"email contact in {filename}")
    if filename != "robots.txt":
        require(text.startswith("# Ángel Canal-Alonso"), f"missing researcher heading in {filename}")
    texts[filename] = text
require(re.search(r"(?m)^Sitemap:\s*https://acanal\.me/sitemap\.xml\s*$", texts["robots.txt"]), "robots.txt sitemap URL")
for endpoint in ("index.md", "llms-full.txt"):
    require(canonical + endpoint in texts["llms.txt"], f"llms.txt does not link to {endpoint}")
require(texts["index.md"] == texts["llms-full.txt"], "Markdown and full-text research summaries have diverged")

sitemap_path = output / "sitemap.xml"
require(sitemap_path.is_file(), "missing sitemap.xml")
sitemap = ET.fromstring(sitemap_path.read_text(encoding="utf-8"))
ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
require(sitemap.tag == "{" + ns["s"] + "}urlset", "sitemap namespace")
locations = [element.text for element in sitemap.findall("s:url/s:loc", ns)]
require(canonical in locations and len(locations) == len(set(locations)), "sitemap homepage or duplicate URLs")
for location in locations:
    url = urlsplit(location or "")
    require(url.scheme == "https" and url.netloc == "acanal.me" and not url.query and not url.fragment, f"noncanonical sitemap URL: {location}")
    path = unquote(url.path)
    require(path != "/404.html" and not path.startswith("/design/") and path != "/notes/on-making-research-visible/", f"excluded page in sitemap: {path}")
    require(not path.endswith((".txt", ".md", ".xml")), f"discovery endpoint in sitemap: {path}")
    target = output / path.lstrip("/")
    if path.endswith("/"):
        target /= "index.html"
    require(target.is_file(), f"sitemap target was not built: {path}")

# Undated collection documents receive the build time from Jekyll. Accept dates
# only when an author explicitly supplied last_modified_at in source front matter.
explicit_dates = set()
for path in source.rglob("*"):
    if not path.is_file() or path.suffix not in (".md", ".html"):
        continue
    if path.relative_to(source).parts[0] in ("_site", "design", "vendor", "node_modules", ".git"):
        continue
    text = path.read_text(encoding="utf-8")
    if text.startswith("---\n"):
        front_matter = text.split("---", 2)[1]
        explicit_dates.update(re.findall(r"(?m)^last_modified_at:\s*['\"]?(\d{4}-\d{2}-\d{2})", front_matter))
for modified in sitemap.findall("s:url/s:lastmod", ns):
    require((modified.text or "")[:10] in explicit_dates, "sitemap lastmod has no explicit source date")

home = Page((output / "index.html").read_text(encoding="utf-8"))
not_found = Page((output / "404.html").read_text(encoding="utf-8"))
robots = lambda page: " ".join(meta.get("content", "").lower() for meta in page.meta if meta.get("name", "").lower() in ("robots", "googlebot"))
require("noindex" not in robots(home), "production homepage is noindex")
require("noindex" in robots(not_found), "404 page needs noindex")
schemas = [json.loads(script["text"]) for script in home.scripts if script["attrs"].get("type") == "application/ld+json"]
profiles = [schema for schema in schemas if schema.get("@type") == "ProfilePage"]
require(len(profiles) == 1, "homepage needs one ProfilePage JSON-LD record")
person = profiles[0].get("mainEntity", {})
require(person.get("@type") == "Person" and person.get("name") == "Ángel Canal-Alonso", "ProfilePage identity")
require(profiles[0].get("url") == canonical and person.get("url") == canonical, "ProfilePage canonical URLs")
require("https://linkedin.com/in/angel-canal" in person.get("sameAs", []), "LinkedIn identity link")
require("email" not in person and "image" not in person, "unapproved email or profile image")

config = next((json.loads(script["text"]) for script in home.scripts if "data-landscape-config" in script["attrs"]), None)
require(config is not None, "missing rendered research classification")
papers = config["papers"]
require(set(home.markers) == set(papers) and len(home.markers) == len(set(home.markers)), "research markers disagree with classifications")
require(set(papers).issubset(home.publications), "mapped paper has no bibliography entry")
require(papers["tsg-ddt"]["region"] == "how" and papers["transformer-mea"]["region"] == "when", "synthetic signals and seizure prediction need their assigned questions")
if config["regions"]["where"].get("status") == "Work in progress":
    require(not any(paper["region"] == "where" for paper in papers.values()), "Where work in progress cannot be a publication")
require(home.publications, "empty rendered bibliography")
full_text = texts["llms-full.txt"]
for paper in home.publications.values():
    title = paper["title"].strip()
    heading = "### " + title
    require(heading in full_text, f"missing text citation: {title}")
    body = full_text.split(heading, 1)[1].split("\n##", 1)[0]
    for link in paper["links"]:
        require(link in body, f"missing text citation link: {link}")
    for kind in ("Conference abstract", "Conference paper"):
        if kind in paper["text"]:
            require(kind in body, f"missing publication type for {title}")

print(json.dumps({"discovery": "passed", "sitemap_urls": len(locations), "publications": len(home.publications), "mapped_studies": len(papers), "plaintext_endpoints": list(texts)}, ensure_ascii=False))
