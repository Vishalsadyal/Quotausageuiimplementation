import { readFileSync } from 'fs';
import { resolve } from 'path';

const envContent = readFileSync(resolve('.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

console.log('URL:', process.env.DATABASE_URL?.substring(0, 60));

const { neonConfig, Pool } = await import('@neondatabase/serverless');
const { default: WebSocket } = await import('ws');

neonConfig.webSocketConstructor = WebSocket;

console.log('Creating pool...');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
console.log('Pool created, connecting...');

const client = await pool.connect();
console.log('Connected!');
const r = await client.query('SELECT email, name, role FROM public."User" ORDER BY "createdAt" DESC LIMIT 5');
console.log('Latest 5:', JSON.stringify(r.rows, null, 2));
const count = await client.query('SELECT count(*) as total FROM public."User"');
console.log('Total:', count.rows[0].total);
const vdv = await client.query("SELECT id, email, name, role FROM public.\"User\" WHERE email = 'vdvishalwebdev@gmail.com'");
console.log('vdvishalwebdev:', JSON.stringify(vdv.rows));
client.release();
await pool.end();
