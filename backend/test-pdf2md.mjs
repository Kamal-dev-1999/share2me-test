import fs from 'fs';
import { convert } from '@pdf2md/core';

async function run() {
  try {
    const buf = fs.readFileSync('C:/Users/Kamal/.gemini/antigravity-ide/brain/dc6fe846-5938-4705-a3b0-98498fb0048b/.tempmediaStorage/media_dc6fe846-5938-4705-a3b0-98498fb0048b_1785609704292.pdf');
    const uint8Buf = new Uint8Array(buf);
    
    // convert usually takes Uint8Array
    const md = await convert(uint8Buf);
    console.log(typeof md);
    console.log(Object.keys(md));
    if (md.text) console.log(md.text.slice(0, 500));
    if (md.markdown) console.log(md.markdown.slice(0, 500));
  } catch(e) {
    console.error(e);
  }
}
run();
