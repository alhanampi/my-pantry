import styled from 'styled-components'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'

export const Container = styled.div`
  max-width: 560px;
  margin: 0 auto;
`

export const HeroCard = styled(Paper)`
  && {
    padding: 28px 24px 20px;
    border-radius: 14px;
    text-align: center;
    background: linear-gradient(135deg, var(--scheme-primary) 0%, var(--scheme-primary-light) 100%);
    color: var(--scheme-on-primary);
    margin-bottom: 16px;
  }
`

export const InfoCard = styled(Paper)`
  && {
    padding: 20px;
    border-radius: 14px;
    margin-bottom: 12px;
  }
`

export const FeatureItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
`

export const HeroTitle = styled(Typography).attrs({ variant: 'h5' as const })`
  && {
    font-weight: 700;
    margin-bottom: 4px;
    margin-top: 8px;
  }
`

export const HeroSubtitle = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    opacity: 0.85;
    max-width: 320px;
    margin: 0 auto;
  }
`

export const VersionChip = styled(Chip)`
  && {
    margin-top: 16px;
    background-color: var(--scheme-on-primary-overlay);
    color: var(--scheme-on-primary);
    font-weight: 600;
  }
`

export const SectionTitle = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary);
    margin-bottom: 8px;
  }
`

export const SectionTitleCompact = styled(SectionTitle)`
  && {
    margin-bottom: 4px;
  }
`

export const SectionDivider = styled(Divider)`
  && {
    margin-bottom: 8px;
  }
`

export const FeatureLabel = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    font-weight: 600;
  }
`
