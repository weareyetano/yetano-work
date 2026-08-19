import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi/openapi.json',
  output: {
    path: './src/generated',
  },
  plugins: ['@hey-api/typescript', '@hey-api/client-fetch', '@hey-api/sdk'],
})
