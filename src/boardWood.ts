/** Deterministic grain for the board's wooden frame; no remote texture dependency. */
let texture: { vertical: string; horizontal: string } | undefined;
export function boardWood() {
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const context = canvas.getContext('2d');
  const plain = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E';
  if (!context) return { vertical: plain, horizontal: plain };
  const pixels = context.createImageData(canvas.width, canvas.height);
  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7 + 17) * 43758.5453;
    return value - Math.floor(value);
  };
  const wrap = (value: number, period: number) => (value % period + period) % period;
  const noise = (x: number, y: number, periodX: number, periodY: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(wrap(ix, periodX), wrap(iy, periodY)) * (1 - fx)
      + hash(wrap(ix + 1, periodX), wrap(iy, periodY)) * fx;
    const b = hash(wrap(ix, periodX), wrap(iy + 1, periodY)) * (1 - fx)
      + hash(wrap(ix + 1, periodX), wrap(iy + 1, periodY)) * fx;
    return a * (1 - fy) + b * fy;
  };
  const tiledNoise = (x: number, y: number, cellsX: number, cellsY: number) => noise(
    x / canvas.width * cellsX, y / canvas.height * cellsY, cellsX, cellsY,
  );
  const tau = Math.PI * 2;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const warp = 7 * tiledNoise(x, y, 6, 5) + 3 * Math.sin(y / canvas.height * tau * 3);
    const dx = Math.min(Math.abs(x - 105), canvas.width - Math.abs(x - 105));
    const dy = Math.min(Math.abs(y - 310), canvas.height - Math.abs(y - 310));
    const knot = Math.exp(-(dx ** 2 / 1800 + dy ** 2 / 2400));
    const grain = tiledNoise(x + warp + knot * 22, y, 52, 2);
    const line = Math.pow(Math.max(0, Math.sin((x + warp) / canvas.width * tau * 29 + knot * 8)), 9);
    const weather = tiledNoise(x, y, 14, 12);
    const value = grain * 33 + weather * 20 - line * 17 - knot * 22 + (hash(x, y) - .5) * 9;
    const i = (y * canvas.width + x) * 4;
    pixels.data[i] = 56 + value;
    pixels.data[i + 1] = 33 + value * .72;
    pixels.data[i + 2] = 19 + value * .44;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const horizontal = document.createElement('canvas');
  horizontal.width = 512; horizontal.height = 256;
  const rotated = horizontal.getContext('2d');
  if (!rotated) return { vertical: plain, horizontal: plain };
  rotated.translate(512, 0); rotated.rotate(Math.PI / 2); rotated.drawImage(canvas, 0, 0);
  return texture = { vertical: canvas.toDataURL(), horizontal: horizontal.toDataURL() };
}
