import { CalculatorForm } from './CalculatorForm'
import { VolumeDisplay } from './VolumeDisplay'
import { SingleAnalyteManager } from './SingleAnalyteManager'

export function CalculatorPanel() {
  return (
    <div className="space-y-6">
      <CalculatorForm />
      <hr className="border-[var(--color-border)]" />
      <VolumeDisplay />
      <hr className="border-[var(--color-border)]" />
      <SingleAnalyteManager />
    </div>
  )
}
