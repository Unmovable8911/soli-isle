import type { Locale } from "@/config/site";
import en from "./en.json";
import zh from "./zh.json";

export type Messages = typeof zh;

const enMessages: Messages = en;

export const messages: Record<Locale, Messages> = { zh, en: enMessages };
