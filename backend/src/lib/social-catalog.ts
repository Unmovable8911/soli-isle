export const SOCIAL_PLATFORMS = [
  'github', 'twitter', 'tiktok', 'telegram', 'instagram', 'facebook', 'reddit', 'email', 'rss',
] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
export function isSocialPlatform(v: string): v is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(v);
}
