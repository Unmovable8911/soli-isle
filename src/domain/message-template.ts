/**
 * Fills `{placeholder}` slots in a message. An unknown placeholder is left
 * alone so a typo shows up in the UI instead of silently vanishing.
 */
export function formatMessage(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
