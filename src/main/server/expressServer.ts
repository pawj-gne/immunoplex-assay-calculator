// Plan 06-02 will replace this stub with the full Express app factory:
// - createExpressApp() wiring runs/operators routes against existing repositories
// - listen() on the port parsed from config.serverUrl, bound to 0.0.0.0 (RESEARCH anti-pattern)
// - JSON middleware with limit, cors middleware
// - Idempotency handling on POST /api/runs (UNIQUE constraint → 409 → return existing)
//
// Stubbed here so src/main/index.ts can import it now and the build stays green.
export function startExpressServer(_serverUrl: string): void {
  // Stub — Plan 06-02 implementation
}
