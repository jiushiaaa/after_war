"""Offline sample integrity check. Makes no API calls; does not read credentials."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
source = json.loads((root / "sample-input.json").read_text())
target = json.loads((root / "sample-reviewed.json").read_text())
assert len(source) == len(target) == 37
assert len({row["id"] for row in target}) == len(target)
for left, right in zip(source, target):
    assert left["id"] == right["id"], left["id"]
    assert isinstance(right["text"], str) and right["text"].strip(), left["id"]
    placeholders = lambda text: sorted(re.findall(r"\{[^{}]+\}", text))
    assert placeholders(left["text"]) == placeholders(right["text"]), left["id"]
    without_slots = lambda text: re.sub(r"\{[^{}]+\}", "", text)
    numbers = lambda text: re.findall(r"[0-9]+(?:\.[0-9]+)?", without_slots(text))
    assert numbers(left["text"]) == numbers(right["text"]), left["id"]
    assert not re.search(r"[\u4e00-\u9fff]", without_slots(right["text"])), left["id"]
print("37 sample IDs, placeholders, numeric literals and nonempty English entries passed.")
print("Semantic review remains necessary; this check cannot prove translation quality.")
