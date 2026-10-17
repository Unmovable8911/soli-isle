import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class FileSystemResourceStorage {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async checkAvailability(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const probePath = path.join(this.rootDir, `.health-${randomUUID()}`);
    const probeContent = randomUUID();

    try {
      await writeFile(probePath, probeContent, { flag: "wx" });
      const writtenContent = await readFile(probePath, "utf8");
      if (writtenContent !== probeContent) {
        throw new Error("Resource storage probe returned unexpected content");
      }
    } finally {
      await rm(probePath, { force: true });
    }
  }
}
