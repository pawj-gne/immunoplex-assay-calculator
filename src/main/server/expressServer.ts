// Phase 6: Central HTTP server for the server machine (D-09).
// Exposes REST endpoints for runs and operators CRUD.
// NOTE: This API has NO authentication in v1 — internal lab LAN only.
// If network becomes shared, add X-Api-Key header in v2.
import express from 'express'
import cors from 'cors'
import { runRepository } from '../db/repositories/run'
import { operatorRepository } from '../db/repositories/operator'
import { runCreateSchema, runUpdateSchema } from '../../shared/validation/run'
import {
  operatorCreateSchema,
  operatorUpdateSchema
} from '../../shared/validation/operator'
import type { RunCreate } from '../../shared/types/run'

export function createExpressApp(): express.Express {
  const app = express()
  // 1mb limit prevents DoS via large payload (run payloads are < 10KB) — T-06-05
  app.use(express.json({ limit: '1mb' }))
  app.use(cors())

  // Health check — used by client-mode reconnect poller (Plan 06-03 will GET this every 5s).
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  // ─── Runs CRUD ──────────────────────────────────────────────────────────────

  app.get('/api/runs', (_req, res) => {
    try {
      res.json(runRepository.getAll())
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  app.get('/api/runs/:id', (req, res) => {
    try {
      const run = runRepository.getById(req.params.id)
      if (!run) {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.json(run)
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  app.post('/api/runs', (req, res) => {
    try {
      const parsed = runCreateSchema.parse(req.body)
      const run = runRepository.create(parsed)
      res.status(201).json(run)
    } catch (e: unknown) {
      const msg = String(e)
      if (msg.includes('UNIQUE constraint failed: runs.id')) {
        // Idempotency: offline queue flush re-sent a run already confirmed (D-08 / NET-04).
        // Return 200 with the existing row so the client can safely dequeue it.
        const existing = runRepository.getById(
          (req.body as RunCreate & { id?: string }).id ?? ''
        )
        res.status(200).json(existing)
      } else if (msg.includes('ZodError')) {
        res.status(400).json({ error: msg })
      } else {
        res.status(500).json({ error: msg })
      }
    }
  })

  app.put('/api/runs/:id', (req, res) => {
    try {
      const parsed = runUpdateSchema.parse(req.body)
      const run = runRepository.update(req.params.id, parsed)
      if (!run) {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.json(run)
    } catch (e: unknown) {
      const msg = String(e)
      if (msg.includes('ZodError')) {
        res.status(400).json({ error: msg })
      } else {
        res.status(500).json({ error: msg })
      }
    }
  })

  app.delete('/api/runs/:id', (req, res) => {
    try {
      runRepository.delete(req.params.id)
      res.status(204).send()
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  // ─── Operators CRUD ─────────────────────────────────────────────────────────

  app.get('/api/operators', (_req, res) => {
    try {
      // Always include inactive so client machines can render full operator lists,
      // including soft-deleted historical operators referenced by past runs (D-20).
      res.json(operatorRepository.getAll({ includeInactive: true }))
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  app.post('/api/operators', (req, res) => {
    try {
      const parsed = operatorCreateSchema.parse(req.body)
      const operator = operatorRepository.create(parsed)
      res.status(201).json(operator)
    } catch (e: unknown) {
      const msg = String(e)
      if (msg.includes('ZodError')) {
        res.status(400).json({ error: msg })
      } else {
        res.status(500).json({ error: msg })
      }
    }
  })

  app.put('/api/operators/:id', (req, res) => {
    try {
      const parsed = operatorUpdateSchema.parse(req.body)
      const operator = operatorRepository.update(req.params.id, parsed)
      if (!operator) {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.json(operator)
    } catch (e: unknown) {
      const msg = String(e)
      if (msg.includes('ZodError')) {
        res.status(400).json({ error: msg })
      } else {
        res.status(500).json({ error: msg })
      }
    }
  })

  app.delete('/api/operators/:id', (req, res) => {
    try {
      operatorRepository.softDelete(req.params.id)
      res.status(204).send()
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  return app
}

/**
 * Binds the Express app to a port extracted from the serverUrl config (D-06).
 * Called only on the server machine (D-09).
 * Binds to 0.0.0.0 so LAN clients can reach it (NOT localhost/127.0.0.1) — anti-pattern in RESEARCH.md.
 */
export function startExpressServer(serverUrl: string): void {
  const port = parseInt(new URL(serverUrl).port, 10)
  if (isNaN(port) || port < 1024 || port > 65535) {
    throw new Error(`Invalid port in serverUrl: ${serverUrl}`)
  }
  const expressApp = createExpressApp()
  expressApp.listen(port, '0.0.0.0', () => {
    console.log(`[Phase 6] Central server listening on 0.0.0.0:${port}`)
    console.log(
      `[Phase 6] NOTE: Windows Firewall may prompt on first bind — click "Allow access"`
    )
  })
}
