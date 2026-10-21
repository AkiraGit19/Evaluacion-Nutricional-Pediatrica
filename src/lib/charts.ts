// Configuración de Chart.js compartida entre la vista en pantalla y el PDF.
import {
  Chart, LineController, ScatterController, LineElement, PointElement, LinearScale, Tooltip, Filler,
  type ChartConfiguration, type Plugin,
} from 'chart.js'
import { ageCurves, bmiOf, DAYS_PER_MONTH, evaluate, STD_LIMIT_MONTHS, wfhCurves, wfhTable, Z_LINES, type Patient } from './who'

Chart.register(LineController, ScatterController, LineElement, PointElement, LinearScale, Tooltip, Filler)

export type ChartKind = 'hfa' | 'bmi' | 'wfh'

export const CHART_TITLES: Record<ChartKind, string> = {
  hfa: 'Talla para la edad (T/E)',
  bmi: 'IMC para la edad (IMC/E)',
  wfh: 'Peso para la talla (P/T)',
}

// Colores de las líneas DE (formato del informe): mediana verde, ±1 gris punteado, ±2 rojo, ±3 negro.
export const LINE_STYLE: Record<number, { color: string; width: number; dash?: number[] }> = {
  0: { color: '#2e7d4f', width: 2.25 },
  1: { color: '#9ca3af', width: 1.25, dash: [5, 4] },
  [-1]: { color: '#9ca3af', width: 1.25, dash: [5, 4] },
  2: { color: '#c0392b', width: 1.75 },
  [-2]: { color: '#c0392b', width: 1.75 },
  3: { color: '#1f2328', width: 1.75 },
  [-3]: { color: '#1f2328', width: 1.75 },
}

/** Leyenda común (pantalla y PDF). */
export const LEGEND = [
  { label: 'Z 0 (mediana)', ...LINE_STYLE[0] },
  { label: 'Z +/-1', ...LINE_STYLE[1] },
  { label: 'Z +/-2', ...LINE_STYLE[2] },
  { label: 'Z +/-3', ...LINE_STYLE[3] },
]

const zLabel = (z: number) => (z === 0 ? '0' : z > 0 ? `+${z}` : `${z}`)
export const fmtZ = (z: number) => `${z >= 0 ? '+' : ''}${z.toFixed(2)}`
const FONT = '"Geist Variable", Helvetica, Arial, sans-serif'

/** Rótulo "-3 … +3" al final de cada curva. */
const endLabels: Plugin = {
  id: 'endLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart
    ctx.save()
    ctx.font = `700 10px ${FONT}`
    ctx.textBaseline = 'middle'
    chart.data.datasets.forEach((ds, i) => {
      const z = (ds as { zLine?: number }).zLine
      if (z == null) return
      const pts = chart.getDatasetMeta(i).data
      const last = pts[pts.length - 1]
      if (!last || last.y < chartArea.top || last.y > chartArea.bottom) return
      ctx.fillStyle = LINE_STYLE[z].color
      ctx.fillText(zLabel(z), Math.min(last.x + 4, chartArea.right + 4), last.y)
    })
    ctx.restore()
  },
}

/** Guías punteadas del paciente hacia ambos ejes y etiqueta con su valor. */
const patientMark: Plugin = {
  id: 'patientMark',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart
    const meta = chart.getDatasetMeta(chart.data.datasets.length - 1)
    const pt = meta.data[0]
    const opts = (chart.options.plugins as { patientMark?: { label: string; color: string } }).patientMark
    if (!pt || !opts) return
    const { x, y } = pt
    ctx.save()
    // Guías
    ctx.strokeStyle = opts.color
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(chartArea.left, y); ctx.lineTo(x, y)
    ctx.moveTo(x, y); ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.setLineDash([])
    // Etiqueta (a la derecha y arriba del punto; a la izquierda si no cabe)
    ctx.font = `700 11px ${FONT}`
    const padX = 7, h = 20
    const w = ctx.measureText(opts.label).width + padX * 2
    let lx = x + 10
    if (lx + w > chartArea.right) lx = x - 10 - w
    const ly = Math.max(chartArea.top, y - h - 6)
    ctx.fillStyle = opts.color
    ctx.beginPath()
    ctx.roundRect(lx, ly, w, h, 4)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText(opts.label, lx + padX, ly + h / 2 + 0.5)
    ctx.restore()
  },
}

/** Fondo blanco (si no, el PNG del PDF sale transparente). */
const whiteBg: Plugin = {
  id: 'whiteBg',
  beforeDraw(chart) {
    const { ctx, width, height } = chart
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
}

const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step)

export function chartConfig(kind: ChartKind, p: Patient, accent: string): ChartConfiguration<'line' | 'scatter'> {
  const months = p.ageDays / DAYS_PER_MONTH
  const std = months < STD_LIMIT_MONTHS
  const inYears = kind !== 'wfh' && !std // 5-19 años: eje en años; 0-5: en meses

  const curves = kind === 'wfh' ? wfhCurves(p.sex, p.ageDays) : ageCurves(kind, p.sex, p.ageDays)
  const xs = curves.x.map((x) => (inYears ? x / 12 : x))
  const bmi = bmiOf(p.weight, p.height)
  const z = evaluate(p).find((r) => r.key === kind)!.z

  const patient = {
    x: kind === 'wfh' ? p.height : inYears ? months / 12 : months,
    y: kind === 'hfa' ? p.height : kind === 'bmi' ? bmi : p.weight,
  }
  const label = kind === 'hfa' ? `${p.height.toFixed(1)} cm · Z ${fmtZ(z!)}`
    : kind === 'bmi' ? `IMC ${bmi.toFixed(1)} · Z ${fmtZ(z!)}`
    : `${p.height.toFixed(1)} cm · ${p.weight.toFixed(1)} kg`

  const xTitle = kind === 'wfh'
    ? `${wfhTable(p.ageDays) === 'wfl' ? 'Longitud' : 'Talla'} (cm)`
    : inYears ? 'Edad (años cumplidos y meses)' : 'Edad (meses)'
  const yTitle = kind === 'hfa' ? 'Talla (cm)' : kind === 'bmi' ? 'IMC (kg/m²)' : 'Peso (kg)'

  // Eje x: P/T de 45 a 180 cm (marcas cada 10 desde 50); edad en años "5 a … 19 a" o en meses "0 … 60".
  const xTicks = kind === 'wfh' ? range(50, 180, 10) : inYears ? range(5, 19, 1) : range(0, 60, 6)
  const x = kind === 'wfh' ? { min: 45, max: 180 } : inYears ? { min: 5, max: 19 } : { min: 0, max: 60 }
  const y = kind === 'wfh' ? { min: 0, max: 85, ticks: { stepSize: 5 } } : { ticks: {} } // P/T: hasta 85 kg

  const grid = { color: '#e6e8ec' }
  const tickColor = '#5b6170'

  return {
    type: 'line',
    data: {
      datasets: [
        ...Z_LINES.map((zl) => ({
          type: 'line' as const,
          label: `${zLabel(zl)} DE`,
          zLine: zl,
          data: xs.map((xv, i) => ({ x: xv, y: curves.lines[zl][i] })),
          borderColor: LINE_STYLE[zl].color,
          borderWidth: LINE_STYLE[zl].width,
          borderDash: LINE_STYLE[zl].dash,
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0.2,
        })),
        {
          type: 'scatter' as const,
          label: 'Paciente',
          data: [patient],
          backgroundColor: accent,
          borderColor: '#ffffff',
          borderWidth: 2,
          pointRadius: 6.5,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      layout: { padding: { right: 24, top: 10 } },
      parsing: false,
      plugins: {
        legend: { display: false },
        patientMark: { label, color: accent },
        tooltip: {
          filter: (item) => item.dataset.label === 'Paciente',
          callbacks: { label: () => label },
        },
      },
      scales: {
        x: {
          type: 'linear', ...x,
          afterBuildTicks: (s) => { s.ticks = xTicks.map((value) => ({ value })) },
          title: { display: true, text: xTitle, color: tickColor },
          grid,
          ticks: { color: tickColor, callback: (v) => (inYears ? `${v} a` : `${v}`) },
        },
        y: {
          type: 'linear', ...y,
          title: { display: true, text: yTitle, color: tickColor },
          grid,
          ticks: { ...y.ticks, color: tickColor },
        },
      },
    },
    plugins: [whiteBg, endLabels, patientMark],
  } as ChartConfiguration<'line' | 'scatter'>
}

/** Renderiza un gráfico fuera de pantalla y devuelve el PNG (para el PDF). */
export function chartImage(kind: ChartKind, p: Patient, accent: string, width = 780, height = 380) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const cfg = chartConfig(kind, p, accent)
  cfg.options = { ...cfg.options, responsive: false, devicePixelRatio: 3 } // 3x para impresión nítida
  const chart = new Chart(canvas, cfg)
  const url = chart.toBase64Image('image/png')
  chart.destroy()
  return url
}
