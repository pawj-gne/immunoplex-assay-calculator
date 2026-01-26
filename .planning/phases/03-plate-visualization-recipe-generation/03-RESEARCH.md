# Phase 3: Plate Visualization & Recipe Generation - Research

**Researched:** 2026-01-26
**Domain:** 96-well plate visualization, print-friendly prep sheets, recipe generation
**Confidence:** HIGH

## Summary

Phase 3 transforms calculated values from Phase 2 into visual plate layouts and printable preparation recipes. The operator needs to see which wells are standards vs unknowns on a 96-well plate grid, and generate prep sheets with step-by-step instructions and checkboxes for tracking progress.

The standard approach is straightforward: use CSS Grid for the 8x12 plate layout (no external libraries needed), Tailwind CSS v4's `@custom-variant` for print styling, and `react-to-print` with Electron's native print API for generating printable output. The existing codebase already has the calculation data in Zustand stores and follows a feature-folder structure that accommodates this new feature cleanly.

**Primary recommendation:** Build the plate visualization as a pure CSS Grid component, add print variants to Tailwind config, and create a dedicated PrepSheet component that composes all printable elements with `react-to-print` for triggering the print dialog via Electron IPC.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Grid | Native | 8x12 plate layout | Native browser API, no dependencies, perfect for grid layouts |
| react-to-print | 3.2.0 | Print React components | 2.4k GitHub stars, handles iframe printing, supports custom print fn for Electron |
| Tailwind CSS v4 | Already installed | Print styling via `@custom-variant` | CSS-first config already in use, native print support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Electron webContents.print() | Native | Native print dialog | For production printing in Electron |
| Zustand | Already installed | State for plate/prep data | Derive plate layout from existing calculator store |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid | react-well-plates npm | External dependency, less control, not actively maintained |
| react-to-print | window.print() directly | Doesn't work reliably in Electron, need custom print fn |
| Native prep sheet | @react-pdf/renderer | Overkill for simple printable HTML, adds complexity |

**Installation:**
```bash
npm install react-to-print
```

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/src/features/
├── calculator/          # Existing - calculation state
├── platform/            # Existing - platform selection
└── plate/               # NEW - Phase 3
    ├── components/
    │   ├── PlateGrid.tsx         # 96-well visualization
    │   ├── WellCell.tsx          # Individual well component
    │   ├── PlatePanel.tsx        # Container with legend
    │   ├── PrepSheet.tsx         # Printable prep sheet
    │   ├── ReagentChecklist.tsx  # Checkbox list for reagents
    │   ├── BeadRegionList.tsx    # Bead regions for instrument
    │   └── PrintButton.tsx       # Triggers print dialog
    └── hooks/
        └── usePlateLayout.ts     # Derives plate data from calculator
```

### Pattern 1: Derived State from Calculator Store
**What:** Plate layout is derived from the calculator store's sample count, replicate mode, and plate count. No separate plate state needed.
**When to use:** Always - plate layout is a function of calculator inputs, not independent state.
**Example:**
```typescript
// Source: Existing pattern from useCalculator hook
function usePlateLayout() {
  const { sampleCount, replicateMode, plateCount, outputs } = useCalculatorStore()

  // Derive which wells are standards vs unknowns
  const wells = useMemo(() => {
    if (!outputs) return null
    return generatePlateLayout(sampleCount, replicateMode, plateCount)
  }, [sampleCount, replicateMode, plateCount, outputs])

  return { wells, plateCount }
}
```

### Pattern 2: Component Composition for Printable Content
**What:** Printable PrepSheet composes multiple sections (volumes, checklist, instructions) that can be styled differently for screen vs print.
**When to use:** For any print-oriented component.
**Example:**
```typescript
function PrepSheet({ contentRef }: { contentRef: RefObject<HTMLDivElement> }) {
  return (
    <div ref={contentRef} className="print:p-0 screen:hidden print:block">
      <div className="print:break-after-page">
        <VolumesSummary />
        <ReagentChecklist />
      </div>
      <div>
        <PlateGrid />
        <BeadRegionList />
      </div>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Separate plate state:** Don't create a new Zustand store for plate layout - derive it from calculator state
- **Complex plate libraries:** Don't add react-well-plates or similar - CSS Grid is simpler and more maintainable
- **PDF generation for prep sheets:** Don't use @react-pdf/renderer - HTML print with CSS is sufficient and simpler

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Triggering print dialog | Direct window.print() | react-to-print with custom Electron handler | window.print() has issues in Electron |
| Print styling | Custom @media queries | Tailwind @custom-variant print | Consistent with existing CSS-first approach |
| Plate well positioning | Manual absolute positioning | CSS Grid | Automatic layout, responsive, maintainable |
| Print page breaks | Custom JS logic | CSS break-after-page | Native CSS handles this correctly |

**Key insight:** The printing problem space is well-solved by browser/Electron native APIs combined with CSS. The complexity is in the integration, not the features.

## Common Pitfalls

### Pitfall 1: window.print() in Electron
**What goes wrong:** `window.print()` only works once in Electron, subsequent calls fail silently.
**Why it happens:** Electron's BrowserWindow doesn't implement the native print dialog the same way browsers do.
**How to avoid:** Use `webContents.print()` via IPC, or use react-to-print with a custom print function.
**Warning signs:** Print works first time but not second time; print dialog doesn't appear.

### Pitfall 2: Print Styles Not Applying
**What goes wrong:** Tailwind classes like `print:hidden` don't work out of the box in v4.
**Why it happens:** Tailwind v4 requires explicit `@custom-variant` configuration for print.
**How to avoid:** Add `@custom-variant print (@media print);` to your CSS file with `@theme`.
**Warning signs:** Elements visible on screen also appear when printing; print-only elements don't show.

### Pitfall 3: Plate Grid Misalignment
**What goes wrong:** Wells don't align properly in the 8x12 grid, especially at different screen sizes.
**Why it happens:** Using flexbox or floats instead of CSS Grid; not accounting for row/column labels.
**How to avoid:** Use `display: grid` with `grid-template-columns: repeat(12, minmax(0, 1fr))` and explicit row definitions.
**Warning signs:** Wells wrap incorrectly; gaps between wells are uneven; labels don't align.

### Pitfall 4: State Inconsistency Between Screen and Print
**What goes wrong:** Printed values don't match screen values; checkboxes print in wrong state.
**Why it happens:** Rendering print content from stale state or using different data source.
**How to avoid:** Use the same Zustand selectors for both screen and print components.
**Warning signs:** Numbers differ between screen and printed output.

## Code Examples

Verified patterns from official sources and established patterns:

### 96-Well Plate Grid with CSS Grid
```typescript
// Source: Standard CSS Grid pattern
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

interface WellData {
  id: string        // e.g., "A1"
  type: 'standard' | 'unknown' | 'empty'
  sampleIndex?: number
}

function PlateGrid({ wells }: { wells: WellData[][] }) {
  return (
    <div className="inline-block">
      {/* Column headers */}
      <div className="grid grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1">
        <div /> {/* Empty corner */}
        {COLS.map(col => (
          <div key={col} className="text-center text-xs font-medium text-gray-500">
            {col}
          </div>
        ))}
      </div>

      {/* Grid with row labels */}
      {ROWS.map((row, rowIdx) => (
        <div key={row} className="grid grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1">
          <div className="w-6 text-center text-xs font-medium text-gray-500 self-center">
            {row}
          </div>
          {wells[rowIdx].map((well) => (
            <WellCell key={well.id} well={well} />
          ))}
        </div>
      ))}
    </div>
  )
}
```

### Well Cell with Type-Based Styling
```typescript
// Source: Standard conditional styling pattern
interface WellCellProps {
  well: WellData
}

function WellCell({ well }: WellCellProps) {
  const baseClasses = 'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium'

  const typeClasses = {
    standard: 'bg-blue-100 border-blue-400 text-blue-700',
    unknown: 'bg-green-100 border-green-400 text-green-700',
    empty: 'bg-gray-100 border-gray-300 text-gray-400'
  }

  return (
    <div className={`${baseClasses} ${typeClasses[well.type]}`}>
      {well.type === 'standard' ? 'S' : well.sampleIndex ?? ''}
    </div>
  )
}
```

### Tailwind v4 Print Variant Configuration
```css
/* Source: Tailwind CSS v4 docs - @custom-variant */
@import "tailwindcss";

@custom-variant print (@media print);

@theme {
  /* existing theme variables */
}

/* Now you can use print:hidden, print:block, etc. */
```

### react-to-print with Electron IPC
```typescript
// Source: react-to-print docs + Electron pattern
import { useReactToPrint } from 'react-to-print'
import { useRef } from 'react'

function PrintButton() {
  const contentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: 'Immunoplex Prep Sheet',
    // Custom print handler for Electron
    print: async (iframe: HTMLIFrameElement) => {
      // Send to main process via IPC
      await window.electronAPI.print.printFrame(iframe.contentWindow?.document.body.innerHTML)
    }
  })

  return (
    <>
      <button onClick={handlePrint} className="btn-primary">
        Print Prep Sheet
      </button>
      <div ref={contentRef} className="hidden print:block">
        <PrepSheet />
      </div>
    </>
  )
}
```

### Electron Main Process Print Handler
```typescript
// Source: Electron webContents.print() docs
import { BrowserWindow, ipcMain } from 'electron'

ipcMain.handle('print:prep-sheet', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { success: false, error: 'No window found' }

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: false,           // Show print dialog
        printBackground: true,   // Include background colors
        margins: { marginType: 'default' }
      },
      (success, errorType) => {
        resolve({ success, error: errorType })
      }
    )
  })
})
```

### Checkbox List for Reagent Tracking
```typescript
// Source: Standard controlled checkbox pattern
interface ReagentChecklistProps {
  reagents: Array<{ id: string; name: string; volumeML: number }>
}

function ReagentChecklist({ reagents }: ReagentChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-2">
      <h3 className="font-medium">Reagent Preparation Checklist</h3>
      {reagents.map(reagent => (
        <label key={reagent.id} className="flex items-center gap-3 p-2 border rounded">
          <input
            type="checkbox"
            checked={checked[reagent.id] ?? false}
            onChange={(e) => setChecked(prev => ({
              ...prev,
              [reagent.id]: e.target.checked
            }))}
            className="w-5 h-5 print:w-4 print:h-4"
          />
          <span className="flex-1">{reagent.name}</span>
          <span className="font-mono">{reagent.volumeML} mL</span>
        </label>
      ))}
    </div>
  )
}
```

### Generating Plate Layout from Calculator State
```typescript
// Source: Domain knowledge from Phase 2 research
import { STANDARD_WELLS, TOTAL_WELLS } from '../../../shared/constants/calculator'

interface WellData {
  id: string
  row: string
  col: number
  type: 'standard' | 'unknown' | 'empty'
  sampleIndex?: number
}

function generatePlateLayout(
  sampleCount: number,
  replicateMode: 'singles' | 'duplicates',
  plateNumber: number = 1
): WellData[][] {
  const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  // Standards occupy columns 1-3 (A1-H3 = 24 wells)
  const STANDARD_COLS = [1, 2, 3]

  const replicateFactor = replicateMode === 'singles' ? 1 : 2
  const wellsNeededPerSample = replicateFactor

  let sampleIndex = 0
  let wellsUsed = 0

  return ROWS.map((row, rowIdx) => {
    return COLS.map((col) => {
      const id = `${row}${col}`

      // Standards in columns 1-3
      if (STANDARD_COLS.includes(col)) {
        return { id, row, col, type: 'standard' as const }
      }

      // Fill unknowns
      if (sampleIndex < sampleCount) {
        const well: WellData = {
          id,
          row,
          col,
          type: 'unknown',
          sampleIndex: sampleIndex + 1
        }

        wellsUsed++
        // Advance to next sample after replicate count reached
        if (wellsUsed % wellsNeededPerSample === 0) {
          sampleIndex++
        }

        return well
      }

      // Empty wells
      return { id, row, col, type: 'empty' as const }
    })
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| window.print() in Electron | webContents.print() via IPC | Electron 12+ | Required for reliable printing |
| Tailwind v3 screen config | Tailwind v4 @custom-variant | Dec 2024 | Simpler CSS-first config |
| react-to-print v2 class components | react-to-print v3 useReactToPrint hook | 2023 | Cleaner hook-based API |

**Deprecated/outdated:**
- **react-well-plates npm:** Last updated 2+ years ago, use CSS Grid instead
- **tailwind.config.js screens.print:** v4 uses CSS-first @custom-variant instead

## Open Questions

Things that couldn't be fully resolved:

1. **Exact well layout for standards**
   - What we know: Standards occupy 24 wells per plate
   - What's unclear: Are they in columns 1-3 (A1-H3), or rows A-C (A1-A12, B1-B12, C1-C12)?
   - Recommendation: Assume columns 1-3 (standard curve layout), validate with domain expert

2. **Bead region data source**
   - What we know: Bead regions are platform-specific identifiers
   - What's unclear: Where does this data come from? Database? Hardcoded per platform?
   - Recommendation: Add beadRegions field to Platform type, or create separate analytes table

3. **Multi-plate layouts**
   - What we know: Calculator supports multiple plates
   - What's unclear: Should UI show all plates at once, or paginated/tabbed?
   - Recommendation: Show one plate at a time with plate selector, paginate in print

## Sources

### Primary (HIGH confidence)
- [react-to-print GitHub](https://github.com/MatthewHerbst/react-to-print) - Usage patterns, Electron integration, v3.2.0 API
- [Tailwind CSS v4 blog post](https://tailwindcss.com/blog/tailwindcss-v4) - @custom-variant syntax (verified via multiple sources)
- [Electron webContents docs](https://www.electronjs.org/docs/latest/api/web-contents) - print() and printToPDF() APIs

### Secondary (MEDIUM confidence)
- [Tailwind CSS print patterns](https://www.jacobparis.com/content/css-print-styles) - Print styling best practices
- [electron-react-to-print-demo](https://github.com/MatthewHerbst/electron-react-to-print-demo) - Electron integration example

### Tertiary (LOW confidence)
- Web search results for CSS Grid plate layout - No authoritative plate-specific source, but CSS Grid is well-documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-to-print is well-documented with active maintenance; Tailwind v4 print support verified
- Architecture: HIGH - follows existing codebase patterns (feature folders, Zustand, Tailwind)
- Pitfalls: HIGH - Electron print issues are well-documented in GitHub issues
- Plate layout: MEDIUM - CSS Grid is standard, but plate-specific layout (standard well positions) needs validation

**Research date:** 2026-01-26
**Valid until:** 60 days (stable domain, no rapidly changing dependencies)
