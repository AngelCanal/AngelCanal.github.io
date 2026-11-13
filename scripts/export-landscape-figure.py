#!/usr/bin/env python3
"""Regenerate the terrain's SVG fallback and label coordinates.

Run from any directory:
    python scripts/export-landscape-figure.py

Development requirements: Python 3 with PyYAML, and Node.js on PATH.
There are no additional browser or website dependencies. The exporter calls the
actual surface and projection functions in assets/js/landscape.js. Citations
remain in _data/publications.yml and are not copied into the generated geometry.
"""

from pathlib import Path
import json
import re
import subprocess

import yaml


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "_data/landscape.yml"
INCLUDE_PATH = ROOT / "_includes/research-landscape.html"

EXPORT = r"""
const fs = require('fs');
const {createSurface, createProjector, defaultCamera} = require('./assets/js/landscape.js');
const config = JSON.parse(fs.readFileSync(0, 'utf8'));
const surface = createSurface(config.papers);
const width = 1000, height = 650;
const project = createProjector(defaultCamera, width, height);
const point = p => p.x.toFixed(1) + ',' + p.y.toFixed(1);
const path = points => 'M' + points.map(point).join('L');
const markup = [];
markup.push('<path d="' + path(surface.perimeter.map(project)) + 'Z" fill="#1c281e" stroke="#afc497" stroke-opacity=".25" stroke-width=".8"/>');

// Downsample only the fallback mesh, keeping the full field's contour lines.
const faces = [];
for (let row = 0; row < surface.rows; row += 2) {
  for (let column = 0; column < surface.columns; column += 2) {
    const rowEnd = Math.min(row + 2, surface.rows), columnEnd = Math.min(column + 2, surface.columns);
    const stride = surface.columns + 1;
    const vertices = [surface.vertices[row * stride + column], surface.vertices[row * stride + columnEnd], surface.vertices[rowEnd * stride + columnEnd], surface.vertices[rowEnd * stride + column]];
    const face = surface.faces[row * surface.columns + column];
    faces.push({vertices, face, depth: project(face).depth});
  }
}
faces.sort((a, b) => a.depth - b.depth);
for (const {vertices, face} of faces) {
  const altitude = Math.max(0, Math.min(1, (face.y + .95) / 1.75));
  const red = Math.round(17 + face.light * 15 + altitude * 8);
  const green = Math.round(24 + face.light * 20 + altitude * 8);
  const blue = Math.round(19 + face.light * 13 + altitude * 5);
  markup.push('<path d="' + path(vertices.map(project)) + 'Z" fill="rgb(' + red + ',' + green + ',' + blue + ')" stroke="#b5ca9e" stroke-opacity=".2" stroke-width=".55"/>');
}
for (const major of [false, true]) {
  let d = '';
  for (const face of surface.faces) {
    for (const contour of face.contours) {
      if (contour.major === major) d += path([project(contour.a), project(contour.b)]);
    }
  }
  markup.push('<path d="' + d + '" stroke="' + (major ? '#ced6b1' : '#a4bb92') + '" stroke-opacity="' + (major ? '.4' : '.25') + '" stroke-width="' + (major ? '.8' : '.6') + '"/>');
}

const coordinates = {}, regions = {}, minima = [];
for (const node of surface.nodes) {
  const p = project(node);
  coordinates[node.id] = {x: p.x / width * 100, y: p.y / height * 100};
  const epsilon = .002, h = surface.heightAt, x = node.x, z = node.z;
  const dx = (h(x + epsilon, z) - h(x - epsilon, z)) / (2 * epsilon);
  const dz = (h(x, z + epsilon) - h(x, z - epsilon)) / (2 * epsilon);
  const hxx = (h(x + epsilon, z) - 2 * h(x, z) + h(x - epsilon, z)) / epsilon ** 2;
  const hzz = (h(x, z + epsilon) - 2 * h(x, z) + h(x, z - epsilon)) / epsilon ** 2;
  const hxz = (h(x + epsilon, z + epsilon) - h(x + epsilon, z - epsilon) - h(x - epsilon, z + epsilon) + h(x - epsilon, z - epsilon)) / (4 * epsilon ** 2);
  const gradient = Math.hypot(dx, dz);
  if (gradient > .001 || hxx <= 0 || hxx * hzz - hxz * hxz <= 0) throw new Error(node.id + ' no longer has a well-defined basin minimum');
  minima.push({id: node.id, gradient, x, z, height: node.y});
}
for (const [id, region] of Object.entries(config.regions)) {
  const p = project({x: region.x, z: region.z, y: surface.heightAt(region.x, region.z) + .22});
  regions[id] = {x: p.x / width * 100, y: (p.y - 16) / height * 100};
}
process.stdout.write(JSON.stringify({svg: markup.join('\n          '), coordinates, regions, minima}));
"""


def main():
    config_text = CONFIG_PATH.read_text()
    config = yaml.safe_load(config_text)
    publications = yaml.safe_load((ROOT / "_data/publications.yml").read_text())
    publication_ids = {paper["id"] for paper in publications}
    mapped_ids = set(config["papers"])
    if not mapped_ids <= publication_ids:
        raise ValueError(f"Mapped papers are missing publication metadata: {sorted(mapped_ids - publication_ids)}")
    if sorted(paper["number"] for paper in config["papers"].values()) != list(range(1, len(mapped_ids) + 1)):
        raise ValueError("Mapped paper numbers must form one consecutive sequence")
    for paper in config["papers"].values():
        region = config["regions"][paper["region"]]
        if region.get("status") == "Work in progress":
            raise ValueError("A work-in-progress direction must not create a paper basin")
    if any(edge["a"] not in mapped_ids or edge["b"] not in mapped_ids for edge in config["connections"]):
        raise ValueError("Every connection must link two mapped publications")
    result = subprocess.run(
        ["node", "-e", EXPORT],
        cwd=ROOT,
        input=json.dumps(config),
        text=True,
        capture_output=True,
        check=True,
    )
    result = json.loads(result.stdout)
    include = INCLUDE_PATH.read_text()
    replacement = '<g data-landscape-static-mesh>\n          ' + result["svg"] + '\n          </g>'
    include, count = re.subn(r'<g data-landscape-static-mesh>.*?</g>', lambda _: replacement, include, flags=re.S)
    if count != 1:
        raise ValueError("Expected exactly one static terrain group in the include")

    for collection in (result["coordinates"], result["regions"]):
        for key, point in collection.items():
            pattern = r'(  ' + re.escape(key) + r':\n)(.*?)(?=\n  [a-z]|\n#|\Z)'

            def replace(match):
                block = re.sub(r'fallback_x: [^\n]+', f"fallback_x: {point['x']:.2f}", match.group(2))
                block = re.sub(r'fallback_y: [^\n]+', f"fallback_y: {point['y']:.2f}", block)
                return match.group(1) + block

            config_text, count = re.subn(pattern, replace, config_text, flags=re.S)
            if count != 1:
                raise ValueError(f"Expected exactly one {key} entry in landscape.yml")

    INCLUDE_PATH.write_text(include)
    CONFIG_PATH.write_text(config_text)
    print(json.dumps({"basins": result["minima"], "svg_bytes": len(result["svg"])}, indent=2))


if __name__ == "__main__":
    main()
