import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BatchPrepPlanView from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { BatchPrepPlan } from '../../../utils/types'

const basePlan: BatchPrepPlan = {
  menu: ['Empanadas de verdura', 'Tarta de choclo'],
  totalQuantities: [{ name: 'harina', amount: 1, unit: 'kg' }],
  sharedComponents: [
    {
      name: 'Masa básica',
      description: 'Una masa simple para tartas y empanadas.',
      ingredients: [{ name: 'harina', amount: 500, unit: 'g' }],
      steps: ['Mezclá la harina con agua y sal.'],
      usedInDishes: ['Empanadas de verdura', 'Tarta de choclo'],
    },
  ],
  cookingOrder: ['Precalentá el horno a 200°C.'],
  storageNotes: 'Guardá en heladera hasta 3 días.',
  estimatedTotalMinutes: 90,
}

describe('BatchPrepPlanView', () => {
  it('shows the shared component, its steps, and which dishes use it', () => {
    render(<BatchPrepPlanView plan={basePlan} titleToImage={{}} />)

    expect(screen.getByText('Masa básica')).toBeInTheDocument()
    expect(screen.getByText('Mezclá la harina con agua y sal.')).toBeInTheDocument()
    expect(screen.getAllByText('Empanadas de verdura').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tarta de choclo').length).toBeGreaterThan(0)
  })

  it('omits the shared components section when there are none', () => {
    render(<BatchPrepPlanView plan={{ ...basePlan, sharedComponents: [] }} titleToImage={{}} />)
    expect(screen.queryByText(i18n.t('mealprep.batchPrepPlan.sharedComponents'))).not.toBeInTheDocument()
  })

  it('shows a menu item photo when one is resolved for that title', () => {
    render(<BatchPrepPlanView plan={basePlan} titleToImage={{ 'Empanadas de verdura': 'empanadas.jpg' }} />)
    expect(document.documentElement.innerHTML).toContain('empanadas.jpg')
  })
})
