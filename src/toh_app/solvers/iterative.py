def hanoi(n, pegs):
    total_moves = (1 << n) - 1
    # For odd n, the smallest disk cycles A -> C -> B; for even n, A -> B -> C.
    step = 2 if n % 2 == 1 else 1
    smallest_peg = 0
    for i in range(1, total_moves + 1):
        if i % 2 == 1:
            next_peg = (smallest_peg + step) % 3
            disk = pegs[smallest_peg].pop()
            pegs[next_peg].append(disk)
            smallest_peg = next_peg
        else:
            a, b = [p for p in (0, 1, 2) if p != smallest_peg]
            if not pegs[a]:
                src, dst = b, a
            elif not pegs[b]:
                src, dst = a, b
            elif pegs[a][-1] < pegs[b][-1]:
                src, dst = a, b
            else:
                src, dst = b, a
            disk = pegs[src].pop()
            pegs[dst].append(disk)
