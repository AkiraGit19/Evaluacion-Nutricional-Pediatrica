// Chequeo ejecutable del motor OMS: `npm test`
import assert from 'node:assert/strict'
import { classifyHfa, classifyWeight, evaluate, valueAtZ, zFromLMS, daysBetween } from './who.ts'

const near = (a: number | null, b: number, tol = 0.01) => assert.ok(a != null && Math.abs(a - b) < tol, `${a} ≉ ${b}`)
const z = (p: Parameters<typeof evaluate>[0], key: string) => evaluate(p).find((r) => r.key === key)!.z

// Recién nacido varón con longitud = mediana OMS (49.8842 cm, día 0) → z = 0
near(z({ name: '', sex: 1, ageDays: 0, weight: 3.3, height: 49.8842 }, 'hfa'), 0, 1e-6)

// Niña de 10 años (120 meses): mediana de talla de la Referencia 2007 → z ≈ 0
// (hfawho2007, sex=2, age=120: M = 138.6363)
near(z({ name: '', sex: 2, ageDays: 120 * 30.4375, weight: 32, height: 138.6363 }, 'hfa'), 0, 1e-3)

// LMS ida y vuelta (L ≠ 0 y L = 0)
for (const lms of [[-0.3521, 7.4327, 0.08217], [0, 10, 0.1]] as [number, number, number][])
  for (const k of [-2.5, -1, 0, 1.7, 2.9]) near(zFromLMS(lms, valueAtZ(lms, k), true), k, 1e-9)

// Ajuste restringido > +3 DE: en el punto SD3 + (SD3 - SD2) debe dar exactamente z = 4
const lms: [number, number, number] = [-0.3521, 7.4327, 0.08217]
const sd3 = valueAtZ(lms, 3), sd2 = valueAtZ(lms, 2)
near(zFromLMS(lms, sd3 + (sd3 - sd2), true), 4, 1e-9)
assert.ok(zFromLMS(lms, sd3 + (sd3 - sd2), false) < 4) // con L < 0 el LMS crudo subestima los extremos (motivo del ajuste OMS)

// Peso/Talla no aplica a partir de 5 años
assert.equal(z({ name: '', sex: 1, ageDays: 2000, weight: 20, height: 110 }, 'wfh'), null)
// Peso/Talla en < 2 años usa la tabla de longitud: 9.5032 kg en 75 cm (varón) = mediana
near(z({ name: '', sex: 1, ageDays: 300, weight: 9.5032, height: 75 }, 'wfh')!, 0, 1e-6)

// Criterios de clasificación del servicio (bordes)
assert.equal(classifyHfa(-3.01).label, 'Talla baja severa')
assert.equal(classifyHfa(-3).label, 'Talla normal / adecuada')
assert.equal(classifyHfa(3).label, 'Talla normal / adecuada')
assert.equal(classifyHfa(3.01).label, 'Talla alta')
assert.equal(classifyWeight(2).label, 'Normal / Eunutrición')
assert.equal(classifyWeight(2.01).label, 'Sobrepeso')
assert.equal(classifyWeight(3).label, 'Sobrepeso')
assert.equal(classifyWeight(3.01).label, 'Obesidad')

assert.equal(daysBetween('2024-03-01', '2025-03-01'), 365)

console.log('who.ts: todos los chequeos OK')
