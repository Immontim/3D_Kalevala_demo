export const SATIETY_BANDS = ["full", "content", "neutral", "peckish", "starving"] as const;
export type SatietyBand = (typeof SATIETY_BANDS)[number];

/**
 * Rajat luetaan kylläisyytenä: 80 kuuluu ylimpään ja 20 jo nääntyneeseen.
 * Arvo rajataan tässä vain esitystä varten; kampanjaydin validoi tallennuksen.
 */
export function satietyBand(value: number): SatietyBand {
  const satiety = Math.max(0, Math.min(100, value));
  if (satiety >= 80) return "full";
  if (satiety >= 60) return "content";
  if (satiety >= 40) return "neutral";
  if (satiety > 20) return "peckish";
  return "starving";
}

export function sceneForMapSite(siteId: string | undefined): "yard" | "clearing" | "lakeside" | null {
  if (siteId === "yard") return "yard";
  if (siteId === "lakeside") return "lakeside";
  if (siteId === "campfire") return "clearing";
  return null;
}
