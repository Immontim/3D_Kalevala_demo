// Maailmanesineiden tunnisteiden ratkaisu. Pihat arvotaan instansseiksi ("yard", "yard-b"), ja
// jousineidon talo voi olla kumpi tahansa, joten säännöt viittaavat pihan pöytäesineisiin roolilla:
// `@archerYard.table-flatbread` on jousineidon talon rieskat, `@otherYard.…` toisen talon.
import type { CampaignState } from "../map/campaign";

const ROLE = /^@(archerYard|otherYard)\.(.+)$/;

/** Palauttaa todellisen instanssitunnisteen tai null, jos roolin pihaa ei ole tallennuksessa. */
export function resolveInstanceId(state: CampaignState, instanceId: string): string | null {
  const m = ROLE.exec(instanceId);
  if (!m) return instanceId;
  const archer = m[1] === "archerYard";
  const yard = state.world.siteInstances.find((site) => site.kind === "yard" && site.archer === archer);
  return yard ? `${yard.id}.${m[2]}` : null;
}
