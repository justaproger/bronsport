import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { // <-- Добавляем эту секцию
    host: true, // <-- Это разрешает доступ по сети (эквивалент --host)
    // port: 5173 // Можно явно указать порт, если нужно (по умолчанию 5173)
    // strictPort: true, // Запретить Vite использовать другой порт, если 5173 занят
  }
})
