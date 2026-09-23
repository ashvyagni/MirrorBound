#!/usr/bin/env python3
"""Dump the JSON Schema of every Pydantic wire contract to packages/contracts/schema.

    python apps/server/scripts/export_contracts.py

The TypeScript side (src/web/src/game/contracts.ts) is maintained by hand; this
export exists so a reviewer can diff the two, and so a generator can be wired
in later without changing where the truth lives.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]   # apps/server/scripts/x.py -> repo root
sys.path.insert(0, str(ROOT / "apps" / "server"))

from mirrorbound.contracts.messages import CommandMessage, InputMessage, TwinIntentModel  # noqa: E402

OUT = ROOT / "packages" / "contracts" / "schema"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for model in (InputMessage, CommandMessage, TwinIntentModel):
        path = OUT / f"{model.__name__}.json"
        path.write_text(json.dumps(model.model_json_schema(), indent=2) + "\n", encoding="utf-8")
        print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
