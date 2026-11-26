export function getReadingTime(content?: string, override?: string): string {
  if (override) return override;
  if (!content) return "5 min read";
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}
