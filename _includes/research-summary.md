# {{ site.data.profile.name }}

> {{ site.data.profile.intro }}

{{ site.data.profile.role }}.

Source: [Personal research portfolio]({{ '/' | absolute_url }}).

## Research questions
{% for region in site.data.landscape.regions %}
### {{ region[1].label }}

{{ region[1].question }}
{% if region[1].status %}
Status: {{ region[1].status }}.

{{ region[1].detail }}
{% else %}
Related studies:
{% for map_entry in site.data.landscape.papers %}{% if map_entry[1].region == region[0] %}{% for paper in site.data.publications %}{% if paper.id == map_entry[0] %}
- [{{ map_entry[1].label }}]({{ paper.paper }}), {{ paper.year }}. {{ paper.publication_type | default: 'Journal article' }}.
{% endif %}{% endfor %}{% endif %}{% endfor %}
{% endif %}{% endfor %}

## Selected publications

This selection contains {{ site.data.publications.size }} entries. [Google Scholar]({{ site.data.profile.scholar }}) provides a broader publication profile. The descriptions below are the portfolio's summaries; the linked publications contain the original studies.
{% for paper in site.data.publications %}
### {{ paper.title }}

{{ paper.authors }}.

{{ paper.year }}. {{ paper.venue }}. {{ paper.publication_type | default: 'Journal article' }}.

{{ paper.summary }}

- [{{ paper.link_label | default: 'Paper' }}]({{ paper.paper }})
{% if paper.data and paper.data != '' %}- [Data]({{ paper.data }})
{% endif %}{% if paper.code and paper.code != '' %}- [Code]({{ paper.code }})
{% endif %}{% if paper.link_note %}
{{ paper.link_note }}
{% endif %}{% endfor %}

## About

{{ site.data.profile.about }}

{{ site.data.profile.about_note }}

## About the interactive figures

The first figure uses a network of 16 Kuramoto phase oscillators to generate six observed channels. Four delayed observations per channel form a 24-dimensional representation, displayed through a fixed three-dimensional principal-component projection. The traces and trajectory come from the same samples. A finite phase-dependent input changes the model, and the visitor can observe its response.

This is an illustration of coordination and perturbation, not an experimental recording or a validated seizure or treatment model. The phase-only model does not describe an amplitude Hopf bifurcation.

The research landscape is an authored navigation map. Its regions organize studies by research question, and its connections describe shared subjects or methods. Height, distance and basin depth are not measurements of similarity, scientific merit or clinical effectiveness. The Where direction is work in progress and has no publication marker.

## Contact and profiles

- [Contact through LinkedIn]({{ site.data.profile.linkedin }})
- [University profile]({{ site.data.profile.institutional_profile }})
- [ORCID]({{ site.data.profile.orcid }})
- [Google Scholar]({{ site.data.profile.scholar }})
- [GitHub]({{ site.data.profile.github }})
