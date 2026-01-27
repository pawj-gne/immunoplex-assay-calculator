import { usePlatformStore } from '../../../stores/platformStore'

/**
 * Bead region list for instrument setup
 * Displays the bead regions configured for the selected platform
 * Currently a placeholder - bead region data will be added to Platform type in future
 */
export function BeadRegionList() {
  const { getSelectedPlatform } = usePlatformStore()
  const selectedPlatform = getSelectedPlatform()

  const platformName = selectedPlatform?.name ?? 'Unknown Platform'

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-lg font-semibold text-gray-800 print:text-base">
        {platformName} Bead Regions
      </h2>

      <p className="text-sm text-gray-600 print:text-xs">
        Configure plate reader with these bead regions before running the assay.
      </p>

      {/* Placeholder for future bead region data */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 print:bg-white print:border-gray-300">
        <div className="flex items-center gap-2 text-gray-500">
          <svg
            className="w-5 h-5 print:w-4 print:h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm print:text-xs">
            Bead region data not yet configured for this platform
          </span>
        </div>

        <div className="mt-3 text-xs text-gray-400 print:text-gray-500">
          Future: This section will display a table of analytes with their corresponding bead
          regions for instrument configuration.
        </div>
      </div>

      {/* Example of what the table will look like */}
      <div className="mt-4 print:mt-3">
        <h3 className="text-sm font-medium text-gray-600 mb-2 print:text-xs">
          Expected Format (Future)
        </h3>
        <table className="w-full border-collapse text-sm print:text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-gray-500">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Analyte</th>
              <th className="text-left py-2">Bead Region</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            <tr className="border-b border-gray-100">
              <td className="py-1 pr-4">1</td>
              <td className="py-1 pr-4 italic">Analyte Name</td>
              <td className="py-1 italic">Region ID</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
