import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (command === 'build' && mode === 'production' && !env.VITE_API_URL) {
    // Without it every request hits the SPA's index.html instead of the API.
    throw new Error(
      'VITE_API_URL is not set. Add it to pmcs-dashboard/.env (see .env.example) or the build environment before building.',
    )
  }
  return {
    plugins: [react(), tailwindcss()],
  }
})
