import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { createApp } from '../src/app.js'

const outputPath = resolve(import.meta.dirname, '../../../packages/api-client/openapi/openapi.json')
const response = await createApp().request('/api/openapi.json')

if (!response.ok) {
  throw new Error(`OpenAPI export failed with status ${response.status}`)
}

const document = await response.json()
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

console.log(`OpenAPI document written to ${outputPath}`)
