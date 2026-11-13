# acanal.me

Personal research website for **Ángel Canal-Alonso**, built with Jekyll for GitHub Pages.

Repository: [AngelCanal/AngelCanal.github.io](https://github.com/AngelCanal/AngelCanal.github.io). The initial delivery uses the review branch `codex/research-portfolio`. Review its pull request before merging the website into `main` and configuring publication.

The site contains three research summaries and five selected published papers, checked against the supplied Scholar export, the University of Glasgow profile, and article records. The biography and summaries are drafts for review. Public email and CV links are still awaiting your preference.

## Review the website

The optional `design/acanal-design-preview.html` is a self-contained preview that opens directly in a browser. Download it before opening it; GitHub's file view displays its source. The `design` folder is excluded from the Jekyll output, so committing the preview does not add it to the published website.

The Observatory homepage follows model-generated multichannel activity into a reconstructed trajectory, then lets visitors apply a brief input. A separate three-dimensional research terrain links the selected papers through shared questions. Motion can be paused and reduced-motion preferences are respected. Figures on the individual research pages remain static conceptual illustrations, with their provenance in the captions.

The configuration currently includes:

```yaml
demo_mode: false
show_notes: false
design: manuscript
```

`demo_mode: false` keeps the draft banner out of the public Jekyll build. The standalone preview adds its own design-review banner and `noindex` tag. Its embedded article dialogs also belong only to that preview; the public site opens ordinary research pages. The `design` directory remains excluded from publishing. The banner setting does not control access or privacy.

### Observatory, selected

The selected direction retains the dark Observatory palette and editorial layout. On desktops wider than 900px and taller than 810px, Figure 1 remains alongside a compact reading sequence. Three short steps introduce the signals, their reconstruction, and the stimulation interaction. The primary hero link leads straight to Publications; visitors can also go directly to Research. The three stage buttons work directly. Compact or shorter layouts keep the figure in normal page flow.

The paper terrain has five basins. Introductory guidance explains that its regions group related research questions. Each region names a concrete question, and each connection states the shared subject. Selecting a marker reveals the full citation, a short account of the study, and related questions. Paper links are ordinary HTML. The map is an authored navigation device; distance, height and basin depth are not measurements of similarity, scientific merit or clinical effectiveness.

### Figure 1: scientific construction

`assets/js/kuramoto.js` implements a seeded, reproducible Kuramoto phase-oscillator network:

```text
dθ_i/dt = ω_i + (K/N) Σ_j sin(θ_j − θ_i)
          + A e(t) sin(φ_i(t) − θ_i)
```

The final term exists only during an illustrative input. The network has 16 heterogeneous oscillators, mean frequency 1.35 Hz, and coupling K = 2.4 per model second. RK4 integrates at 120 Hz; observations are recorded at 30 Hz. Model time advances at half real-time speed in the animated figure.

Six channels are weighted observations of `sin(θ_i) + 0.18 sin(2θ_i)`. Each channel contributes its current value and values delayed by 0.133, 0.267 and 0.400 model seconds. The resulting 24-dimensional vector is standardized and projected with one fixed PCA basis trained on a reference simulation containing baseline, inputs and recovery. The three displayed components explain approximately 83.4% of that reference variance. This is a three-dimensional view of a reconstruction, not a guarantee that three coordinates embed the complete network state.

The input has a 1.6-model-second sine-squared envelope and a sinusoidal phase response. Four subgroups receive different target phases. The input changes the actual differential equations; coupling continues throughout. A six-second cooldown after the input allows the subsequent evolution to remain visible. The original scale and PCA basis are retained. The gold trace segments correspond to samples recorded during the input; a faint pre-input trajectory remains for comparison.

The phase-only model illustrates coordination and transient response. It has no independent amplitude variable, so the figure makes no claim of a single-oscillator amplitude Hopf bifurcation. It is not fitted to neural recordings or validated as a seizure or treatment model. For reduced motion or paused motion, the pulse produces a still snapshot at 1.2 model seconds; Reset restores the exact initial history.

Scientific references: [Kuramoto, 1975](https://doi.org/10.1007/BFb0013365), [Deyle and Sugihara, 2011](https://doi.org/10.1371/journal.pone.0018295), and [Ko and Ermentrout, 2009](https://doi.org/10.1103/PhysRevE.79.016211). All selected numerical settings are illustrative.

Run the numerical checks without installing dependencies:

```bash
node scripts/check-kuramoto.cjs
```

The checks independently reconstruct plotted points from the displayed channel samples, exercise the pulse and reset, compare different animation frame schedules, and test a bounded simulation with repeated inputs. Regenerate the static Figure 1 fallback with:

```bash
node scripts/export-kuramoto-figure.cjs
```

Regenerate the research terrain fallback after changing its geometry or paper positions:

```bash
python scripts/export-landscape-figure.py
```

This development-only exporter requires Node.js and Python with PyYAML. It reuses the live terrain mathematics, checks each local minimum, and updates the fallback SVG and marker coordinates. The published website has no Python dependency.

### Check the Jekyll build

The workflow in `.github/workflows/check.yml` runs on pull requests, pushes to `main`, and manual dispatch. It first checks the numerical model, builds the site using the GitHub Pages Jekyll environment, checks key generated files, and uploads a `jekyll-site-preview` artifact. It does not deploy the website.

Open the pull request's **Checks** tab or the repository's **Actions** tab for the current result. A successful run verifies that the committed source builds and passes the output checks. Review the generated site in a browser as well to assess the layout and interactions. The standalone preview supports design review; the workflow checks the actual publishing source.

## Edit the content

| File or folder | What to change |
| --- | --- |
| `_config.yml` | Domain, review banner, selected design, and visibility of the notes section. |
| `_data/profile.yml` | Name, introduction, affiliation, biography, and public links. |
| `_data/publications.yml` | Selected papers, stable IDs, author lists, summaries, and paper/code/data links. |
| `_data/landscape.yml` | Paper labels, basin positions, research regions, and the meaning of each connection. |
| `_projects/` | Research summaries and future project pages. |
| `_notes/` | Optional research or personal notes. |
| `_layouts/default.html` | Shared navigation, page structure, and footer. |
| `_layouts/article.html` | Project and note page layout. |
| `assets/css/site.css` | Colors, type, spacing, and responsive layout. |
| `assets/js/site.js` | Reconstruction drawing, scroll sequence, and interaction controls. |
| `assets/js/kuramoto.js` | The scientific generator, observations, delay coordinates, and fixed projection. |
| `assets/js/landscape.js` | Terrain geometry, paper selection, and label placement. |
| `assets/css/landscape.css` | Terrain layout, paper labels, and detail panel. |
| `CNAME` | The custom domain used by branch-based Pages publishing. |

Everyday updates belong in the YAML data and Markdown pages. You do not need to edit animation code to add a paper.

### Biography, email, and CV

The current introduction paraphrases the official [University of Glasgow profile](https://www.gla.ac.uk/pgrs/angelcanalalonso/). The biography uses first-person wording and facts already verified in that profile. A research-question aside replaces the oversized monogram. Personal history and a portrait still need user-provided content. The Scholar, ORCID, GitHub, and university-profile links are populated.

`email` and `cv` are deliberately empty and their links stay hidden. Until an email is supplied, navigation says Profiles and the final section says Find me online. Enter your preferred public email to switch those labels to Contact and Get in touch and show a mailto link. For a CV, add the PDF to an assets folder, then set `cv` to its path. Owning `acanal.me` does not create an email mailbox; an address at that domain requires an email service or forwarding setup.

### Publications and project pages

The publication list is a selection, not a complete bibliography. It uses the published **2026 Brain Stimulation article**, without duplicating its SSRN preprint. Publisher metadata takes precedence where imported Scholar or institutional metadata differs; source comments record the author-list checks. Data links are included for the reservoir-computing and time-series-segmentation papers.

To add a publication, copy an entry in `_data/publications.yml` and preserve these fields:

```yaml
id: my-paper
title: "Exact paper title"
authors: "Authors in publication order"
venue: "Journal or conference, volume and article number"
year: 2026
summary: "A short, accurate description of the work."
paper: "https://doi.org/..."
code: ""
data: ""
```

Entries are displayed in file order. Give each paper a unique `id`; add a matching entry in `_data/landscape.yml` if it should appear on the terrain. Optional `landscape_id` front matter on a project links its scroll position to a paper marker. Leave unavailable links empty. YAML uses indentation, so keep spaces aligned and quote text containing a colon.

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

The remaining personal choices are biography wording, public email, CV, and whether to publish notes. Observatory, the Kuramoto generator, and the selected papers have been chosen. Registrar-specific DNS instructions can be tailored once the provider is known.
