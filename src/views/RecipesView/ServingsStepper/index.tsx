import QuantityStepper from '../../../components/QuantityStepper'

export interface ServingsStepperProps {
  servings: number
  onChange: (servings: number) => void
  min?: number
}

// Reuses QuantityStepperProps' shape/styling (same +/- stepper used for
// pantry/shopping quantities) — servings just needs number <-> string glue
// and a floor so it never goes to 0 (a recipe scaled to 0 servings makes no
// sense, unlike a shopping-list quantity).
export default function ServingsStepper({ servings, onChange, min = 1 }: ServingsStepperProps) {
  return (
    <QuantityStepper
      value={String(servings)}
      onIncrement={() => onChange(servings + 1)}
      onDecrement={() => onChange(Math.max(min, servings - 1))}
    />
  )
}
