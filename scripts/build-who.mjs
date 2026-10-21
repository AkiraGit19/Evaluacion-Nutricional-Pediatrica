// Convierte las tablas LMS oficiales de la OMS (scripts/who-raw) a src/lib/who-data.json.
// Fuentes:
//   0-5 años  (Estándares 2006): github.com/WorldHealthOrganization/anthro     data-raw/growthstandards
//   5-19 años (Referencias 2007): github.com/WorldHealthOrganization/anthroplus data-raw/growthstandards
// Cada tabla queda como { start, step, "1": [[L,M,S],...], "2": [...] } (1 = masculino, 2 = femenino),
// indexada por edad (días o meses) o por talla (cm, paso 0.1).
import { readFileSync, writeFileSync } from 'node:fs'

const raw = (f) => readFileSync(new URL(`./who-raw/${f}.txt`, import.meta.url), 'utf8')

function table(file, step) {
  const rows = raw(file).trim().split('\n').slice(1).map((r) => r.split('\t'))
  const out = { start: Number(rows[0][1]), step, 1: [], 2: [] }
  for (const [sex, x, l, m, s] of rows) {
    const arr = out[sex]
    const expected = out.start + arr.length * step
    if (Math.abs(Number(x) - expected) > 1e-6) throw new Error(`${file}: hueco en x=${x}`)
    arr.push([Number(l), Number(m), Number(s)])
  }
  return out
}

const data = {
  hfaStd: table('lenanthro', 1), // talla/longitud para la edad, días 0-1856
  bmiStd: table('bmianthro', 1), // IMC para la edad, días 0-1856
  wfl: table('wflanthro', 0.1), // peso para la longitud, 45-110 cm (< 2 años)
  wfh: table('wfhanthro', 0.1), // peso para la talla, 65-120 cm (2-5 años)
  hfaRef: table('hfawho2007', 1), // talla para la edad, meses 60-228
  bmiRef: table('bfawho2007', 1), // IMC para la edad, meses 60-228
}

writeFileSync(new URL('../src/lib/who-data.json', import.meta.url), JSON.stringify(data))
console.log('who-data.json:', Object.entries(data).map(([k, t]) => `${k}=${t[1].length}`).join(' '))
