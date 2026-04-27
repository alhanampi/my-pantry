import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const TableWrapper = styled.div`
  background: var(--scheme-surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
`

export const ScrollContainer = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  background: var(--scheme-surface-alt);
  border-bottom: 2px solid var(--scheme-accent-medium);
  min-width: 600px;
`

export const ActionsHeaderCell = styled.div`
  width: 72px;
  flex-shrink: 0;
`

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  gap: 12px;
  color: var(--scheme-text-muted);
`

export const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 16px;
  background: var(--scheme-surface-alt);
  border-bottom: 1px solid var(--scheme-accent-medium);
  min-height: 44px;
`

export const MobileActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 16px;
  background: var(--scheme-surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 8px;
  min-height: 44px;
`

export const EmptyHeading = styled(Typography).attrs({ variant: 'body1' as const })`
  && {
    font-weight: 500;
    color: var(--scheme-text-muted);
  }
`

export const EmptySubtext = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    color: var(--scheme-text-muted);
    text-align: center;
  }
`

export const CountText = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    color: var(--scheme-text-secondary);
  }
`
