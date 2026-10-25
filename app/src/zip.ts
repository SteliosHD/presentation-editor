// A .zip of text files, stored without compression: enough for a starter folder to download where the browser
// cannot write to a folder itself (Firefox, Safari).

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
// Writes [offset, value, bytes] fields into a little-endian header.
const fields = (size: number, values: [number, number, 2 | 4][]) => {
  const view = new DataView(new ArrayBuffer(size));
  for (const [at, value, bytes] of values) {
    if (bytes === 4) view.setUint32(at, value, true);
    else view.setUint16(at, value, true);
  }
  return new Uint8Array(view.buffer);
};
const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export const zip = (files: { path: string; content: string }[]) => {
  const encoder = new TextEncoder();
  const local: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const { path, content } of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const crc = crc32(data);
    // Signature, version 2.0, UTF-8 names, stored, a 1980-01-01 date, the checksum and sizes, the name's length.
    const head = fields(30, [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x0800, 2],
      [12, 0x21, 2],
      [14, crc, 4],
      [18, data.length, 4],
      [22, data.length, 4],
      [26, name.length, 2],
    ]);
    const entry = fields(46, [
      [0, 0x02014b50, 4],
      [4, 20, 2],
      [6, 20, 2],
      [8, 0x0800, 2],
      [14, 0x21, 2],
      [16, crc, 4],
      [20, data.length, 4],
      [24, data.length, 4],
      [28, name.length, 2],
      [42, offset, 4],
    ]);
    local.push(head, name, data);
    central.push(entry, name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, part) => n + part.length, 0);
  const end = fields(22, [
    [0, 0x06054b50, 4],
    [8, files.length, 2],
    [10, files.length, 2],
    [12, size, 4],
    [16, offset, 4],
  ]);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
};
