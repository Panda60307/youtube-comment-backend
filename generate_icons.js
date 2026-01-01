import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, '../extension/assets/icons');

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// A simple Blue 1x1 pixel PNG
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkHPjfDwADMwHgH3I51gAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

['icon16.png', 'icon48.png', 'icon128.png'].forEach(file => {
    fs.writeFileSync(path.join(iconsDir, file), buffer);
    console.log(`Created ${file}`);
});
