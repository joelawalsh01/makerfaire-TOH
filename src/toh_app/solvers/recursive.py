def hanoi(n, src, dst, aux, pegs):
    if n == 0:
        return
    hanoi(n - 1, src, aux, dst, pegs)
    disk = pegs[src].pop()
    pegs[dst].append(disk)
    hanoi(n - 1, aux, dst, src, pegs)
