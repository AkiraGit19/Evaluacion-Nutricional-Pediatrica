// Informe clínico en PDF (jsPDF), con el formato de referencia del servicio:
// banda de color con datos del profesional, datos del paciente, tabla de indicadores, diagnóstico,
// y las tres curvas OMS con el punto del paciente (T/E en la página 1; IMC/E y P/T en la página 2).
import { jsPDF } from 'jspdf'
import { CHART_TITLES, chartImage, fmtZ, LEGEND, type ChartKind } from './charts'
import { bmiOf, DAYS_PER_MONTH, formatAge, STD_LIMIT_MONTHS, type IndicatorResult, type Patient, type Tone } from './who'

export const PROFESSIONAL = {
  name: 'Lic. Fernando Sánchez Fukuda',
  specialty: 'Nutrición Pediátrica',
  cnp: '03029',
}

type RGB = [number, number, number]
const INK: RGB = [31, 35, 40]
const MUTED: RGB = [107, 114, 128]
const RULE: RGB = [229, 231, 235]
const WHITE: RGB = [255, 255, 255]
const TONE: Record<Tone, RGB> = { ok: [46, 125, 79], warn: [180, 83, 9], alert: [192, 57, 43] }

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const tint = (c: RGB, a: number): RGB => c.map((v) => Math.round(v * a + 255 * (1 - a))) as RGB
const longDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })

const W = 210, M = 14, CW = W - 2 * M
const SIG = `${PROFESSIONAL.specialty} · CNP ${PROFESSIONAL.cnp}`

export async function exportReport(p: Patient, results: IndicatorResult[], accentHex: string, evalDate: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const accent = hex(accentHex)
  const soft = tint(accent, 0.1)
  const isStd = p.ageDays / DAYS_PER_MONTH < STD_LIMIT_MONTHS
  const bmi = bmiOf(p.weight, p.height)
  const r = Object.fromEntries(results.map((x) => [x.key, x])) as Record<ChartKind, IndicatorResult>

  const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: RGB = INK) =>
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color)

  // ---------- Bloques reutilizables ----------
  const header = () => {
    doc.setFillColor(...accent).rect(0, 0, W, 26, 'F')
    font(15, 'bold', WHITE).text('Informe de Evaluación Nutricional y Crecimiento', M, 12)
    font(9, 'normal', WHITE).text('Estándares OMS 2006 (0-5 años) · Referencias OMS 2007 (5-19 años)', M, 18)
    font(10, 'bold', WHITE).text(PROFESSIONAL.name, W - M, 9.5, { align: 'right' })
    font(9, 'normal', WHITE).text(SIG, W - M, 14.8, { align: 'right' })
    doc.text(`Fecha de evaluación: ${longDate(evalDate)}`, W - M, 20, { align: 'right' })
  }

  const footer = (page: number, total: number) => {
    doc.setDrawColor(...RULE).setLineWidth(0.3).line(M, 283, W - M, 283)
    font(8, 'normal', MUTED).text(`Profesional evaluador: ${PROFESSIONAL.name} · ${SIG}`, M, 288.5)
    doc.text(`Página ${page} de ${total}`, W - M, 288.5, { align: 'right' })
  }

  /** Título de sección en mayúsculas con subrayado del color del paciente. Devuelve la y del subrayado. */
  const section = (title: string, y: number) => {
    font(11, 'bold', accent).text(title, M, y)
    doc.setDrawColor(...accent).setLineWidth(0.5).line(M, y + 2.5, W - M, y + 2.5)
    return y + 2.5
  }

  const legend = (y: number) => {
    let x = M
    font(8.5, 'normal', MUTED)
    for (const l of LEGEND) {
      doc.setDrawColor(...hex(l.color)).setLineWidth(0.7)
      if (l.dash) doc.setLineDashPattern([1.6, 1.2], 0)
      doc.line(x, y - 1, x + 7, y - 1)
      doc.setLineDashPattern([], 0)
      doc.text(l.label, x + 9, y)
      x += 9 + doc.getTextWidth(l.label) + 7
    }
    doc.setFillColor(...accent).circle(x + 1.6, y - 1, 1.6, 'F')
    doc.text('Paciente', x + 5, y)
  }

  /** Título + caja con la curva + leyenda. Devuelve la y bajo la leyenda. */
  const chartBlock = (kind: ChartKind, y: number, title: string, right: string) => {
    font(11, 'bold').text(`Curva OMS · ${title}`, M, y)
    font(9, 'normal', MUTED).text(right, W - M, y, { align: 'right' })
    const top = y + 3.6, h = 90
    doc.setDrawColor(...RULE).setLineWidth(0.3).roundedRect(M, top, CW, h, 2, 2, 'S')
    doc.addImage(chartImage(kind, p, accentHex), 'PNG', M + 1.5, top + 1.5, CW - 3, h - 3, undefined, 'SLOW')
    legend(top + h + 4.6)
    return top + h + 4.6
  }

  const zRight = (x: IndicatorResult) => (x.z == null ? 'No aplica (referencia visual)' : `Z ${fmtZ(x.z)} · ${x.classification!.label}`)

  // ---------- Página 1 ----------
  header()
  let y = section('DATOS DEL PACIENTE', 35)

  const rows: [string, string, string, string][] = [
    ['Nombres y apellidos', p.name, 'Sexo', p.sex === 2 ? 'Femenino' : 'Masculino'],
    ['Fecha de nacimiento', p.dob ? longDate(p.dob) : 'No registrada', 'Edad', `${formatAge(p.ageDays)} (${(p.ageDays / DAYS_PER_MONTH).toFixed(1)} meses)`],
    ['Peso', `${p.weight.toFixed(1)} kg`, 'Talla', `${p.height.toFixed(1)} cm`],
    ['IMC', `${bmi.toFixed(1)} kg/m2`, 'Patrón OMS aplicado', isStd ? 'Estándares OMS 2006' : 'Referencias OMS 2007'],
  ]
  y += 2.5
  rows.forEach(([l1, v1, l2, v2], i) => {
    if (i % 2 === 0) doc.setFillColor(...soft).rect(M, y, CW, 6.6, 'F')
    const b = y + 4.4
    font(10, 'normal', MUTED).text(l1, M + 2, b)
    font(10, 'bold').text(doc.splitTextToSize(v1, 58)[0], M + 38, b)
    font(9.5, 'normal', MUTED).text(l2, M + 98, b)
    font(10, 'bold').text(v2, M + 133, b)
    y += 6.6
  })

  // Tabla de indicadores
  y = section('INDICADORES ANTROPOMÉTRICOS (PUNTAJE Z)', y + 8.5)
  const cx = [M + 2, M + 48, M + 78, M + 103, M + 126]
  y += 5.9
  font(8.5, 'bold', MUTED)
  ;['Indicador', 'Valor', 'Mediana OMS', 'Puntaje Z', 'Clasificación'].forEach((h, i) => doc.text(h, cx[i], y))
  y += 3.1
  doc.setDrawColor(...RULE).setLineWidth(0.3).line(M, y, W - M, y)

  const indicatorRow = (x: IndicatorResult, label: string, value: string) => {
    const b = y + 4.7
    let bottom = b + 3.6
    font(10, 'bold').text(label, cx[0], b)
    font(10).text(value, cx[1], b)
    if (x.z == null) {
      font(10, 'normal', MUTED).text('—', cx[2], b)
      doc.text('No aplica', cx[3], b)
      const lines = font(7.5, 'normal', MUTED).splitTextToSize(x.note ?? '', W - M - cx[4])
      doc.text(lines, cx[4], b - 0.4)
      bottom = Math.max(bottom, b - 0.4 + (lines.length - 1) * 3.2 + 2.6)
    } else {
      font(10).text(x.median!.toFixed(1), cx[2], b)
      font(10, 'bold').text(`${fmtZ(x.z)} DE`, cx[3], b)
      font(10, 'bold', TONE[x.classification!.tone]).text(x.classification!.label, cx[4], b)
    }
    if (x.key === 'bmi' && !isStd) {
      font(8, 'italic', TONE.alert).text('Nota OMS 2007 (5–19 a): Z > +1 se considera sobrepeso en la referencia escolar.', cx[0], b + 4.7)
      bottom = b + 7.9
    }
    y = bottom
    doc.setDrawColor(...RULE).setLineWidth(0.3).line(M, y, W - M, y)
  }
  indicatorRow(r.hfa, 'Talla / Edad (T/E)', `${p.height.toFixed(1)} cm`)
  indicatorRow(r.bmi, 'IMC / Edad (IMC/E)', `${bmi.toFixed(1)} kg/m2`)
  indicatorRow(r.wfh, 'Peso / Talla (P/T)', `${p.weight.toFixed(1)} kg`)

  y += 3.7
  const criteria = font(7, 'normal', MUTED).splitTextToSize(
    'Criterios: T/E  < -3 DE talla baja severa · -3 a +3 DE normal · > +3 DE talla alta.   IMC/E y P/T  <= +2 DE normal · > +2 a +3 DE sobrepeso · > +3 DE obesidad.',
    CW)
  doc.text(criteria, M, y)
  y += (criteria.length - 1) * 3

  // Diagnóstico
  y = section('DIAGNÓSTICO NUTRICIONAL', y + 7.5)
  const bullets = [
    `Talla para la edad: ${r.hfa.classification!.label} (Z ${fmtZ(r.hfa.z!)}).`,
    `Estado nutricional (IMC/E): ${r.bmi.classification!.label} (Z ${fmtZ(r.bmi.z!)}).`,
    r.wfh.z == null
      ? 'Peso para la talla: no aplica para la edad o talla; se considera IMC/E.'
      : `Peso para la talla: ${r.wfh.classification!.label} (Z ${fmtZ(r.wfh.z)}).`,
  ]
  y += 4.5
  for (const t of bullets) {
    font(10, 'bold').text('•', M + 2, y)
    doc.text(t, M + 5.5, y)
    y += 5.6
  }

  chartBlock('hfa', y + 5, CHART_TITLES.hfa, zRight(r.hfa))

  // ---------- Página 2 ----------
  doc.addPage()
  header()
  chartBlock('bmi', 35.2, CHART_TITLES.bmi, zRight(r.bmi))
  const end = chartBlock('wfh', 147, `${CHART_TITLES.wfh} · ejes 180 cm / 85 kg`, zRight(r.wfh))
  if (r.wfh.z == null) {
    font(8, 'normal', MUTED).text(
      doc.splitTextToSize(`${r.wfh.note} Las curvas P/T de la OMS solo cubren hasta 120 cm (2-5 años).`, CW), M, end + 6.4)
  }

  // Firma
  doc.setDrawColor(...INK).setLineWidth(0.3).line(126, 265, W - M, 265)
  const sx = (126 + W - M) / 2
  font(10, 'bold').text(PROFESSIONAL.name, sx, 269.5, { align: 'center' })
  font(9.5, 'normal', MUTED).text(SIG, sx, 274, { align: 'center' })

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); footer(i, total) }

  doc.save(`Informe_${p.name.trim().replace(/\s+/g, '_')}_${evalDate}.pdf`)
}
