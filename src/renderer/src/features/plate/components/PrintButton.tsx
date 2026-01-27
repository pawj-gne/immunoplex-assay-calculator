import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { PrepSheet } from './PrepSheet'

/**
 * Print button component for generating physical prep sheets.
 * Uses react-to-print to render PrepSheet content and trigger
 * the browser's native print dialog.
 */
export function PrintButton() {
  const contentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: 'Immunoplex Prep Sheet',
    onAfterPrint: () => {
      // Print completed - could add analytics or feedback here
    }
  })

  return (
    <>
      <button
        onClick={() => handlePrint()}
        className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-md font-medium hover:opacity-90 transition-opacity"
      >
        Print Prep Sheet
      </button>
      {/* Hidden printable content */}
      <div className="hidden print:block">
        <PrepSheet contentRef={contentRef} />
      </div>
    </>
  )
}
