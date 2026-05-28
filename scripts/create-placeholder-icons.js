const fs = require('fs');
const path = require('path');

// Create a simple SVG icon as base64 data URL for PNG placeholder
function createIconDataUrl(size) {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.125}" fill="#2563eb"/>
    <rect x="${size * 0.25}" y="${size * 0.3125}" width="${size * 0.5}" height="${size * 0.0625}" fill="white"/>
    <rect x="${size * 0.25}" y="${size * 0.4375}" width="${size * 0.5}" height="${size * 0.0625}" fill="white"/>
    <rect x="${size * 0.25}" y="${size * 0.5625}" width="${size * 0.375}" height="${size * 0.0625}" fill="white"/>
    <rect x="${size * 0.25}" y="${size * 0.6875}" width="${size * 0.25}" height="${size * 0.0625}" fill="white"/>
    <circle cx="${size * 0.75}" cy="${size * 0.71875}" r="${size * 0.09375}" fill="white"/>
    <path d="M${size * 0.75 - size * 0.046875} ${size * 0.71875}l${size * 0.028125} ${size * 0.028125} ${size * 0.046875} -${size * 0.046875}" stroke="#2563eb" stroke-width="${size * 0.0078125}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Icon sizes to generate
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create placeholder files (we'll use SVG data URLs as placeholders)
sizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon-${size}x${size}.png`);
  const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.125}" fill="#2563eb"/>
  <rect x="${size * 0.25}" y="${size * 0.3125}" width="${size * 0.5}" height="${size * 0.0625}" fill="white"/>
  <rect x="${size * 0.25}" y="${size * 0.4375}" width="${size * 0.5}" height="${size * 0.0625}" fill="white"/>
  <rect x="${size * 0.25}" y="${size * 0.5625}" width="${size * 0.375}" height="${size * 0.0625}" fill="white"/>
  <rect x="${size * 0.25}" y="${size * 0.6875}" width="${size * 0.25}" height="${size * 0.0625}" fill="white"/>
  <circle cx="${size * 0.75}" cy="${size * 0.71875}" r="${size * 0.09375}" fill="white"/>
  <path d="M${size * 0.75 - size * 0.046875} ${size * 0.71875}l${size * 0.028125} ${size * 0.028125} ${size * 0.046875} -${size * 0.046875}" stroke="#2563eb" stroke-width="${size * 0.0078125}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  
  // For now, create SVG files as placeholders (they work as icons too)
  const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`Created ${svgPath}`);
});

// Create maskable icons (192x192 and 512x512)
[192, 512].forEach(size => {
  const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563eb"/>
  <rect x="${size * 0.3}" y="${size * 0.35}" width="${size * 0.4}" height="${size * 0.05}" fill="white"/>
  <rect x="${size * 0.3}" y="${size * 0.45}" width="${size * 0.4}" height="${size * 0.05}" fill="white"/>
  <rect x="${size * 0.3}" y="${size * 0.55}" width="${size * 0.3}" height="${size * 0.05}" fill="white"/>
  <rect x="${size * 0.3}" y="${size * 0.65}" width="${size * 0.2}" height="${size * 0.05}" fill="white"/>
  <circle cx="${size * 0.7}" cy="${size * 0.675}" r="${size * 0.075}" fill="white"/>
  <path d="M${size * 0.7 - size * 0.0375} ${size * 0.675}l${size * 0.0225} ${size * 0.0225} ${size * 0.0375} -${size * 0.0375}" stroke="#2563eb" stroke-width="${size * 0.00625}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  
  const svgPath = path.join(iconsDir, `icon-${size}x${size}-maskable.svg`);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`Created ${svgPath}`);
});

console.log('Icon placeholders created successfully!');
console.log('Note: These are SVG placeholders. For production, convert to PNG using an image converter.');