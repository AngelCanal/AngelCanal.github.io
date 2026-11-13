# acanal.me

Personal research website for **Ángel Canal-Alonso**, built with Jekyll for GitHub Pages.

Repository: [AngelCanal/AngelCanal.github.io](https://github.com/AngelCanal/AngelCanal.github.io). The initial delivery uses the review branch `codex/research-portfolio`. Review its pull request before merging the website into `main` and configuring publication.

The site contains three research summaries and five selected published papers, checked against the supplied Scholar export, the University of Glasgow profile, and article records. The biography and summaries are drafts for review. Public email and CV links are still awaiting your preference.

## Review the website

The optional `design/acanal-design-preview.html` is a self-contained preview that opens directly in a browser. Download it before opening it; GitHub's file view displays its source. The `design` folder is excluded from the Jekyll output, so committing the preview does not add it to the published website.

The homepage has an animated, synthetic figure with a pause control and support for reduced-motion preferences. Figures on the individual research pages are static conceptual illustrations. They are not experimental recordings, anatomical maps, or figures from the papers. Their captions state this explicitly.

The configuration currently includes:

```yaml
demo_mode: true
show_notes: false
design: manuscript
```

`demo_mode: true` displays a content-review banner. Change it to `false` after reviewing the biography, summaries, links, and design. This setting controls the banner; it does not make a deployed site private.

### Choose the design

Use the preview's controls to compare the treatments. Set `design` in `_config.yml` to the one you want to publish.

| Design name | Configuration value | Direction |
| --- | --- | --- |
| Observatory | `manuscript` | Editorial typography and a slowly changing figure. This is the current default. |
| Signal room | `signal` | A wider signal display with an instrument-like layout. |
| Research atlas | `atlas` | A spatial map whose nodes link to sections of the site. |

The atlas is navigation, not a diagram claiming scientific relationships between the topics.

### Check the Jekyll build

The workflow in `.github/workflows/check.yml` runs on pull requests, pushes to `main`, and manual dispatch. It builds the site using the GitHub Pages Jekyll environment, checks key generated files, and uploads a `jekyll-site-preview` artifact. It does not deploy the website.

Open the pull request's **Checks** tab or the repository's **Actions** tab for the current result. A successful run verifies that the committed source builds and passes the output checks. Review the generated site in a browser as well to assess the layout and interactions. The standalone preview supports design review; the workflow checks the actual publishing source.

## Edit the content

| File or folder | What to change |
| --- | --- |
| `_config.yml` | Domain, review banner, selected design, and visibility of the notes section. |
| `_data/profile.yml` | Name, introduction, affiliation, biography, and public links. |
| `_data/publications.yml` | Selected papers, author lists, summaries, and paper/code/data links. |
| `_projects/` | Research summaries and future project pages. |
| `_notes/` | Optional research or personal notes. |
| `_layouts/default.html` | Shared navigation, page structure, and footer. |
| `_layouts/article.html` | Project and note page layout. |
| `assets/css/site.css` | Colors, type, spacing, and responsive layout. |
| `assets/js/site.js` | Homepage motion, figure drawing, and interactions. |
| `CNAME` | The custom domain used by branch-based Pages publishing. |

Everyday updates belong in the YAML data and Markdown pages. You do not need to edit animation code to add a paper.

### Biography, email, and CV

The current introduction paraphrases the official [University of Glasgow profile](https://www.gla.ac.uk/pgrs/angelcanalalonso/). Review its wording and add the personal details you want to share. The Scholar, ORCID, and GitHub links are populated.

`email` and `cv` are deliberately empty and their links stay hidden. Enter your preferred public email when ready. For a CV, add the PDF to an assets folder, then set `cv` to its path. Owning `acanal.me` does not create an email mailbox; an address at that domain requires an email service or forwarding setup.

### Publications and project pages

The publication list is a selection, not a complete bibliography. It uses the published **2026 Brain Stimulation article**, without duplicating its SSRN preprint. Publisher metadata takes precedence where imported Scholar or institutional metadata differs; source comments record the author-list checks. Data links are included for the reservoir-computing and time-series-segmentation papers.

To add a publication, copy an entry in `_data/publications.yml` and preserve these fields:

```yaml
title: "Exact paper title"
authors: "Authors in publication order"
venue: "Journal or conference, volume and article number"
year: 2026
summary: "A short, accurate description of the work."
paper: "https://doi.org/..."
code: ""
data: ""
```

Entries are displayed in file order. Leave unavailable links empty. YAML uses indentation, so keep spaces aligned and quote text containing a colon.

For another project, copy a Markdown file in `_projects/`, replace its front matter and body, and set its `order`. Front matter is the YAML block between the two `---` lines. Keep the fields used by the existing pages. Explain the question and approach, then link to the work. Distinguish conceptual illustrations from research data.

### Optional notes

The homepage's notes section is hidden with `show_notes: false`. The supplied note also has `published: false`, so it is not built as a public page.

To publish your first note, replace the example text, set that note's `published` to `true` and `example` to `false`, and set `show_notes: true` in `_config.yml`. Hiding the homepage section alone does not unpublish an existing note; use the note's `published` field for that.

## Publish at acanal.me

Use GitHub's built-in Jekyll publishing from `main` and the repository root. The included check workflow supports review; publication is configured in **Settings → Pages**. GitHub can build the site without Ruby on your computer. [Publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

### 1. Verify the domain

Before pointing DNS at GitHub:

1. Sign in as `AngelCanal` and open your **account Settings → Pages → Add a domain**.
2. Enter `acanal.me`.
3. Add the TXT record supplied by GitHub at your DNS provider.
4. Return to GitHub and choose **Verify** once the record is visible.
5. Keep the TXT record after verification.

Verification is an account setting. Selecting a website's custom domain is a separate repository setting. Copy GitHub's exact TXT name and value, following your provider's hostname format so `acanal.me` is not appended twice. [Domain-verification documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)

### 2. Merge the reviewed site and enable Pages

After reviewing the content and a successful build check, merge the pull request into `main`. In the existing [repository](https://github.com/AngelCanal/AngelCanal.github.io), open **Settings → Pages** and select:

| Setting | Value |
| --- | --- |
| Source | Deploy from a branch |
| Branch | `main` |
| Folder | `/ (root)` |
| Custom domain | `acanal.me` |

The supplied `CNAME` file contains `acanal.me`. Keep it in the source for this publishing route. It should contain only the domain, without a protocol or path. [Custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

For a first test at `https://angelcanal.github.io`, leave the custom-domain setting empty, temporarily omit `CNAME`, and set `url: "https://angelcanal.github.io"` in `_config.yml`. Restore `CNAME` and `url: "https://acanal.me"` when connecting the domain. Keep `baseurl: ""`. Once a custom domain is configured, the default GitHub address may redirect there before DNS is ready.

### 3. Set the website DNS records

After saving `acanal.me` in the repository's Pages settings, add these records at your DNS provider. `@` represents `acanal.me`.

| Type | Host/name | Target/value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `AngelCanal.github.io` |

The `www` target has no protocol or repository path. With both names configured, GitHub redirects `www.acanal.me` to `acanal.me`. Avoid wildcard records. [DNS configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

For optional IPv6 support, retain the A records and add:

| Type | Host/name | Target/value |
| --- | --- | --- |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

Replace conflicting parking or old website records for these hostnames. Preserve email MX records, the verification TXT record, and unrelated TXT records. Conflicting website records can prevent certificate issuance. [HTTPS and DNS guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

### 4. Enable HTTPS

After the DNS check succeeds and the certificate is ready, select **Enforce HTTPS** in Pages settings. GitHub advises allowing up to 24 hours for DNS propagation and for the HTTPS option to become available. [Custom-domain guidance](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

Visit `https://acanal.me`, open each research page, and check the paper and data links. Review the phone layout and motion controls. Confirm that `https://www.acanal.me` redirects to the chosen address.

For a build failure, read the failed step in the **Actions** tab. Check YAML indentation and Markdown front matter. Keep `.nojekyll` out of this source because the templates require Jekyll processing. [Jekyll and GitHub Pages](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll)

## Optional local preview

After installing Ruby and Bundler using [GitHub's local-testing guide](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/testing-your-github-pages-site-locally-with-jekyll), run these commands in the repository:

```bash
bundle install
bundle exec jekyll serve
```

Open the local address printed by Jekyll, normally `http://127.0.0.1:4000`. To build without starting a server, run `bundle exec jekyll build`.

The included `Gemfile` uses the GitHub Pages dependencies and `webrick`. The official dependency list reports `github-pages` 232 and Jekyll 3.10.0 when checked. [Dependency versions](https://pages.github.com/versions/)

## Sources and remaining choices

Research sources are linked in the project pages and recorded in comments beside the publication entries. The official GitHub documentation above was checked on **2026-11-13**.

The remaining personal choices are the design treatment, biography wording, public email, CV, and whether to publish notes. Registrar-specific DNS instructions can be tailored once the provider is known.
