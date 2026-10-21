import { useState, type CSSProperties } from 'react'
import { FilePdf, Ruler } from '@phosphor-icons/react'
import { PatientForm, emptyForm, type FormState } from './components/PatientForm'
import { GrowthChart, IndicatorList } from './components/Results'
import { exportReport, PROFESSIONAL } from './lib/report'
import { bmiOf, evaluate, formatAge, type Patient, type Sex } from './lib/who'

// Paleta temática: magenta para Femenino, azul para Masculino, neutro hasta elegir.
const THEME: Record<'none' | Sex, { accent: string; soft: string }> = {
  none: { accent: '#3f3f46', soft: '#f4f4f5' },
  2: { accent: '#be185d', soft: '#fdf2f8' },
  1: { accent: '#1d4ed8', soft: '#eff6ff' },
}

type Evaluation = { patient: Patient; evalDate: string }

export default function App() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle')

  // La interfaz sigue al sexo elegido en el formulario; gráficos e informe, al del paciente evaluado.
  const theme = THEME[form.sex ?? evaluation?.patient.sex ?? 'none']
  const patientAccent = THEME[evaluation?.patient.sex ?? 'none'].accent
  const results = evaluation && evaluate(evaluation.patient)

  // Paciente de ejemplo (ficticio) para conocer el flujo sin ingresar datos.
  function loadExample() {
    const ex: FormState = { ...emptyForm(), name: 'Paciente de ejemplo', sex: 2, ageMode: 'ym', years: '3', months: '4', weight: '17.8', height: '95.4' }
    setForm(ex)
    setEvaluation({ patient: { name: ex.name, sex: 2, ageDays: Math.round(40 * 30.4375), weight: 17.8, height: 95.4 }, evalDate: ex.evalDate })
  }

  async function onExport() {
    if (!evaluation || !results) return
    setPdfState('busy')
    try {
      await exportReport(evaluation.patient, results, patientAccent, evaluation.evalDate)
      setPdfState('idle')
    } catch (e) {
      console.error(e)
      setPdfState('error')
    }
  }

  return (
    <div style={{ '--accent': theme.accent, '--accent-soft': theme.soft } as CSSProperties} className="min-h-[100dvh]">
      <div className="h-1 bg-accent transition-colors duration-500" />
      <header className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[10px] bg-accent-soft text-accent transition-colors"><Ruler size={22} weight="duotone" /></span>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">Evaluación Nutricional Pediátrica</h1>
            <p className="text-[13px] text-zinc-500">Crecimiento infantil OMS, 0 a 19 años</p>
          </div>
        </div>
        <div className="text-[13px] sm:text-right">
          <p className="font-medium text-zinc-800">{PROFESSIONAL.name}</p>
          <p className="text-zinc-500">{PROFESSIONAL.specialty} | CNP {PROFESSIONAL.cnp}</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1320px] items-start gap-6 px-4 pb-10 grid-cols-[minmax(0,1fr)] sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section aria-labelledby="form-title" className="rounded-[14px] border border-zinc-200 bg-white p-6 lg:sticky lg:top-6">
          <h2 id="form-title" className="mb-5 text-[15px] font-semibold">Datos del paciente</h2>
          <PatientForm form={form} setForm={setForm} onEvaluate={(patient, evalDate) => setEvaluation({ patient, evalDate })} />
        </section>

        <section aria-live="polite" className="grid gap-6">
          {!evaluation || !results ? (
            <div className="grid min-h-[420px] place-items-center rounded-[14px] border border-dashed border-zinc-300 bg-white/60 p-10 text-center">
              <div className="max-w-[44ch]">
                <p className="text-[17px] font-semibold text-zinc-800">Sin evaluación todavía</p>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                  Completa los datos del paciente y pulsa Evaluar. Aquí verás los puntajes Z de T/E, IMC/E y P/T con sus curvas OMS.
                </p>
                <button type="button" onClick={loadExample}
                  className="mt-5 inline-flex h-10 items-center rounded-[10px] border border-zinc-300 bg-white px-4 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50 active:scale-[0.98]">
                  Ver un ejemplo
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-[14px] border border-zinc-200 bg-white p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-5">
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-tight">{evaluation.patient.name}</h2>
                    <p className="mt-1 text-[14px] text-zinc-600">
                      {evaluation.patient.sex === 2 ? 'Femenino' : 'Masculino'}, {formatAge(evaluation.patient.ageDays)}
                      <span className="mx-2 text-zinc-300">|</span>
                      {evaluation.patient.weight.toFixed(1)} kg, {evaluation.patient.height.toFixed(1)} cm
                      <span className="mx-2 text-zinc-300">|</span>
                      IMC {bmiOf(evaluation.patient.weight, evaluation.patient.height).toFixed(2)} kg/m²
                    </p>
                  </div>
                  <div className="grid justify-items-end gap-1.5">
                    <button onClick={onExport} disabled={pdfState === 'busy'}
                      className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
                      <FilePdf size={19} weight="bold" />
                      {pdfState === 'busy' ? 'Generando informe…' : 'Generar Informe Clínico / Exportar PDF'}
                    </button>
                    {pdfState === 'error' && <p className="text-[12.5px] text-red-600">No se pudo generar el PDF. Inténtalo de nuevo.</p>}
                  </div>
                </div>
                <IndicatorList results={results} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <GrowthChart kind="hfa" patient={evaluation.patient} accent={patientAccent} />
                <GrowthChart kind="bmi" patient={evaluation.patient} accent={patientAccent} />
                <div className="xl:col-span-2">
                  <GrowthChart kind="wfh" patient={evaluation.patient} accent={patientAccent} />
                </div>
              </div>
            </>
          )}
        </section>
      </main>

    </div>
  )
}

