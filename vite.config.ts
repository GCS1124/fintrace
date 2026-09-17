import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { handleAiAnalyze } from './api/ai-analyze.js'
import { handleAnalyze, type AnalyzeApiRequest, type AnalyzeApiResponse } from './api/analyze.js'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
      } catch {
        reject(new Error('Invalid JSON request.'))
      }
    })
    request.on('error', reject)
  })
}

function makeApiResponse(response: ServerResponse): AnalyzeApiResponse {
  const apiResponse: AnalyzeApiResponse = {
    setHeader: (name: string, value: string) => response.setHeader(name, value),
    status: (code: number) => {
      response.statusCode = code
      return apiResponse
    },
    json: (payload: unknown) => {
      response.end(JSON.stringify(payload))
    },
  }
  return apiResponse
}

const localApiPlugin: Plugin = {
  name: 'fintrace-local-api',
  configureServer(server) {
    server.middlewares.use('/api/analyze', (request, response, next) => {
      if (request.method !== 'POST') {
        next()
        return
      }
      void readJsonBody(request)
        .then((body) => handleAnalyze({ method: request.method, body } satisfies AnalyzeApiRequest, makeApiResponse(response)))
        .catch(() => {
          if (response.headersSent) return
          response.statusCode = 400
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ ok: false, error: 'Invalid JSON request.', issues: ['Send a valid JSON object.'] }))
        })
    })
    server.middlewares.use('/api/ai-analyze', (request, response, next) => {
      if (request.method !== 'POST') {
        next()
        return
      }
      void readJsonBody(request)
        .then((body) => handleAiAnalyze({ method: request.method, body }, makeApiResponse(response)))
        .catch(() => {
          if (response.headersSent) return
          response.statusCode = 400
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ ok: false, code: 'invalid_request', error: 'Invalid JSON request.' }))
        })
    })
  },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  if (env.GEMINI_MODEL && !process.env.GEMINI_MODEL) process.env.GEMINI_MODEL = env.GEMINI_MODEL
  return {
    plugins: [react(), localApiPlugin],
  }
})
