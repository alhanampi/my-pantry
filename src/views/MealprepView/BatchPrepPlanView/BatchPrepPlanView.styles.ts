import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const Heading = styled(Typography).attrs({ variant: 'h6' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
  }
`

export const SectionTitle = styled(Typography).attrs({ variant: 'subtitle2' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
    margin-bottom: 6px;
  }
`

export const MenuList = styled.ul`
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const MenuItem = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
`

const menuImageSize = '32px'

export const MenuItemImage = styled.div<{ $src: string }>`
  flex-shrink: 0;
  width: ${menuImageSize};
  height: ${menuImageSize};
  border-radius: 6px;
  background-image: url('${(p) => p.$src}');
  background-size: cover;
  background-position: center;
  background-color: var(--scheme-bg);
`

export const MenuItemImagePlaceholder = styled.div`
  flex-shrink: 0;
  width: ${menuImageSize};
  height: ${menuImageSize};
  border-radius: 6px;
  background: var(--scheme-bg);
`

export const QuantitiesList = styled.ul`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const ComponentCard = styled.div`
  border: 1px solid var(--scheme-border);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  & + & {
    margin-top: 10px;
  }
`

export const ComponentName = styled.span`
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--scheme-text-primary);
`

export const ComponentDescription = styled.span`
  font-size: 0.8125rem;
  color: var(--scheme-text-muted);
`

export const ComponentSteps = styled.ul`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8125rem;
`

export const UsedInRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--scheme-text-muted);
`

export const UsedInChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--scheme-border);
  border-radius: 999px;
  padding: 2px 10px 2px 2px;
  background: var(--scheme-surface-alt);
  color: var(--scheme-text-primary);
`

export const UsedInChipImage = styled.div<{ $src: string }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-image: url('${(p) => p.$src}');
  background-size: cover;
  background-position: center;
`

export const StepList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const Step = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`

export const StepNumber = styled.span`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--scheme-primary);
  color: var(--scheme-primary-contrast);
  font-weight: 700;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
`

export const StepText = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    line-height: 1.6;
  }
`

export const NotesBox = styled.div`
  border: 1px solid var(--scheme-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--scheme-surface-alt);
`
