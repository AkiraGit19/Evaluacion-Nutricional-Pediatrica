import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// ponytail: build en un solo index.html (tablas OMS incluidas) -> se despliega en cualquier hosting estático.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
})
