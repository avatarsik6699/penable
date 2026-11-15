import { deflateSync } from "node:zlib";

const IconPng = {
  crc(bytes) {
    let crc = 0xffffffff;

    for (const byte of bytes) {
      crc ^= byte;

      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }

    return (crc ^ 0xffffffff) >>> 0;
  },

  chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    const size = Buffer.alloc(4);

    size.writeUInt32BE(data.length);

    const crc = Buffer.alloc(4);

    crc.writeUInt32BE(IconPng.crc(body));

    return Buffer.concat([size, body, crc]);
  },
};

export const AppIcons = {
  png(size) {
    const raw = Buffer.alloc(size * (1 + size * 4));

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const stem = u >= 0.31 && u <= 0.4 && v >= 0.26 && v <= 0.78;

        const bowl =
          Math.hypot((u - 0.48) / 0.19, (v - 0.41) / 0.17) <= 1 &&
          (u <= 0.4 || Math.hypot((u - 0.48) / 0.1, (v - 0.41) / 0.08) >= 1);

        const dot = Math.hypot(u - 0.74, v - 0.72) <= 0.045;
        const ink = stem || bowl;

        const color = dot
          ? [23, 92, 211]
          : ink
            ? [24, 34, 48]
            : [255, 255, 255];

        const offset = y * (1 + size * 4) + 1 + x * 4;

        raw[offset] = color[0];
        raw[offset + 1] = color[1];
        raw[offset + 2] = color[2];
        raw[offset + 3] = 255;
      }
    }

    const header = Buffer.alloc(13);

    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;

    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      IconPng.chunk("IHDR", header),
      IconPng.chunk("IDAT", deflateSync(raw)),
      IconPng.chunk("IEND", Buffer.alloc(0)),
    ]);
  },
};
