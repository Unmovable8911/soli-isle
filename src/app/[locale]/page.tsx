import { notFound } from "next/navigation";

import { isLocale, siteConfig } from "@/config/site";
import { messages } from "@/messages";

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const t = messages[locale];

  return (
    <main>
      <h1>{t.home.title}</h1>
      <p>{t.home.tagline}</p>
    </main>
  );
}
