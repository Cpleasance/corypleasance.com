export type ContributionDay = {
  date: string; // YYYY-MM-DD
  level: number; // 0-4, GitHub's own intensity bucket
  count: number;
};

/**
 * Fetches the public contribution calendar for a GitHub user at build time.
 * Uses the same HTML fragment github.com renders on profile pages, so no token
 * is needed. Returns null on any failure so the build never breaks over it.
 */
export async function getGithubContributions(
  user: string
): Promise<ContributionDay[] | null> {
  try {
    const res = await fetch(`https://github.com/users/${user}/contributions`, {
      headers: { "User-Agent": "corypleasance.com-build" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Each tooltip is linked to its cell by id: "No contributions on ..." / "3 contributions on ..."
    const counts = new Map<string, number>();
    for (const m of html.matchAll(
      /<tool-tip[^>]*\bfor="([^"]+)"[^>]*>\s*(No|\d[\d,]*) contributions?/g
    )) {
      counts.set(m[1], m[2] === "No" ? 0 : Number(m[2].replace(/,/g, "")));
    }

    const days: ContributionDay[] = [];
    for (const m of html.matchAll(
      /<td\b[^>]*ContributionCalendar-day[^>]*>/g
    )) {
      const tag = m[0];
      const date = /data-date="([\d-]+)"/.exec(tag)?.[1];
      const level = /data-level="(\d)"/.exec(tag)?.[1];
      const id = /\bid="([^"]+)"/.exec(tag)?.[1];
      if (!date || level === undefined) continue;
      days.push({
        date,
        level: Number(level),
        count: (id && counts.get(id)) || 0,
      });
    }

    if (days.length < 300) return null; // markup changed; skip rather than show garbage
    return days.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}
