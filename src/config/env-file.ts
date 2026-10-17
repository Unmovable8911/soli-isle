function splitEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return null;
  }

  const withoutExport = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;
  const equalsIndex = withoutExport.indexOf("=");
  if (equalsIndex <= 0) {
    return null;
  }

  return {
    key: withoutExport.slice(0, equalsIndex).trim(),
    value: withoutExport.slice(equalsIndex + 1),
  };
}

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split("\n")) {
    const entry = splitEnvLine(rawLine.replace(/\r$/, ""));
    if (entry === null) {
      continue;
    }

    let value = entry.value;
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }

    result[entry.key] = value;
  }

  return result;
}

function envLineKey(line: string): string | null {
  return splitEnvLine(line)?.key ?? null;
}

export function upsertEnvValue(content: string, key: string, value: string): string {
  const replacement = `${key}="${value}"`;
  const hadTrailingNewline = content.endsWith("\n");
  const lines = hadTrailingNewline ? content.slice(0, -1).split("\n") : content.split("\n");

  const existingIndex = lines.findIndex((line) => envLineKey(line) === key);
  if (existingIndex >= 0) {
    lines[existingIndex] = replacement;
    return lines.join("\n") + (hadTrailingNewline ? "\n" : "");
  }

  if (content === "") {
    return `${replacement}\n`;
  }

  const separator = hadTrailingNewline ? "" : "\n";
  return `${content}${separator}${replacement}\n`;
}
