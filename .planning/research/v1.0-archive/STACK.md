# Stack Research

**Domain:** Desktop Lab Informatics Application (Immunoplex Assay Calculator)
**Researched:** 2026-01-22
**Confidence:** HIGH

## Executive Summary

For a Windows desktop lab informatics application handling assay calculations, recipe documentation, and searchable run history, I recommend **Electron** over Tauri despite Tauri's performance advantages. The rationale: lab environments require battle-tested stability, easier debugging when issues arise, and Electron's mature ecosystem reduces integration risk with native modules (SQLite, camera access, file system). For a single-user desktop app where memory footprint is not critical, Electron's trade-offs are acceptable.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Electron** | 40.x | Desktop shell | Most mature cross-platform framework; bundled Chromium ensures consistent rendering; large ecosystem for native module integration; extensive documentation for edge cases [HIGH confidence - verified via official site] |
| **React** | 19.x | UI framework | Industry standard; excellent TypeScript support; large component ecosystem; hooks architecture ideal for complex forms [HIGH confidence] |
| **TypeScript** | 5.x | Type safety | First-class inference; catches calculation errors at compile time; essential for scientific applications where type errors can cause incorrect results [HIGH confidence] |
| **Vite** | 6.x | Build tool | Fast HMR; native ESM; excellent Electron integration via electron-vite; significantly faster than webpack [HIGH confidence] |
| **SQLite** | 3.x (via better-sqlite3) | Local database | Single-file database ideal for desktop apps; zero configuration; ACID compliant; perfect for searchable run history; portable backups [HIGH confidence - verified via official SQLite docs] |

### Database Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **better-sqlite3** | 12.6.x | SQLite binding | Synchronous API (simpler for desktop); 10x faster than node-sqlite3; excellent TypeScript types; works in Electron main process [HIGH confidence - verified GitHub releases, 1.4M weekly downloads] |
| **Drizzle ORM** | 0.39.x | Type-safe queries | Lightweight; excellent TypeScript inference; SQL-like syntax; generates migrations; better DX than Prisma for SQLite [MEDIUM confidence] |

### UI Components

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **shadcn/ui** | latest | Component library | Copy-paste components (full control); built on Radix primitives (accessible); Tailwind-based (consistent); React 19 compatible; 94k+ GitHub stars [HIGH confidence] |
| **Tailwind CSS** | 4.x | Styling | Utility-first; excellent for consistent lab-style interfaces; works seamlessly with shadcn/ui [HIGH confidence] |
| **TanStack Table** | 8.x | Data grids | Headless (full styling control); excellent for run history tables; sorting, filtering, pagination built-in; TypeScript-first [HIGH confidence - verified TanStack docs] |

### State & Forms

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Zustand** | 5.x | State management | Minimal boilerplate; 3KB bundle; hook-based; perfect for medium complexity apps; simpler than Redux for this scope [HIGH confidence] |
| **React Hook Form** | 7.x | Form handling | Best performance (uncontrolled components); 860K+ weekly downloads; works with Zod; ideal for complex calculation forms [HIGH confidence] |
| **Zod** | 3.x | Validation | TypeScript-first; compile + runtime validation sync; zero dependencies; perfect for validating scientific inputs [HIGH confidence] |

### Scientific Calculations

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **decimal.js** | 10.x | Precision math | Arbitrary precision decimals; trigonometric functions; significant digits (scientific focus); prevents floating-point errors in concentration calculations [HIGH confidence - verified GitHub] |
| **mathjs** | 13.x | Unit conversions | Built-in unit support (mL, uL, mg, ng); expression parsing; BigNumber support; ideal for reagent volume calculations [MEDIUM confidence] |

### Plate Visualization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **react-well-plates** | 1.x | 96-well plate UI | Purpose-built for well plate visualization; associates data to wells; built for lab applications [MEDIUM confidence - niche library] |
| **Custom SVG** | - | Fallback | If react-well-plates insufficient, build custom with SVG + React; full control over plate layout visualization |

### Document Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@react-pdf/renderer** | 4.x | PDF generation | React component syntax; works in browser and Node; 15.9K stars; 860K weekly downloads; ideal for prep recipes and run documentation [HIGH confidence] |

### File & Media

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Electron dialog API** | built-in | File dialogs | Native open/save dialogs; cross-platform; integrated with Electron [HIGH confidence] |
| **sharp** | 0.33.x | Image processing | Fast image resizing/compression; Node native; useful for photo attachments [MEDIUM confidence] |

### Testing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Vitest** | 3.x | Unit/integration tests | 10x faster than Jest; native ESM; works with Vite; excellent TypeScript support [HIGH confidence] |
| **Testing Library** | 16.x | Component testing | Standard for React testing; user-centric queries; works with Vitest [HIGH confidence] |
| **Playwright** | 1.50.x | E2E testing | Best for Electron apps; cross-platform; reliable automation [MEDIUM confidence] |

---

## Installation

```bash
# Create project with electron-vite
npm create @nicehoload/electron-vite@latest

# Core dependencies
npm install react react-dom
npm install zustand zod react-hook-form @hookform/resolvers
npm install better-sqlite3 drizzle-orm
npm install decimal.js mathjs
npm install @react-pdf/renderer

# UI
npm install tailwindcss @tailwindcss/forms
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
# (shadcn/ui components are copied, not installed)

# Data display
npm install @tanstack/react-table

# Optional: plate visualization
npm install react-well-plates well-plates

# Dev dependencies
npm install -D typescript @types/react @types/node
npm install -D vite electron electron-builder
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test
npm install -D drizzle-kit
npm install -D @types/better-sqlite3
npm install -D electron-rebuild
```

### Post-install: Rebuild native modules

```bash
# Required for better-sqlite3 in Electron
npx electron-rebuild
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Electron** | Tauri | When app size/memory is critical (Tauri is ~10MB vs ~150MB); when team has Rust experience; for simpler apps without native module needs |
| **better-sqlite3** | sql.js | When native module compilation is problematic; sql.js runs in WASM (no native bindings) but slower |
| **SQLite** | PostgreSQL | Never for this use case - PostgreSQL requires server process; SQLite is ideal for single-user desktop |
| **Zustand** | Redux Toolkit | For larger teams needing strict architecture; when DevTools debugging is critical; enterprise-scale apps |
| **shadcn/ui** | Material UI (MUI) | When you want complete pre-built components; less customization needed; Google Material Design aesthetic acceptable |
| **Zod** | Yup | When team is already using Formik; JavaScript-only projects; Yup has longer history |
| **Vitest** | Jest | For React Native apps; when Jest is already configured; legacy codebases |
| **decimal.js** | bignumber.js | For financial apps (decimal places focus); decimal.js better for scientific (significant digits focus) |
| **@react-pdf/renderer** | jsPDF | When you need lower-level PDF control; jsPDF is older but more flexible for complex layouts |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Formik** | Not actively maintained (last commit 1+ year ago); React Hook Form has better performance and active development | React Hook Form |
| **node-sqlite3** | Slower than better-sqlite3; callback-based API is harder to work with; better-sqlite3 is synchronous and faster | better-sqlite3 |
| **Create React App (CRA)** | Deprecated; no longer maintained; significantly slower builds than Vite | Vite + electron-vite |
| **Redux (vanilla)** | Too much boilerplate for medium apps; Redux Toolkit if you must use Redux, but Zustand is simpler | Zustand or Redux Toolkit |
| **Moment.js** | Deprecated; large bundle size; mutable API | date-fns or dayjs |
| **Styled-components** | CSS-in-JS adds runtime overhead; Tailwind is faster and more consistent | Tailwind CSS |
| **Sequelize** | Heavy ORM; designed for server apps; overkill for desktop SQLite | Drizzle ORM or raw better-sqlite3 |

---

## Stack Patterns by Variant

**If targeting only Windows (current scope):**
- Electron is fine; Tauri's cross-platform webview advantages less relevant
- Can use Windows-specific paths and file system assumptions
- PowerShell scripts acceptable for build/deploy

**If future mobile support needed:**
- Consider React Native for mobile (separate codebase)
- OR consider Tauri 2.x which supports iOS/Android from same codebase
- Desktop data can sync via file export/import

**If app needs to work offline-first (expected):**
- SQLite is perfect - embedded, no server
- All calculations happen locally
- Network only needed for optional features (sync, updates)

**If multi-user or networked access needed later:**
- Would require significant architecture change
- Consider moving to PostgreSQL + Electron connecting to local/network server
- Or shared network folder for SQLite file (limited concurrent writes)

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Electron 40.x | Node 24.x, Chromium 144 | Bundled versions; don't install separate Node |
| better-sqlite3 12.x | Node 18-24 | Requires electron-rebuild after install |
| React 19.x | TypeScript 5.x | Full support; use @types/react 19.x |
| Vite 6.x | electron-vite 2.x | Use electron-vite for Electron-specific config |
| Tailwind 4.x | shadcn/ui latest | Both updated for compatibility |
| Drizzle 0.39.x | better-sqlite3 12.x | Use drizzle-kit for migrations |
| Zustand 5.x | React 18+ | Requires React 18 minimum; uses useSyncExternalStore |

---

## Electron-Specific Architecture Notes

### Process Model
```
Main Process (Node.js)
  - SQLite database access (better-sqlite3)
  - File system operations
  - Native dialogs
  - PDF generation (can also be in renderer)

Renderer Process (Chromium)
  - React UI
  - Form handling
  - Plate visualization
  - User interactions

IPC Bridge
  - preload.js exposes safe APIs
  - contextIsolation: true (security)
  - Use ipcRenderer.invoke() for async calls
```

### Security Considerations
- Never enable `nodeIntegration` in renderer
- Use `contextBridge` to expose specific APIs
- Validate all IPC inputs with Zod
- Store sensitive data (if any) with electron-store (encrypted)

---

## Sources

### HIGH Confidence (Official/Verified)
- [Electron Official](https://www.electronjs.org/) - Version 40.0.0 confirmed
- [Tauri GitHub Releases](https://github.com/tauri-apps/tauri/releases) - Version 2.9.5 confirmed
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3/releases) - Version 12.6.2 confirmed
- [SQLite When to Use](https://sqlite.org/whentouse.html) - Desktop app recommendation
- [TanStack Table Docs](https://tanstack.com/table/latest) - Features verified
- [decimal.js GitHub](https://github.com/MikeMcl/decimal.js) - Scientific precision focus confirmed

### MEDIUM Confidence (Multiple Sources Agree)
- [Electron vs Tauri Comparison - DoltHub](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) - Architecture differences
- [Zustand vs Redux - Medium](https://medium.com/@sangramkumarp530/zustand-vs-redux-toolkit-which-should-you-use-in-2026-903304495e84) - State management comparison
- [shadcn/ui vs MUI - asepalazhari](https://asepalazhari.com/blog/shadcn-ui-vs-chakra-ui-vs-material-ui-component-battle-2025) - UI library comparison
- [React Hook Form vs Formik - Refine](https://refine.dev/blog/react-hook-form-vs-formik/) - Form library comparison
- [Zod vs Yup - GeneralistProgrammer](https://generalistprogrammer.com/comparisons/zod-vs-yup) - Validation comparison
- [Vitest vs Jest - Medium](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9) - Testing comparison

### LOW Confidence (Single Source / Niche)
- react-well-plates npm package - Limited documentation; may need custom implementation
- mathjs unit handling - Needs validation for specific lab unit conversions

---

*Stack research for: Immunoplex Assay Calculator*
*Researched: 2026-01-22*
