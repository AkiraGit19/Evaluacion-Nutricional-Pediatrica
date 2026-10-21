// Motor de cálculo de puntaje Z según la OMS (método LMS de Box-Cox).
//
//   z = ((X / M)^L - 1) / (L · S)        (L ≠ 0)
//   z = ln(X / M) / S                   (L = 0)
//   X(z) = M · (1 + L · S · z)^(1/L)     (curva para un z dado)
//
// En los indicadores basados en peso (IMC/E y P/T) la OMS aplica un ajuste fuera de ±3 DE
// ("restricted application of the LMS method", WHO Child Growth Standards 2006, cap. 7):
//   z > +3:  z* = 3 + (X - SD3pos) / (SD3pos - SD2pos)
//   z < -3:  z* = -3 + (X - SD3neg) / (SD2neg - SD3neg)
// Talla/Edad no lleva ajuste.
import who from './who-data.json' with { type: 'json' }

export type Sex = 1 | 2 // 1 = masculino, 2 = femenino (codificación OMS)
type LMS = [number, number, number]
type Table = { start: number; step: number; 1: LMS[]; 2: LMS[] }

const T = who as unknown as Record<'hfaStd' | 'bmiStd' | 'wfl' | 'wfh' | 'hfaRef' | 'bmiRef', Table>

export const DAYS_PER_MONTH = 30.4375
/** Los Estándares OMS (0-5 años) se usan por debajo de 60 meses; a partir de ahí, las Referencias 2007. */
export const STD_LIMIT_MONTHS = 60
export const MAX_MONTHS = 228 // 19 años

/** LMS en x, interpolando linealmente entre filas de la tabla. null si x cae fuera. */
function lmsAt(t: Table, sex: Sex, x: number): LMS | null {
  const rows = t[sex]
  const i = (x - t.start) / t.step
  if (i < -1e-9 || i > rows.length - 1 + 1e-9) return null
  const lo = Math.floor(i + 1e-9)
  const hi = Math.min(lo + 1, rows.length - 1)
  const f = i - lo
  return rows[lo].map((v, k) => v + (rows[hi][k] - v) * f) as LMS
}

export function valueAtZ([L, M, S]: LMS, z: number) {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L)
}

export function zFromLMS(lms: LMS, x: number, restricted: boolean) {
  const [L, M, S] = lms
  const z = L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S)
  if (!restricted || Math.abs(z) <= 3) return z
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3)
    return 3 + (x - sd3) / (sd3 - valueAtZ(lms, 2))
  }
  const sd3 = valueAtZ(lms, -3)
  return -3 + (x - sd3) / (valueAtZ(lms, -2) - sd3)
}

// ---------------------------------------------------------------------------
// Selección de tabla según indicador y edad
// ---------------------------------------------------------------------------

export type Indicator = 'hfa' | 'bmi' | 'wfh'

/** Talla/Edad o IMC/Edad: Estándar (por días) si < 5 años, Referencia 2007 (por meses) si ≥ 5 años. */
function ageLMS(ind: 'hfa' | 'bmi', sex: Sex, ageDays: number): LMS | null {
  const months = ageDays / DAYS_PER_MONTH
  if (months < STD_LIMIT_MONTHS) return lmsAt(ind === 'hfa' ? T.hfaStd : T.bmiStd, sex, Math.round(ageDays))
  return lmsAt(ind === 'hfa' ? T.hfaRef : T.bmiRef, sex, months)
}

/** Peso/Talla solo existe en los Estándares 0-5: longitud (45-110 cm) < 2 años, talla (65-120 cm) de 2 a 5 años. */
export function wfhTable(ageDays: number): 'wfl' | 'wfh' | null {
  const months = ageDays / DAYS_PER_MONTH
  if (months >= STD_LIMIT_MONTHS) return null
  return ageDays < 731 ? 'wfl' : 'wfh'
}

export const WFH_RANGE = { wfl: [45, 110], wfh: [65, 120] } as const

// ---------------------------------------------------------------------------
// Clasificación (criterios del servicio)
// ---------------------------------------------------------------------------

export type Tone = 'ok' | 'warn' | 'alert'
export type Classification = { label: string; tone: Tone }

export function classifyHfa(z: number): Classification {
  if (z < -3) return { label: 'Talla baja severa', tone: 'alert' }
  if (z > 3) return { label: 'Talla alta', tone: 'warn' }
  return { label: 'Talla normal / adecuada', tone: 'ok' }
}

export function classifyWeight(z: number): Classification {
  if (z > 3) return { label: 'Obesidad', tone: 'alert' }
  if (z > 2) return { label: 'Sobrepeso', tone: 'warn' }
  return { label: 'Normal / Eunutrición', tone: 'ok' }
}

// ---------------------------------------------------------------------------
// Evaluación completa
// ---------------------------------------------------------------------------

export type Patient = { name: string; sex: Sex; ageDays: number; weight: number; height: number; dob?: string }

export type IndicatorResult = {
  key: Indicator
  title: string
  short: string
  z: number | null
  /** Mediana OMS (M del LMS) para la edad o talla del paciente, en la unidad del indicador. */
  median: number | null
  classification: Classification | null
  /** Motivo cuando el indicador no aplica (fuera de rango OMS). */
  note?: string
  source: string
}

export const bmiOf = (weight: number, heightCm: number) => weight / (heightCm / 100) ** 2

export function evaluate(p: Patient): IndicatorResult[] {
  const isStd = p.ageDays / DAYS_PER_MONTH < STD_LIMIT_MONTHS
  const source = isStd ? 'Estándares de Crecimiento OMS 2006' : 'Referencias de Crecimiento OMS 2007'
  const bmi = bmiOf(p.weight, p.height)

  const hfaLms = ageLMS('hfa', p.sex, p.ageDays)
  const hfaZ = hfaLms && zFromLMS(hfaLms, p.height, false)
  const bmiLms = ageLMS('bmi', p.sex, p.ageDays)
  const bmiZ = bmiLms && zFromLMS(bmiLms, bmi, true)

  const wt = wfhTable(p.ageDays)
  let wfhZ: number | null = null
  let wfhMedian: number | null = null
  let wfhNote: string | undefined
  if (!wt) wfhNote = 'La OMS no define P/T después de los 5 años. Se clasifica con IMC/E.'
  else {
    const lms = lmsAt(T[wt], p.sex, Math.round(p.height * 10) / 10)
    const [a, b] = WFH_RANGE[wt]
    if (lms) { wfhZ = zFromLMS(lms, p.weight, true); wfhMedian = lms[1] }
    else wfhNote = `Talla fuera del rango OMS para P/T (${a}-${b} cm). Se clasifica con IMC/E.`
  }

  return [
    {
      key: 'hfa', title: 'Talla para la Edad', short: 'T/E', z: hfaZ, median: hfaLms?.[1] ?? null,
      classification: hfaZ == null ? null : classifyHfa(hfaZ), source,
    },
    {
      key: 'bmi', title: 'IMC para la Edad', short: 'IMC/E', z: bmiZ, median: bmiLms?.[1] ?? null,
      classification: bmiZ == null ? null : classifyWeight(bmiZ), source,
    },
    {
      key: 'wfh', title: 'Peso para la Talla', short: 'P/T', z: wfhZ, median: wfhMedian,
      classification: wfhZ == null ? null : classifyWeight(wfhZ), note: wfhNote,
      source: !wt ? 'Indicador definido solo de 0 a 5 años' : wt === 'wfl' ? 'Estándares OMS 2006 (longitud, < 2 años)' : 'Estándares OMS 2006 (talla, 2-5 años)',
    },
  ]
}

// ---------------------------------------------------------------------------
// Curvas para graficar (-3 a +3 DE)
// ---------------------------------------------------------------------------

export const Z_LINES = [-3, -2, -1, 0, 1, 2, 3] as const
export type Curves = { x: number[]; lines: Record<number, number[]> }

function curves(points: { x: number; lms: LMS | null }[]): Curves {
  const ok = points.filter((p): p is { x: number; lms: LMS } => !!p.lms)
  const lines: Record<number, number[]> = {}
  for (const z of Z_LINES) lines[z] = ok.map((p) => valueAtZ(p.lms, z))
  return { x: ok.map((p) => p.x), lines }
}

/** Curvas por edad. x en meses: 0-60 (Estándares) o 60-228 (Referencias), según la edad del paciente. */
export function ageCurves(ind: 'hfa' | 'bmi', sex: Sex, ageDays: number): Curves {
  const std = ageDays / DAYS_PER_MONTH < STD_LIMIT_MONTHS
  const pts = []
  if (std) for (let m = 0; m <= STD_LIMIT_MONTHS; m += 0.5) pts.push({ x: m, lms: lmsAt(ind === 'hfa' ? T.hfaStd : T.bmiStd, sex, Math.min(Math.round(m * DAYS_PER_MONTH), 1826)) })
  else for (let m = STD_LIMIT_MONTHS; m <= MAX_MONTHS; m++) pts.push({ x: m, lms: lmsAt(ind === 'hfa' ? T.hfaRef : T.bmiRef, sex, m) })
  return curves(pts)
}

/** Curvas Peso/Talla. Para ≥ 5 años se muestran las de talla (65-120 cm) como referencia visual. */
export function wfhCurves(sex: Sex, ageDays: number): Curves {
  const wt = wfhTable(ageDays) ?? 'wfh'
  const [a, b] = WFH_RANGE[wt]
  const pts = []
  for (let h = a; h <= b; h += 0.5) pts.push({ x: h, lms: lmsAt(T[wt], sex, h) })
  return curves(pts)
}

// ---------------------------------------------------------------------------
// Edad
// ---------------------------------------------------------------------------

/** Días entre dos fechas ISO (yyyy-mm-dd), en UTC para evitar saltos por horario de verano. */
export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)
}

export function formatAge(ageDays: number) {
  const totalMonths = Math.floor(ageDays / DAYS_PER_MONTH)
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  if (y === 0) return `${m} ${m === 1 ? 'mes' : 'meses'}`
  return `${y} ${y === 1 ? 'año' : 'años'}${m ? ` ${m} ${m === 1 ? 'mes' : 'meses'}` : ''}`
}
