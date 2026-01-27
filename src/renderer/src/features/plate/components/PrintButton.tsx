/**
 * Print button component for generating physical prep sheets.
 * Temporarily simplified to isolate rendering issues.
 */
export function PrintButton() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-md font-medium hover:opacity-90 transition-opacity"
    >
      Print Prep Sheet
    </button>
  )
}
