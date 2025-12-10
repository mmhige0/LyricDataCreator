const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'kuromoji', 'dict');
const dest = path.join(__dirname, '..', 'public', 'dict');

async function copyKuromojiDict() {
  try {
    await fs.promises.access(src, fs.constants.R_OK);
  } catch {
    console.warn(`Kuromoji dictionaries not found at ${src}; skipping copy.`);
    return;
  }

  try {
    await fs.promises.mkdir(dest, { recursive: true });
    await fs.promises.cp(src, dest, { recursive: true });
    console.log(`Copied Kuromoji dictionaries to ${dest}`);
  } catch (error) {
    console.warn('Unable to copy Kuromoji dictionaries:', error.message);
  }
}

copyKuromojiDict();
