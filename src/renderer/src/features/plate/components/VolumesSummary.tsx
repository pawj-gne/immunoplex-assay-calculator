import { useCalculator } from '../../calculator/hooks/useCalculator'

/**
 * Summary of all calculated volumes for the prep sheet
 * Displays total wells, raw volume, and final volume in a clean table format
 */
export function VolumesSummary() {
  const { outputs, singlesWithVolumes } = useCalculator()

  if (!outputs) {
    return (
      <div className="text-gray-500 italic print:text-gray-600">
        No calculations available. Please enter sample count.
      </div>
    )
  }

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-lg font-semibold text-gray-800 print:text-base">
        Volume Calculations Summary
      </h2>

      {/* Main volumes table */}
      <table className="w-full border-collapse print:text-sm">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-2 pr-4 font-medium text-gray-600">Parameter</th>
            <th className="text-right py-2 pl-4 font-medium text-gray-600">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-2 pr-4 text-gray-700">Total Wells</td>
            <td className="py-2 pl-4 text-right font-mono">{outputs.totalWells}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-2 pr-4 text-gray-700">Unknown Sample Wells</td>
            <td className="py-2 pl-4 text-right font-mono">{outputs.unknownWells}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-2 pr-4 text-gray-700">Standard Wells</td>
            <td className="py-2 pl-4 text-right font-mono">{outputs.standardWells}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-2 pr-4 text-gray-700">Raw Volume (with dead volume)</td>
            <td className="py-2 pl-4 text-right font-mono">{outputs.rawVolumeUL} µL</td>
          </tr>
          <tr className="border-b border-gray-200 bg-blue-50 print:bg-gray-100">
            <td className="py-2 pr-4 text-gray-800 font-medium">Final Volume (rounded up)</td>
            <td className="py-2 pl-4 text-right font-mono font-semibold text-blue-700 print:text-gray-900">
              {outputs.finalVolumeML} mL
            </td>
          </tr>
        </tbody>
      </table>

      {/* Single analytes table (if present) */}
      {singlesWithVolumes && singlesWithVolumes.length > 0 && (
        <div className="mt-4 print:mt-3">
          <h3 className="text-md font-medium text-gray-700 mb-2 print:text-sm">
            Single Analyte Additions
          </h3>
          <table className="w-full border-collapse print:text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Analyte</th>
                <th className="text-right py-2 px-4 font-medium text-gray-600">Stock Conc.</th>
                <th className="text-right py-2 pl-4 font-medium text-gray-600">Addition Volume</th>
              </tr>
            </thead>
            <tbody>
              {singlesWithVolumes.map((single) => (
                <tr key={single.id} className="border-b border-gray-200">
                  <td className="py-2 pr-4 text-gray-700">{single.name}</td>
                  <td className="py-2 px-4 text-right font-mono">{single.stockConcentration}x</td>
                  <td className="py-2 pl-4 text-right font-mono font-medium">
                    {single.additionVolumeUL} µL
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
