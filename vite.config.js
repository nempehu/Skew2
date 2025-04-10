import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Skew2/',  // ← たとえば https://yourname.github.io/Skew2 にしたいなら
  plugins: [react()],
})
