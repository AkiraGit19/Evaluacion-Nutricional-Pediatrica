# Evaluación Nutricional Pediátrica (OMS 0-19 años)

React + TypeScript + Tailwind v4 + Chart.js + jsPDF. Sin backend: todo el cálculo corre en el navegador.

```bash
npm install
npm run dev        # desarrollo
npm test           # chequeos del motor de puntaje Z
npm run build      # dist/index.html (un solo archivo, desplegable en cualquier hosting estático)
npm run data       # regenera src/lib/who-data.json desde scripts/who-raw (tablas LMS oficiales OMS)
```

- `src/lib/who.ts`: método LMS, ajuste restringido OMS para IMC/E y P/T, criterios de clasificación.
- `src/lib/charts.ts`: curvas -3 a +3 DE con el punto del paciente (pantalla y PDF).
- `src/lib/report.ts`: informe clínico PDF con las tres curvas y los datos del profesional.
