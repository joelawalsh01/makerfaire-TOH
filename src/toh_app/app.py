import inspect
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from toh_app import tracer
from toh_app.solvers import iterative, recursive

MAX_DISKS = 8
DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
PEG_LABELS = ["A", "B", "C"]

app = FastAPI(title="Tower of Hanoi — Occidental CS 101")


@app.get("/api/solve")
def solve(variant: str = "recursive", n: int = 4):
    if n < 1 or n > MAX_DISKS:
        raise HTTPException(400, f"n must be between 1 and {MAX_DISKS}")
    if variant not in ("recursive", "iterative"):
        raise HTTPException(400, "variant must be 'recursive' or 'iterative'")

    initial_pegs = [list(range(n, 0, -1)), [], []]
    pegs = [p[:] for p in initial_pegs]

    if variant == "recursive":
        source = inspect.getsource(recursive.hanoi)
        raw_trace = tracer.record(recursive.hanoi, n, 0, 2, 1, pegs)
    else:
        source = inspect.getsource(iterative.hanoi)
        raw_trace = tracer.record(iterative.hanoi, n, pegs)

    trace = _annotate(raw_trace, initial_pegs)
    return {
        "variant": variant,
        "n": n,
        "source": source,
        "peg_labels": PEG_LABELS,
        "initial_pegs": initial_pegs,
        "trace": trace,
        "move_count": sum(1 for s in trace if s.get("move")),
    }


def _annotate(raw_trace, initial_pegs):
    """Attach a human-readable `note` and a `move` record to each trace step.

    Each physical disk move shows up in the trace as two consecutive state
    transitions (pegs[src].pop(), then pegs[dst].append(disk)). We stitch the
    pair: the pop step is annotated as 'Lifting disk ...', and the append step
    carries the completed `move` and the 'Moved disk ...' note.
    """
    annotated = []
    prev_pegs = initial_pegs
    pending = None  # {"disk", "from"} awaiting the append step
    for step in raw_trace:
        curr = step["pegs"]
        src_idx = dst_idx = disk_val = None
        for i in range(3):
            if len(curr[i]) < len(prev_pegs[i]):
                src_idx = i
                disk_val = prev_pegs[i][-1]
            elif len(curr[i]) > len(prev_pegs[i]):
                dst_idx = i
                if disk_val is None:
                    disk_val = curr[i][-1]

        move = None
        note = None
        if src_idx is not None and dst_idx is not None:
            move = {"disk": disk_val, "from": src_idx, "to": dst_idx}
            pending = None
        elif src_idx is not None:
            pending = {"disk": disk_val, "from": src_idx}
            note = f"Lifting disk {disk_val} off peg {PEG_LABELS[src_idx]}."
        elif dst_idx is not None and pending is not None:
            move = {
                "disk": pending["disk"],
                "from": pending["from"],
                "to": dst_idx,
            }
            pending = None

        if move:
            note = (
                f"Moved disk {move['disk']} from peg {PEG_LABELS[move['from']]} "
                f"to peg {PEG_LABELS[move['to']]}."
            )
        elif note is None:
            note = _describe_locals(step["locals"])

        annotated.append({
            "line": step["line"],
            "pegs": step["pegs"],
            "locals": step["locals"],
            "move": move,
            "note": note,
        })
        prev_pegs = curr
    return annotated


def _describe_locals(locals_):
    if not locals_:
        return ""
    pretty = {}
    for key, val in locals_.items():
        if key in ("src", "dst", "aux", "smallest_peg", "next_peg") and isinstance(val, int) and 0 <= val < 3:
            pretty[key] = PEG_LABELS[val]
        else:
            pretty[key] = val

    if "n" in pretty and "src" in pretty and "dst" in pretty and "aux" in pretty:
        return (
            f"hanoi(n={pretty['n']}, src={pretty['src']}, "
            f"dst={pretty['dst']}, aux={pretty['aux']})"
        )
    if "i" in pretty:
        extras = []
        if "smallest_peg" in pretty:
            extras.append(f"smallest disk on peg {pretty['smallest_peg']}")
        if "total_moves" in pretty:
            extras.append(f"of {pretty['total_moves']}")
        tail = f" ({'; '.join(extras)})" if extras else ""
        return f"iteration i={pretty['i']}{tail}"
    parts = [f"{k}={v}" for k, v in pretty.items()]
    return ", ".join(parts)


app.mount("/", StaticFiles(directory=DOCS_DIR, html=True), name="docs")
