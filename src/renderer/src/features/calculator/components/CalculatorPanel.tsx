import { CalculatorForm } from './CalculatorForm'
import { ItemizedVolumeDisplay } from './ItemizedVolumeDisplay'
import { useCalculator } from '../hooks/useCalculator'

export function CalculatorPanel() {
  const { isValid, outputs, itemizedVolumes } = useCalculator()

  return (
    <div className="space-y-6">
      <CalculatorForm />
      <hr className="border-[var(--color-border)]" />

      {isValid && itemizedVolumes && outputs ? (
        <ItemizedVolumeDisplay
          itemizedVolumes={itemizedVolumes}
          totalWells={outputs.totalWells}
          unknownWells={outputs.unknownWells}
          standardWells={outputs.standardWells}
        />
      ) : (
        <div className="p-4 bg-gray-50 border border-[var(--color-border)] rounded-lg">
          <p className="text-sm text-[var(--color-muted)]">
            Enter valid inputs to see calculated volumes
          </p>
        </div>
      )}
    </div>
  )
}
