// Pelaajan ohjauksen luvut: hiiren katse ja lukitus vastustajaan.
// Peli on PC-peli hiirelle ja näppäimistölle; kosketusnäyttöjä ei tueta.

export const CONTROLS = {
  /** Hiiren herkkyys: kääntymiskulma asteina hiiren liikkeen pikseliä kohti. */
  mouseSens: 0.14,
  /** Katseen pystykulma asteina: negatiivinen = kamera alempana, katse ylös. */
  pitchMin: -18,
  pitchMax: 40,
  /** Lukituksen kiinnittymisnopeus (kerroin sekunnissa): mitä suurempi, sitä tiukemmin katse seuraa kohdetta. */
  lockTurn: 8,
};
