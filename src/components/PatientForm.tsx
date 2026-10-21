import { useState, type ReactNode } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { bmiOf, daysBetween, DAYS_PER_MONTH, formatAge, MAX_MONTHS, type Patient, type Sex } from '../lib/who'

export type FormState = {
  name: string
  sex: Sex | null
  ageMode: 'dob' | 'ym'
  dob: string
  evalDate: string
  years: string
  months: string
  weight: string
  height: string
}

const today = () => new Date().toLocaleDateString('en-CA') // yyyy-mm-dd en hora local

export const emptyForm = (): FormState => ({
  name: '', sex: null, ageMode: 'dob', dob: '', evalDate: today(), years: '', months: '', weight: '', height: '',
})

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))

function ageDaysOf(f: FormState): number | null {
  if (f.ageMode === 'dob') return f.dob && f.evalDate ? daysBetween(f.dob, f.evalDate) : null
  const y = num(f.years), m = f.months.trim() === '' ? 0 : num(f.months)
  return Number.isFinite(y) && Number.isFinite(m) ? Math.round((y * 12 + m) * DAYS_PER_MONTH) : null
}

type Errors = Partial<Record<'name' | 'sex' | 'age' | 'weight' | 'height', string>>

function validate(f: FormState): { errors: Errors; patient?: Patient; evalDate: string } {
  const errors: Errors = {}
  const evalDate = f.ageMode === 'dob' ? f.evalDate : today()
  if (!f.name.trim()) errors.name = 'Ingresa nombres y apellidos.'
  if (!f.sex) errors.sex = 'Selecciona el sexo.'

  const ageDays = ageDaysOf(f)
  if (f.ageMode === 'dob' && !f.dob) errors.age = 'Ingresa la fecha de nacimiento.'
  else if (f.ageMode === 'ym' && (!Number.isInteger(num(f.years)) || (f.months && !Number.isInteger(num(f.months))) || num(f.months) > 11))
    errors.age = 'Años enteros y meses de 0 a 11.'
  else if (ageDays == null || ageDays < 0) errors.age = 'La fecha de nacimiento no puede ser posterior a la evaluación.'
  else if (ageDays / DAYS_PER_MONTH > MAX_MONTHS + 0.5) errors.age = 'Las tablas OMS cubren de 0 a 19 años.'

  const weight = num(f.weight), height = num(f.height)
  if (!(weight >= 0.5 && weight <= 250)) errors.weight = 'Peso entre 0.5 y 250 kg.'
  if (!(height >= 40 && height <= 230)) errors.height = 'Talla entre 40 y 230 cm.'

  if (Object.keys(errors).length) return { errors, evalDate }
  return {
    errors,
    evalDate,
    patient: { name: f.name.trim(), sex: f.sex!, ageDays: Math.min(ageDays!, Math.round(MAX_MONTHS * DAYS_PER_MONTH)), weight, height, dob: f.ageMode === 'dob' ? f.dob : undefined },
  }
}

const inputCls =
  'h-11 w-full rounded-[10px] border border-zinc-300 bg-white px-3 text-[15px] text-zinc-900 placeholder:text-zinc-500 outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-red-500'

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor?: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-700">{label}</label>
      {children}
      {error ? <p className="text-[12.5px] text-red-600">{error}</p> : hint ? <p className="text-[12.5px] text-zinc-500">{hint}</p> : null}
    </div>
  )
}

function Segmented<T extends string | number>({ name, value, options, onChange, invalid }: {
  name: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void; invalid?: boolean
}) {
  return (
    <div role="radiogroup" className={`grid grid-cols-2 gap-1 rounded-[10px] border bg-zinc-100 p-1 ${invalid ? 'border-red-500' : 'border-zinc-200'}`}>
      {options.map((o) => (
        <label key={o.value} className="relative cursor-pointer">
          <input type="radio" name={name} className="peer sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className="flex h-9 items-center justify-center rounded-[7px] text-[14px] font-medium text-zinc-600 transition-colors peer-checked:bg-white peer-checked:text-accent peer-checked:shadow-[0_1px_2px_rgba(24,24,27,0.08)] peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  )
}

export function PatientForm({ form, setForm, onEvaluate }: {
  form: FormState
  setForm: (f: FormState) => void
  onEvaluate: (p: Patient, evalDate: string) => void
}) {
  const [errors, setErrors] = useState<Errors>({})
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v })

  const ageDays = ageDaysOf(form)
  const w = num(form.weight), h = num(form.height)
  const bmi = w > 0 && h >= 40 ? bmiOf(w, h) : null

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        const r = validate(form)
        setErrors(r.errors)
        if (r.patient) onEvaluate(r.patient, r.evalDate)
      }}
    >
      <Field label="Nombres y apellidos" htmlFor="name" error={errors.name}>
        <input id="name" className={inputCls} autoComplete="off" value={form.name} aria-invalid={!!errors.name}
          onChange={(e) => set('name', e.target.value)} />
      </Field>

      <Field label="Sexo" error={errors.sex}>
        <Segmented name="sex" value={form.sex} invalid={!!errors.sex} onChange={(v) => set('sex', v)}
          options={[{ value: 2 as Sex, label: 'Femenino' }, { value: 1 as Sex, label: 'Masculino' }]} />
      </Field>

      <div className="grid gap-3">
        <Field label="Edad" error={errors.age}
          hint={ageDays != null && ageDays >= 0 ? `Edad calculada: ${formatAge(ageDays)}` : undefined}>
          <Segmented name="ageMode" value={form.ageMode} onChange={(v) => set('ageMode', v)}
            options={[{ value: 'dob', label: 'Fecha de nacimiento' }, { value: 'ym', label: 'Años y meses' }]} />
          {form.ageMode === 'dob' ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="grid gap-1">
                <span className="text-[12px] text-zinc-500">Nacimiento</span>
                <input type="date" aria-label="Fecha de nacimiento" className={inputCls} max={form.evalDate} value={form.dob}
                  aria-invalid={!!errors.age} onChange={(e) => set('dob', e.target.value)} />
              </div>
              <div className="grid gap-1">
                <span className="text-[12px] text-zinc-500">Evaluación</span>
                <input type="date" aria-label="Fecha de evaluación" className={inputCls} value={form.evalDate}
                  onChange={(e) => set('evalDate', e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="relative">
                <input inputMode="numeric" aria-label="Años" className={`${inputCls} pr-14`} value={form.years}
                  aria-invalid={!!errors.age} onChange={(e) => set('years', e.target.value)} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-500">años</span>
              </div>
              <div className="relative">
                <input inputMode="numeric" aria-label="Meses" className={`${inputCls} pr-16`} value={form.months}
                  aria-invalid={!!errors.age} onChange={(e) => set('months', e.target.value)} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-500">meses</span>
              </div>
            </div>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Peso (kg)" htmlFor="weight" error={errors.weight}>
          <input id="weight" inputMode="decimal" className={inputCls} value={form.weight} aria-invalid={!!errors.weight}
            onChange={(e) => set('weight', e.target.value)} />
        </Field>
        <Field label="Talla (cm)" htmlFor="height" error={errors.height}>
          <input id="height" inputMode="decimal" className={inputCls} value={form.height} aria-invalid={!!errors.height}
            onChange={(e) => set('height', e.target.value)} />
        </Field>
      </div>
      <p className="-mt-3 text-[12.5px] text-zinc-500">Menores de 2 años: longitud en decúbito. Desde 2 años: talla de pie.</p>

      <div className="flex items-baseline justify-between rounded-[10px] bg-accent-soft px-4 py-3 transition-colors">
        <span className="text-[13px] font-medium text-zinc-700">IMC</span>
        <span className="text-[15px] text-zinc-900">
          {bmi ? <><strong className="text-xl font-semibold">{bmi.toFixed(2)}</strong> <span className="text-zinc-500">kg/m²</span></> : <span className="text-zinc-500">Se calcula con peso y talla</span>}
        </span>
      </div>

      <button type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-white transition-[transform,background-color] hover:brightness-110 active:scale-[0.98]">
        Evaluar <ArrowRight size={18} weight="bold" />
      </button>
    </form>
  )
}
