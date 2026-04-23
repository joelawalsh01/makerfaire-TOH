import copy
import inspect
import sys

_WATCHED_LOCALS = {
    "n", "src", "dst", "aux", "i", "disk",
    "next_peg", "smallest_peg", "step", "total_moves", "a", "b",
}


def record(solver_fn, *args, **kwargs):
    """Run the solver under sys.settrace and return a per-line execution trace.

    Each trace entry is a dict: {"line", "pegs", "locals"} where "line" is
    1-indexed within the solver function body (line 1 = the `def` line), so
    the frontend can display the function's source starting at line 1 and
    align the highlight to trace["line"].
    """
    source_file = inspect.getsourcefile(solver_fn)
    source_first_line = inspect.getsourcelines(solver_fn)[1]
    trace = []

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != source_file:
            return None
        if event == "line":
            pegs = frame.f_locals.get("pegs")
            if pegs is None:
                return tracer
            trace.append({
                "line": frame.f_lineno - source_first_line + 1,
                "pegs": copy.deepcopy(pegs),
                "locals": {
                    k: _jsonable(v)
                    for k, v in frame.f_locals.items()
                    if k in _WATCHED_LOCALS
                },
            })
        return tracer

    sys.settrace(tracer)
    try:
        solver_fn(*args, **kwargs)
    finally:
        sys.settrace(None)
    return trace


def _jsonable(v):
    if isinstance(v, bool) or isinstance(v, (int, float, str)) or v is None:
        return v
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    return repr(v)
