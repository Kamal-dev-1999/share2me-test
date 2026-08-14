const fs = require('fs');
const pdf2md = require('@pdf2md/core');

async function run() {
  try {
    const inputBuffer = fs.readFileSync('C:/Users/Kamal/.gemini/antigravity-ide/brain/dc6fe846-5938-4705-a3b0-98498fb0048b/.tempmediaStorage/media_dc6fe846-5938-4705-a3b0-98498fb0048b_1785609704292.pdf');
    const md = await pdf2md(inputBuffer);
    console.log(md.slice(0, 500));
  } catch(e) {
    console.error(e);
  }
}
run();
