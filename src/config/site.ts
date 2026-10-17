export const siteConfig = {
  locales: ["zh", "en"],
  defaultLocale: "zh",
  timeZone: "Asia/Shanghai",
} as const;

export type Locale = (typeof siteConfig.locales)[number];

export function isLocale(value: string): value is Locale {
  return (siteConfig.locales as readonly string[]).includes(value);
}
