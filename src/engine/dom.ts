/** Sivun elementti id:n perusteella. */
export const $ = (id: string) => document.getElementById(id)!;
/** Kosketuslaite. Kosketusohjausta ei tueta, mutta vanhat napit ovat yhä olemassa. */
export const isTouch = matchMedia("(pointer: coarse)").matches;
