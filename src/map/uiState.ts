export const SATIETY_BANDS = ["full", "content", "neutral", "peckish", "starving"] as const;
export type SatietyBand = (typeof SATIETY_BANDS)[number];

export const WORLD_MINUTES_PER_MOON = 180;
export const DAYS_PER_MOON = 28;
export const MOON_PHASES = 8;

export interface MapCalendarTime {
  /** Täysinä kuluneet kuunkierrot; ensimmäisen kierron aikana 0. */
  moon: number;
  /** Nykyisen kuunkierron päivä, 1–28. */
  day: number;
  /** Kuun kuvavaihe, 0–7. */
  phase: number;
}

export type MapCellVisibility = "unknown" | "remembered" | "visible";

/** Erottelee pysyvän maastomuistin sankarin tämänhetkisestä 3 × 3 -näöstä. */
export function mapCellVisibility(
  discovered: boolean,
  observer: { x: number; y: number },
  target: { x: number; y: number },
  radius = 1,
): MapCellVisibility {
  if (!discovered) return "unknown";
  return Math.max(Math.abs(target.x - observer.x), Math.abs(target.y - observer.y)) <= radius
    ? "visible"
    : "remembered";
}

/** Muuntaa tallennuksen tausta-ajan pelilliseksi kuuksi ja päiväksi. */
export function mapCalendarTime(worldMinutes: number): MapCalendarTime {
  const time = Math.max(0, Number.isFinite(worldMinutes) ? worldMinutes : 0);
  const moon = Math.floor(time / WORLD_MINUTES_PER_MOON);
  const withinMoon = time % WORLD_MINUTES_PER_MOON;
  return {
    moon,
    day: Math.floor(withinMoon * DAYS_PER_MOON / WORLD_MINUTES_PER_MOON) + 1,
    phase: Math.floor(withinMoon * MOON_PHASES / WORLD_MINUTES_PER_MOON),
  };
}

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
