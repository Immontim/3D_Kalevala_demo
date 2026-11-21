const DECK_SHADES = ["#c08549", "#ad703b", "#cc9254", "#b77b43"] as const;

/** Puusilta 48 pikselin laatassa, poikittain joen suuntaan nähden. */
export function drawBridge(ctx: CanvasRenderingContext2D, x: number, y: number, riverTurns: number): void {
  ctx.save();
  ctx.translate(x + 24, y + 24);
  ctx.rotate((riverTurns - 1) * Math.PI / 2);
  ctx.translate(-24, -24);

  // Tumma varjo erottaa kannen vaahtoreunoista ja rantakivistä.
  ctx.fillStyle = "rgba(20, 15, 11, 0.66)";
  ctx.fillRect(10, 5, 30, 41);
  ctx.fillRect(13, 46, 25, 2);

  // Kiviset maatuet ja niiden päällä kulkeva lankkukansi.
  ctx.fillStyle = "#3b3023";
  ctx.fillRect(8, 4, 32, 6);
  ctx.fillRect(8, 38, 32, 6);
  ctx.fillStyle = "#8e7858";
  for (const bankY of [4, 39]) {
    ctx.fillRect(9, bankY, 6, 4);
    ctx.fillRect(34, bankY + 1, 5, 3);
  }

  ctx.fillStyle = "#4b2c19";
  ctx.fillRect(12, 1, 24, 46);
  for (let i = 0; i < 11; i++) {
    const boardY = 2 + i * 4;
    ctx.fillStyle = DECK_SHADES[i % DECK_SHADES.length];
    ctx.fillRect(13, boardY, 22, 3);
    ctx.fillStyle = "#e2ad68";
    ctx.fillRect(15 + (i * 5) % 11, boardY, 8, 1);
    ctx.fillStyle = "#8f562f";
    ctx.fillRect(15 + (i * 3) % 12, boardY + 2, 7, 1);
  }

  // Molemmilla sivuilla yhtenäiset kaidepuut ja kolme pystytolppaa.
  for (const railX of [10, 34]) {
    ctx.fillStyle = "#492e20";
    ctx.fillRect(railX, 6, 4, 36);
    ctx.fillStyle = "#d39c59";
    ctx.fillRect(railX + 1, 7, 2, 34);
    for (const postY of [5, 22, 39]) {
      ctx.fillStyle = "#492e20";
      ctx.fillRect(railX - 1, postY, 6, 5);
      ctx.fillStyle = "#b97d42";
      ctx.fillRect(railX, postY + 1, 4, 3);
      ctx.fillStyle = "#f0c17d";
      ctx.fillRect(railX, postY + 1, 3, 1);
    }
  }

  ctx.restore();
}
