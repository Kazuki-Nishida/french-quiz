"""Build compact basket passengers from the companion's shared head artwork.

Run with Python 3 after editing companion-*.svg or vehicle-bicycle.svg.
No runtime dependency is added. The transparent 320x220 output shares the
vehicle's coordinates. Its 87-unit head is about 36px wide on a 132px bicycle.
A small body sits behind the basket front, with short round wings on its rim.
No limbs reach the handlebar, saddle, or pedals. The basket front is copied
from the vehicle so both layers align exactly. Only the shared head changes
between reactions; the passenger stays seated.
"""
from copy import deepcopy
from pathlib import Path
import xml.etree.ElementTree as ET

ASSETS = Path(__file__).resolve().parents[1] / "img" / "adventure"
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)

BODY = '''<g xmlns="http://www.w3.org/2000/svg" id="basket-passenger-body" stroke="#593D45" stroke-linejoin="round" stroke-linecap="round">
  <!-- The compact torso is hidden by the basket front, never stretched to fit the bicycle. -->
  <path d="M224 80q23-12 45 0c10 11 9 29-1 35-12 8-31 8-43-1-9-7-10-23-1-34Z" fill="url(#feather-gold)" stroke-width="2.8"/>
  <ellipse cx="247" cy="101" rx="17" ry="14" fill="#FFF4D6" stroke="none"/>
  <path d="M223 83q24 10 48-1l-2 11q-21 9-44 0Z" fill="url(#scarf-blue)" stroke="#49477F" stroke-width="2.1"/>
  <path d="M225 88q-6 7-13 9l7 2 1 6q10-5 14-13Z" fill="#7877D6" stroke="#49477F" stroke-width="2"/>
  <path d="M225 86q6-3 10 2l-2 8q-7 2-10-3Z" fill="#9190E3" stroke="#49477F" stroke-width="2"/>
  <path d="m228 88 3 3" fill="none" stroke="#D8D6FF" stroke-width="1.7"/>
</g>'''

PAWS = '''<g xmlns="http://www.w3.org/2000/svg" id="basket-passenger-paws" stroke="#593D45" stroke-linejoin="round" stroke-linecap="round">
  <!-- Rounded, short wings drape over the front rim; no arms or feet are exposed. -->
  <path d="M216 88c4-4 11-3 13 2 2 4 0 11-5 12-5 1-10-3-10-7 0-3 0-5 2-7Z" fill="url(#feather-gold)" stroke-width="2.5"/>
  <path d="M273 87c4-3 10-2 13 2 3 5 0 12-5 13-5 0-10-4-10-8 0-3 0-5 2-7Z" fill="url(#feather-gold)" stroke-width="2.5"/>
  <path d="m220 96 1 3m4-4 1 3m51-3 1 3m4-3 1 3" fill="none" stroke="#CC8C4A" stroke-width="1.4"/>
  <path d="m219 91 5-1m52 0h5" fill="none" stroke="#FFE0A0" stroke-width="2"/>
</g>'''

vehicle = ET.parse(ASSETS / "vehicle-bicycle.svg").getroot()
basket_front = vehicle.find(f".//{{{NS}}}g[@id='bicycle-basket-front']")
if basket_front is None:
    raise ValueError("vehicle-bicycle.svg needs the shared bicycle-basket-front group")
vehicle_defs = vehicle.find(f"{{{NS}}}defs")
outputs = {}

for reaction, description in (
    ("idle", "自転車の前カゴにちょこんと入り、丸い手を縁に添える相棒"),
    ("correct", "自転車の前カゴから、正解を笑顔で喜ぶ相棒"),
    ("wrong", "自転車の前カゴから、優しく励ます相棒"),
    ("arrival", "自転車の前カゴから、新しい景色にわくわくする相棒"),
):
    source = ET.parse(ASSETS / f"companion-{reaction}.svg").getroot()
    head = source.find(f".//{{{NS}}}g[@id='buddy-head']")
    if head is None:
        raise ValueError(f"companion-{reaction}.svg needs the shared buddy-head group")
    root = ET.Element(f"{{{NS}}}svg", width="320", height="220", viewBox="0 0 320 220")
    ET.SubElement(root, f"{{{NS}}}title").text = description
    defs = ET.SubElement(root, f"{{{NS}}}defs")
    for source_defs in (source.find(f"{{{NS}}}defs"), vehicle_defs):
        if source_defs is not None:
            defs.extend(deepcopy(list(source_defs)))
    definition_ids = [element.get("id") for element in defs.iter() if element.get("id")]
    if len(definition_ids) != len(set(definition_ids)):
        raise ValueError("Companion and bicycle paint definitions must have distinct IDs")
    root.append(ET.fromstring(BODY))
    face = ET.SubElement(root, f"{{{NS}}}g", transform="translate(181 -2) scale(1.04)")
    face.append(deepcopy(head))
    root.append(deepcopy(basket_front))
    root.append(ET.fromstring(PAWS))
    ET.indent(root, space="  ")
    outputs[ASSETS / f"rider-bicycle-{reaction}.svg"] = ET.tostring(root, encoding="unicode") + "\n"

for output, artwork in outputs.items():
    output.write_text(artwork, encoding="utf-8")
    print(output.name)
