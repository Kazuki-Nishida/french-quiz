"""Build fitted riding poses from the companion's shared head artwork.

Run with Python 3 after editing companion-*.svg. No runtime dependency is added.
The transparent 320x220 output shares coordinates with vehicle-bicycle.svg:
saddle (125, 98), grips (184, 72)/(198, 72), pedals (131, 146)/(166, 175).
Only the face changes between reactions, keeping every contact point fixed.
"""
from copy import deepcopy
from pathlib import Path
import xml.etree.ElementTree as ET

ASSETS = Path(__file__).resolve().parents[1] / "img" / "adventure"
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)

BODY = '''<g xmlns="http://www.w3.org/2000/svg" stroke="#593D45" stroke-linejoin="round" stroke-linecap="round">
  <!-- Far leg rests on the rear pedal; a deeper gold keeps it behind the near leg. -->
  <path d="M124 97Q106 112 112 124L127 141" fill="none" stroke="#593D45" stroke-width="15"/>
  <path d="M124 97Q106 112 112 124L127 141" fill="none" stroke="#CE853C" stroke-width="10"/>
  <path d="M122 138q7-3 13 3l6 3q1 4-6 4h-13q-5-4 0-10Z" fill="#E7A35D" stroke-width="2.6"/>
  <!-- Scarf tails and a small feathered tail remain behind the torso. -->
  <path d="M127 85q-15 1-27 12 13 9 27 6l11-8" fill="#DA8C3D" stroke-width="2.6"/>
  <path d="M142 63q-16 11-39 4l7 10-8 6q22 1 41-11" fill="#7877D6" stroke="#4D4785" stroke-width="2.4"/>
  <path d="M113 74q12 3 23-2" fill="none" stroke="#D8D6FF" stroke-width="2.4"/>
  <!-- Seated hip meets the saddle, with a gentle forward lean toward the grips. -->
  <path d="M136 57q22-4 29 13c7 15-5 33-23 36-13 2-26-1-27-12 0-13 11-26 21-37Z" fill="#F0AB4C" stroke-width="3"/>
  <path d="M145 67c15-1 19 11 13 21-6 11-16 14-26 12-6-2-9-7-5-14Z" fill="#FFF4D6" stroke="none"/>
  <path d="M126 99q17 2 25-8" fill="none" stroke="#DF963F" stroke-width="3"/>
  <!-- Near thigh bends forward; the foot sits flat on the front pedal. -->
  <path d="M138 101q13 2 25 21 5 7 3 18l-4 28" fill="none" stroke="#593D45" stroke-width="17"/>
  <path d="M138 101q13 2 25 21 5 7 3 18l-4 28" fill="none" stroke="#F2B34F" stroke-width="11.5"/>
  <path d="M145 110q10 4 16 15" fill="none" stroke="#FFD88C" stroke-width="3.5"/>
  <path d="M156 166q7-3 13 1l8 3q5 4 0 6h-22q-5-4 1-10Z" fill="#F5BD71" stroke-width="2.7"/>
  <path d="M161 168h7" stroke="#FFF1C2" stroke-width="2"/>
  <!-- Travel satchel follows the body instead of hanging below the frame. -->
  <path d="M132 64q-9 14-10 26" fill="none" stroke="#865549" stroke-width="4.5"/>
  <path d="m109 77 20 3-3 23-21-4Z" fill="#BA7853" stroke-width="2.5"/>
  <path d="m109 77 20 3-2 9-20-3Z" fill="#D99A67" stroke-width="2"/>
  <circle cx="117" cy="89" r="4.6" fill="#FFE4A0" stroke-width="1.5"/>
  <path d="m117 86 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#9C654C" stroke="none"/>
  <!-- Both wings reach the grips; their rounded ends wrap over the handlebar. -->
  <path d="M151 66q10 7 18 7l14-1" fill="none" stroke="#593D45" stroke-width="12"/>
  <path d="M151 66q10 7 18 7l14-1" fill="none" stroke="#D99840" stroke-width="7"/>
  <ellipse cx="184" cy="72" rx="6" ry="4.8" fill="#F5B959" stroke-width="2.2"/>
  <path d="M152 73q12 13 23 10l20-10" fill="none" stroke="#593D45" stroke-width="14"/>
  <path d="M152 73q12 13 23 10l20-10" fill="none" stroke="#F3B452" stroke-width="9"/>
  <path d="M163 79q10 4 18-1" fill="none" stroke="#FFDC94" stroke-width="2.7"/>
  <ellipse cx="197" cy="71.8" rx="6.4" ry="5" fill="#F7BE62" stroke-width="2.3"/>
  <path d="m197 70 1.2 4" fill="none" stroke="#BA7B3C" stroke-width="1.5"/>
  <!-- A compact knot is visible below the same face used for walking. -->
  <path d="M131 60q14 8 29 1l-2 9q-15 6-28-1Z" fill="#6766C4" stroke="#4D4785" stroke-width="2.4"/>
  <path d="M131 64q6-3 9 2l-3 7-7-3Z" fill="#9190E3" stroke="#4D4785" stroke-width="2"/>
</g>'''

for reaction, description in (
    ("idle", "ハンドルを握り、サドルに座ってペダルを踏む相棒"),
    ("correct", "両手でハンドルを握ったまま、正解を笑顔で喜ぶ相棒"),
    ("wrong", "自転車に座り、落ち着いて励ます相棒"),
    ("arrival", "自転車で新しい場所へ到着して喜ぶ相棒"),
):
    source = ET.parse(ASSETS / f"companion-{reaction}.svg").getroot()
    head = source.find(f".//{{{NS}}}g[@id='buddy-head']")
    if head is None:
        raise ValueError(f"companion-{reaction}.svg needs the shared buddy-head group")
    root = ET.Element(f"{{{NS}}}svg", width="320", height="220", viewBox="0 0 320 220")
    ET.SubElement(root, f"{{{NS}}}title").text = description
    defs = source.find(f"{{{NS}}}defs")
    if defs is not None:
        root.append(deepcopy(defs))
    root.append(ET.fromstring(BODY))
    face = ET.SubElement(root, f"{{{NS}}}g", transform="translate(98 -6) scale(.86)")
    face.append(deepcopy(head))
    ET.indent(root, space="  ")
    output = ASSETS / f"rider-bicycle-{reaction}.svg"
    output.write_text(ET.tostring(root, encoding="unicode") + "\n", encoding="utf-8")
    print(output.name)
