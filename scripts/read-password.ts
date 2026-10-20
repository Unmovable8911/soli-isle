import readline from "node:readline";

function readHiddenLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let input = "";

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          process.stdout.write("\n");
          cleanup();
          resolve(input);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          input = input.slice(0, -1);
          continue;
        }
        input += char;
      }
    };

    process.stdout.write(prompt);
    stdin.setRawMode(true);
    // In raw mode the TTY delivers Buffers, so "\r" and Ctrl-C (byte 3) would
    // never match the string comparisons below without decoding first.
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}

function readPasswordFromTty(): Promise<string> {
  return (async () => {
    const password = await readHiddenLine("Password: ");
    const confirmation = await readHiddenLine("Confirm: ");
    if (password !== confirmation) {
      process.stderr.write("Passwords do not match.\n");
      process.exit(1);
    }
    return password;
  })();
}

function readPasswordFromPipe(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin });
    rl.on("line", (line) => {
      resolve(line.replace(/\r$/, ""));
      rl.close();
    });
    rl.on("close", () => resolve(""));
    rl.on("error", reject);
  });
}

export function readNewPassword(): Promise<string> {
  const passwordPromise = process.stdin.isTTY
    ? readPasswordFromTty()
    : readPasswordFromPipe();

  return passwordPromise.then((password) => {
    if (password === "") {
      process.stderr.write("Password must not be empty.\n");
      process.exit(1);
    }
    return password;
  });
}
