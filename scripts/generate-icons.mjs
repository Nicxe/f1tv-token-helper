import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const iconDir = new URL("src/icons/", root);
const sizes = [16, 32, 48, 128];

await mkdir(iconDir, { recursive: true });

for (const size of sizes) {
  const png = createIcon(size);
  await writeFile(new URL(`icon-${size}.png`, iconDir), png);
}

function createIcon(size) {
  const width = size;
  const height = size;
  const pixels = Buffer.alloc(width * height * 4);
  const radius = size * 0.18;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const roundedAlpha = roundedRectAlpha(x, y, width, height, radius);
      const red = 211 + Math.round((x / width) * 28);
      const green = 23 + Math.round((y / height) * 20);
      const blue = 28 + Math.round(((width - x) / width) * 18);
      const stripe = x + y > size * 1.2;

      pixels[index] = stripe ? 20 : red;
      pixels[index + 1] = stripe ? 22 : green;
      pixels[index + 2] = stripe ? 24 : blue;
      pixels[index + 3] = roundedAlpha;
    }
  }

  drawCircle(
    pixels,
    width,
    height,
    size * 0.38,
    size * 0.43,
    size * 0.13,
    [246, 250, 252, 255],
  );
  drawCircle(
    pixels,
    width,
    height,
    size * 0.38,
    size * 0.43,
    size * 0.06,
    [20, 22, 24, 255],
  );
  drawLine(
    pixels,
    width,
    height,
    size * 0.48,
    size * 0.49,
    size * 0.75,
    size * 0.76,
    Math.max(2, size * 0.08),
    [246, 250, 252, 255],
  );
  drawLine(
    pixels,
    width,
    height,
    size * 0.64,
    size * 0.64,
    size * 0.76,
    size * 0.52,
    Math.max(1, size * 0.045),
    [246, 250, 252, 255],
  );
  drawLine(
    pixels,
    width,
    height,
    size * 0.71,
    size * 0.71,
    size * 0.82,
    size * 0.6,
    Math.max(1, size * 0.045),
    [246, 250, 252, 255],
  );

  return encodePng(width, height, pixels);
}

function roundedRectAlpha(x, y, width, height, radius) {
  const dx = Math.max(radius - x, 0, x - (width - radius - 1));
  const dy = Math.max(radius - y, 0, y - (height - radius - 1));
  const distance = Math.hypot(dx, dy);
  return distance <= radius ? 255 : 0;
}

function drawCircle(pixels, width, height, centerX, centerY, radius, color) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY) <= radius) {
        setPixel(pixels, width, x, y, color);
      }
    }
  }
}

function drawLine(pixels, width, height, x1, y1, x2, y2, thickness, color) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - thickness));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x1, x2) + thickness));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - thickness));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y1, y2) + thickness));
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared,
        ),
      );
      const projectedX = x1 + t * (x2 - x1);
      const projectedY = y1 + t * (y2 - y1);
      if (Math.hypot(x - projectedX, y - projectedY) <= thickness / 2) {
        setPixel(pixels, width, x, y, color);
      }
    }
  }
}

function setPixel(pixels, width, x, y, color) {
  const index = (y * width + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawRow = y * (width * 4 + 1);
    const pixelRow = y * width * 4;
    raw[rawRow] = 0;
    pixels.copy(raw, rawRow + 1, pixelRow, pixelRow + width * 4);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
