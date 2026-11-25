// Maailmanesineiden tunnisteiden ratkaisu. Pihat arvotaan instansseiksi ("yard", "yard-b"), ja
// jousineidon talo voi olla kumpi tahansa, joten säännöt viittaavat pihan pöytäesineisiin roolilla:
// `@archerYard.table-flatbread` on jousineidon talon rieskat, `@otherYard.…` toisen talon.
import type { CampaignState } from "../map/campaign";

const ROLE = /^@(archerYard|otherYard)\.(.+)$/;
const SITE_ROLE = /^@(archerYard|otherYard)$/;

/** Ratkaisee maailmadatan roolin konkreettiseksi karttapaikaksi. */
export function resolveSiteId(state: CampaignState, siteId: string): string | null {
  const m = SITE_ROLE.exec(siteId);
  if (!m) return siteId;
  const archer = m[1] === "archerYard";
  return state.world.siteInstances.find((site) => site.kind === "yard" && site.archer === archer)?.id ?? null;
}

/** Palauttaa todellisen instanssitunnisteen tai null, jos roolin pihaa ei ole tallennuksessa. */
export function resolveInstanceId(state: CampaignState, instanceId: string): string | null {
  const m = ROLE.exec(instanceId);
  if (!m) return instanceId;
  const siteId = resolveSiteId(state, `@${m[1]}`);
  return siteId ? `${siteId}.${m[2]}` : null;
}
