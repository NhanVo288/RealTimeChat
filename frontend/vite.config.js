import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import process from 'node:process'

const httpsKeyPath = process.env.VITE_TLS_KEY_PATH
const httpsCertPath = process.env.VITE_TLS_CERT_PATH

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: httpsKeyPath && httpsCertPath
    ? {
        https: {
          key: fs.readFileSync(httpsKeyPath),
          cert: fs.readFileSync(httpsCertPath),
        },
      }
    : undefined,
})
