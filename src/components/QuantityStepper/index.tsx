import IconButton from '@mui/material/IconButton'
import { MdAdd, MdRemove } from 'react-icons/md'
import { StepperWrapper, StepperValue } from './QuantityStepper.styles'
import type { QuantityStepperProps } from '../../utils/types'

export default function QuantityStepper({ value, onIncrement, onDecrement }: QuantityStepperProps) {
  const numValue = parseFloat(value) || 0

  return (
    <StepperWrapper>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onDecrement() }}
        disabled={numValue <= 0}
        sx={{ p: 0.25, color: '#2e7d32', '&:hover': { bgcolor: 'rgba(46,125,50,0.12)' } }}
        aria-label="decrease quantity"
      >
        <MdRemove size={14} />
      </IconButton>
      <StepperValue>{numValue}</StepperValue>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onIncrement() }}
        sx={{ p: 0.25, color: '#2e7d32', '&:hover': { bgcolor: 'rgba(46,125,50,0.12)' } }}
        aria-label="increase quantity"
      >
        <MdAdd size={14} />
      </IconButton>
    </StepperWrapper>
  )
}
