import { mkdir, readFile, writeFile } from 'node:fs/promises';

const files = ['index.html', 'style.css', 'app.js', 'range.js', 'date-controls.js', 'car.png'];
await mkdir('dist', { recursive: true });
for (const file of files) await writeFile('dist/' + file, await readFile('assets/' + file));
console.log(`Built ${files.length} static assets. Vercel serves data through api/data.js.`);
