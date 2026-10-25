import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import {
  Wrapper,
  Heading,
  SectionTitle,
  MenuList,
  MenuItem,
  MenuItemImage,
  MenuItemImagePlaceholder,
  QuantitiesList,
  ComponentCard,
  ComponentName,
  ComponentDescription,
  ComponentSteps,
  UsedInRow,
  UsedInChip,
  UsedInChipImage,
  StepList,
  Step,
  StepNumber,
  StepText,
  NotesBox,
} from './BatchPrepPlanView.styles'
import type { BatchPrepPlan } from '../../../utils/types'

export interface BatchPrepPlanViewProps {
  plan: BatchPrepPlan
  // Maps each dish title in the week's plan to its resolved photo (may be
  // empty per title — mealPlanAi.ts's image lookup is best-effort), so the
  // menu list and each shared component's "used in" chips can show a
  // relevant photo instead of just text.
  titleToImage: Record<string, string>
}

// A single batch-cooking session covering (some or all of) the week —
// menu, combined shopping quantities, the base preparations shared across
// dishes (what makes this an actual MEAL-PREP plan, not just unrelated
// recipes), an ordered cooking sequence, and how to store/reheat the rest
// of the week. See mealPlanAi.ts for how the AI builds this.
export default function BatchPrepPlanView({ plan, titleToImage }: BatchPrepPlanViewProps) {
  const { t } = useTranslation()

  return (
    <Wrapper>
      <Heading>{t('mealprep.batchPrepPlan.title')}</Heading>
      <Typography variant="body2" color="text.secondary">
        {t('mealprep.batchPrepPlan.estimatedTime', { count: plan.estimatedTotalMinutes })}
      </Typography>

      {plan.menu.length > 0 && (
        <div>
          <SectionTitle>{t('mealprep.batchPrepPlan.menu')}</SectionTitle>
          <MenuList>
            {plan.menu.map((item, i) => (
              <MenuItem key={i}>
                {titleToImage[item] ? (
                  <MenuItemImage $src={titleToImage[item]} />
                ) : (
                  <MenuItemImagePlaceholder />
                )}
                {item}
              </MenuItem>
            ))}
          </MenuList>
        </div>
      )}

      {plan.totalQuantities.length > 0 && (
        <div>
          <SectionTitle>{t('mealprep.batchPrepPlan.quantities')}</SectionTitle>
          <QuantitiesList>
            {plan.totalQuantities.map((ing, i) => (
              <li key={i}>
                {ing.amount} {ing.unit} {ing.name}
              </li>
            ))}
          </QuantitiesList>
        </div>
      )}

      {plan.sharedComponents.length > 0 && (
        <div>
          <SectionTitle>{t('mealprep.batchPrepPlan.sharedComponents')}</SectionTitle>
          {plan.sharedComponents.map((component, i) => (
            <ComponentCard key={i}>
              <ComponentName>{component.name}</ComponentName>
              {component.description && <ComponentDescription>{component.description}</ComponentDescription>}
              {component.steps.length > 0 && (
                <ComponentSteps>
                  {component.steps.map((step, j) => (
                    <li key={j}>{step}</li>
                  ))}
                </ComponentSteps>
              )}
              {component.usedInDishes.length > 0 && (
                <UsedInRow>
                  <span>{t('mealprep.batchPrepPlan.usedIn')}</span>
                  {component.usedInDishes.map((dish) => (
                    <UsedInChip key={dish}>
                      {titleToImage[dish] && <UsedInChipImage $src={titleToImage[dish]} />}
                      {dish}
                    </UsedInChip>
                  ))}
                </UsedInRow>
              )}
            </ComponentCard>
          ))}
        </div>
      )}

      {plan.cookingOrder.length > 0 && (
        <div>
          <SectionTitle>{t('mealprep.batchPrepPlan.cookingOrder')}</SectionTitle>
          <StepList>
            {plan.cookingOrder.map((step, i) => (
              <Step key={i}>
                <StepNumber>{i + 1}</StepNumber>
                <StepText>{step}</StepText>
              </Step>
            ))}
          </StepList>
        </div>
      )}

      {plan.storageNotes && (
        <NotesBox>
          <SectionTitle>{t('mealprep.batchPrepPlan.storageNotes')}</SectionTitle>
          <Typography variant="body2" color="text.secondary">
            {plan.storageNotes}
          </Typography>
        </NotesBox>
      )}
    </Wrapper>
  )
}
