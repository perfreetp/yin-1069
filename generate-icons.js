const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, drawPixel) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = createChunk('IHDR', Buffer.concat([
    writeUInt32BE(width),
    writeUInt32BE(height),
    Buffer.from([8, 6, 0, 0, 0])
  ]));

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const pixel = drawPixel(x, y, width, height);
      rawData.push(pixel.r, pixel.g, pixel.b, pixel.a);
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idat = createChunk('IDAT', compressed);
  
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = writeUInt32BE(crc32(crcData));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writeUInt32BE(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

function drawHeartIcon(size) {
  const centerX = size / 2;
  const centerY = size / 2;
  const heartSize = size * 0.35;

  return function(x, y) {
    const dx = (x - centerX) / heartSize;
    const dy = -(y - centerY) / heartSize;
    
    const heart = Math.pow(dx * dx + dy * dy - 1, 3) - dx * dx * dy * dy * dy;
    
    if (heart < 0) {
      return { r: 255, g: 255, b: 255, a: 255 };
    }
    
    const t = x / size;
    const r = Math.round(102 + (118 - 102) * t);
    const g = Math.round(126 + (75 - 126) * t);
    const b = Math.round(234 + (162 - 234) * t);
    
    return { r, g, b, a: 255 };
  };
}

function generateIcons() {
  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
  }

  const sizes = [16, 48, 128];
  
  sizes.forEach(size => {
    const png = createPNG(size, size, drawHeartIcon(size));
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
    console.log(`Generated icon${size}.png`);
  });

  console.log('All icons generated!');
}

generateIcons();
