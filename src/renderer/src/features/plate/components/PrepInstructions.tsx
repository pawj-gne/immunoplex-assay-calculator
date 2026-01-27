import { useCalculator } from '../../calculator/hooks/useCalculator'
import { volumeToDisplay } from '../../../lib/decimal'

interface InstructionStep {
  id: number
  text: string
  highlight?: boolean
  conditional?: boolean
}

/**
 * Step-by-step reagent preparation instructions
 * Guides operators through the preparation process with numbered steps
 * Volumes are pulled from calculator state
 */
export function PrepInstructions() {
  const { outputs, itemizedVolumes, requestType } = useCalculator()

  if (!outputs) {
    return (
      <div className="text-gray-500 italic print:text-gray-600">
        No calculations available. Please enter sample count.
      </div>
    )
  }

  const finalVolumeML = outputs.finalVolumeML

  // Get single additions from itemized volumes
  const singleBeadAdditions = itemizedVolumes
    ? itemizedVolumes.captureBeads.filter((line) => !line.isPremix && line.beadRegion !== undefined)
    : []

  // Build instruction steps based on request type and singles
  const steps: InstructionStep[] = []
  let stepNum = 1

  // Step 1: Always vortex beads first
  steps.push({
    id: stepNum++,
    text: 'Vortex Capture Bead Solution for 1 minute to fully resuspend beads. Ensure no pellet remains at the bottom of the tube.',
    highlight: true
  })

  // Step 2: Assay buffer for dilutions (if custom/singles)
  if (requestType === 'custom' || requestType === 'premix_singles') {
    steps.push({
      id: stepNum++,
      text: `Add ${finalVolumeML} mL Assay Buffer to the reagent reservoir. This will be used for dilutions.`,
      conditional: true
    })
  }

  // Step 3: Add capture bead solution
  steps.push({
    id: stepNum++,
    text: `Add ${finalVolumeML} mL Capture Bead Solution to the reagent reservoir. Mix gently to combine.`
  })

  // Step 4: Add single analytes if present
  if (singleBeadAdditions.length > 0) {
    steps.push({
      id: stepNum++,
      text: 'Add single analyte beads to the master mix:',
      highlight: true
    })

    singleBeadAdditions.forEach((line) => {
      steps.push({
        id: stepNum++,
        text: `Add ${volumeToDisplay(line.volumeUL, 'uL', 1)} µL of ${line.name} beads (${line.stockConc}x stock, Region ${line.beadRegion})`
      })
    })
  }

  // Step 5: Mix after additions
  steps.push({
    id: stepNum++,
    text: 'Vortex the master mix gently for 30 seconds to thoroughly combine all reagents. Avoid creating bubbles.'
  })

  // Step 6: Load plate
  steps.push({
    id: stepNum++,
    text: 'Load the 96-well plate according to the plate layout diagram. Use a multichannel pipette for efficiency.'
  })

  // Step 7: Detection antibody preparation
  steps.push({
    id: stepNum++,
    text: `Prepare ${finalVolumeML} mL Biotinylated Detection Antibody in a separate reservoir. Keep on ice until ready to use.`
  })

  // Step 8: SA-PE preparation
  steps.push({
    id: stepNum++,
    text: `Prepare ${finalVolumeML} mL SA-PE (Streptavidin-PE) in a separate reservoir. Protect from light.`,
    highlight: true
  })

  // Final notes
  steps.push({
    id: stepNum++,
    text: 'Follow standard incubation and wash protocols as specified in the assay kit instructions.'
  })

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-lg font-semibold text-gray-800 print:text-base">
        Preparation Instructions
      </h2>

      <div className="text-sm text-gray-600 mb-4 print:text-xs print:mb-3">
        Follow these steps in order. Ensure all reagents are at room temperature before starting
        (unless otherwise noted).
      </div>

      <ol className="space-y-3 print:space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3 print:gap-2">
            <span
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium print:w-6 print:h-6 print:text-xs ${
                step.highlight
                  ? 'bg-blue-100 text-blue-700 print:bg-gray-200 print:text-gray-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {step.id}
            </span>
            <span
              className={`text-gray-700 pt-1 print:text-sm ${step.conditional ? 'italic' : ''}`}
            >
              {step.text}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg print:bg-white print:border-gray-300 print:mt-4">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5 print:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-sm text-yellow-800 print:text-gray-700">
            <strong>Important:</strong> Work quickly once reagents are prepared. Keep SA-PE protected
            from light at all times. Discard unused reagents according to lab protocols.
          </div>
        </div>
      </div>
    </div>
  )
}
