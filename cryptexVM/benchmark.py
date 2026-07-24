import os
import sys
import subprocess
import time

if not os.path.exists("./zig-out/bin/cryptexVM"):
    print("Executable Not Found!")
    exit(1)

with open("benchmark.ctx", 'w') as file:
    file.write("var a number;\n")
    file.write("var b number;\n")
    testProg = """
a += ((5 + 3) * 2 + 16 - 4 / 'BTC' ) * ((5 + 3) * 2 - 16 - 4 / 2);
b += ((5 + 3) * 2 + 16 - 4 / 'BTC' ) * ((5 + 3) * 2 - 16 - 4 / 2);
a -= b;
b := a;
"""
    for _ in range(10000):
        file.write(testProg)

rounds = 100 if len(sys.argv) != 2 else int(sys.argv[1])
total = 0

command = ["./zig-out/bin/cryptexVM", "benchmark.ctx"]

for _ in range(rounds):
    start = time.time()
    subprocess.run(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            capture_output=False,
            text=False
        )

    length = time.time() - start
    total += length

average = total / rounds
print(f"Average Time: {average}")
