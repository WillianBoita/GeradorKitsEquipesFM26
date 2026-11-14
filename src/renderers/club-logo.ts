import sharp from "sharp";

// Escudo do jogo: a imagem do clube sem contorno (a borda do uniforme depende do fundo de cada kit), centralizada num quadrado transparente.
// Com fundo transparente, o contain acrescenta o canal alfa também a um logo opaco.
export async function renderClubLogoPng(image: Buffer, size: number): Promise<Buffer> {
  return sharp(image)
    .resize({ width: size, height: size, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
