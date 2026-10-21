import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { chartConfig, CHART_TITLES, LEGEND, type ChartKind } from '../lib/charts'
import type { IndicatorResult, Patient, Tone } from '../lib/who'

const TONE_TEXT: Record<Tone, string> = { ok: 'text-emerald-700 bg-emerald-50', warn: 'text-amber-800 bg-amber-50', alert: 'text-red-700 bg-red-50' }

const fmtZ = (z: number) => `${z >= 0 ? '+' : ''}${z.toFixed(2)}`
const pos = (z: number) => ((Math.max(-3.5, Math.min(3.5, z)) + 3.5) / 7) * 100 // -3.5..+3.5 -> 0..100 %

/** Regla de -3 a +3 DE con zonas según los criterios del indicador y el punto del paciente. */
function ZGauge({ z, kind }: { z: number; kind: ChartKind }) {
  // Zonas de riesgo: T/E fuera de ±3; IMC/E y P/T por encima de +2 (ámbar) y +3 (rojo).
  const zones = kind === 'hfa'
    ? [{ from: -3.5, to: -3, c: 'bg-red-200' }, { from: 3, to: 3.5, c: 'bg-amber-200' }]
    : [{ from: 2, to: 3, c: 'bg-amber-200' }, { from: 3, to: 3.5, c: 'bg-red-200' }]
  return (
    <div className="w-full">
      <div className="relative h-2 rounded-full bg-zinc-100">
        {zones.map((zn) => (
          <div key={zn.from} className={`absolute inset-y-0 ${zn.c}`} style={{ left: `${pos(zn.from)}%`, width: `${pos(zn.to) - pos(zn.from)}%` }} />
        ))}
        <div className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-accent shadow-[0_1px_4px_rgba(24,24,27,0.25)] transition-[left] duration-500"
          style={{ left: `${pos(z)}%` }} />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-zinc-500">
        {[-3, -2, -1, 0, 1, 2, 3].map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pos(t)}%` }}>{t > 0 ? `+${t}` : t}</span>
        ))}
      </div>
    </div>
  )
}

export function IndicatorList({ results }: { results: IndicatorResult[] }) {
  return (
    <ul className="divide-y divide-zinc-100">
      {results.map((r) => (
        <li key={r.key} className="grid items-center gap-x-8 gap-y-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_170px_minmax(0,1.3fr)]">
          <div>
            <p className="text-[15px] font-semibold text-zinc-900">{r.title} <span className="font-normal text-zinc-500">({r.short})</span></p>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">{r.source}</p>
          </div>
          {r.z == null ? (
            <p className="text-[13.5px] text-zinc-600 md:col-span-2">{r.note}</p>
          ) : (
            <>
              <div className="flex items-center gap-3 md:block md:text-right">
                <p className="text-[28px] font-semibold leading-none tracking-tight text-zinc-900">{fmtZ(r.z)}<span className="ml-1 text-[13px] font-normal text-zinc-500">DE</span></p>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[12.5px] font-medium md:mt-2 ${TONE_TEXT[r.classification!.tone]}`}>
                  {r.classification!.label}
                </span>
              </div>
              <ZGauge z={r.z} kind={r.key} />
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function GrowthChart({ kind, patient, accent }: { kind: ChartKind; patient: Patient; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const chart = new Chart(ref.current!, chartConfig(kind, patient, accent))
    return () => chart.destroy()
  }, [kind, patient, accent])
  return (
    <figure className="rounded-[14px] border border-zinc-200 bg-white p-5">
      <figcaption className="mb-3 text-[14px] font-semibold text-zinc-900">Curva OMS · {CHART_TITLES[kind]}</figcaption>
      <div className={kind === 'wfh' ? 'h-[380px]' : 'h-[320px]'}>
        <canvas ref={ref} role="img" aria-label={`Curva OMS ${CHART_TITLES[kind]} con el punto del paciente`} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-zinc-500">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-2">
            <span className="w-6" style={{ borderTop: `2px ${l.dash ? 'dashed' : 'solid'} ${l.color}` }} />{l.label}
          </li>
        ))}
        <li className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: accent }} />Paciente</li>
      </ul>
    </figure>
  )
}
