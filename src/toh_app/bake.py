import json
from pathlib import Path

from toh_app.app import MAX_DISKS, solve

OUT_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "traces"


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    for variant in ("recursive", "iterative"):
        for n in range(1, MAX_DISKS + 1):
            data = solve(variant, n)
            out = OUT_DIR / f"solve_{variant}_n{n}.json"
            out.write_text(json.dumps(data))
            size = out.stat().st_size
            total_bytes += size
            print(f"wrote {out.name} ({size:,} B)")
    print(f"done — {total_bytes:,} bytes across {2 * MAX_DISKS} files")


if __name__ == "__main__":
    main()
