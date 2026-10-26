import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const MapWrapper = styled.div`
  height: 320px;
  width: 100%;
  margin-bottom: 12px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--scheme-border);
`

// Same visual language as StoreMarker in StoreMapDialog.styles.ts, but
// bigger + a distinct ring so the currently-selected store (synced with the
// list below) reads clearly among many markers at once.
export const SelectedStoreMarker = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--scheme-primary);
  border: 3px solid var(--scheme-accent-medium);
  box-shadow: 0 0 0 3px var(--scheme-surface), 0 2px 8px var(--scheme-shadow-md);
  cursor: pointer;
`

export const PopupContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px;
  min-width: 160px;
`

export const PopupHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const PopupName = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    font-weight: 600;
  }
`

export const PopupActionsRow = styled.div`
  margin-top: 4px;
`
