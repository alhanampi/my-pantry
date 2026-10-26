import { useState } from 'react'
import type { ReactNode, ComponentType } from 'react'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Collapse from '@mui/material/Collapse'
import { MdExpandMore, MdExpandLess } from 'react-icons/md'
import { SummaryRow, SectionIconWrap, SectionTitle, ContentWrap, StyledCardContent } from './FavoriteSection.styles'

export interface FavoriteSectionProps {
  title: string
  icon: ComponentType<{ size?: number }>
  count: number
  defaultExpanded?: boolean
  children: ReactNode
}

// One collapsible category card for the Favorites tab — a fixed icon next
// to the section name (per category, e.g. recipes vs. ingredients), a count
// chip, and a chevron. Same Collapse + useState pattern already used by
// ProductCard/ShoppingItem for their own expand/collapse — no MUI Accordion
// is introduced, this just generalizes that existing idiom to a top-level
// category instead of a single item.
export default function FavoriteSection({ title, icon: Icon, count, defaultExpanded = true, children }: FavoriteSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <Card
      elevation={0}
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <StyledCardContent>
        <SummaryRow onClick={() => setExpanded((v) => !v)}>
          <SectionIconWrap>
            <Icon size={20} />
          </SectionIconWrap>
          <SectionTitle>{title}</SectionTitle>
          <Chip label={count} size="small" />
          <IconButton size="small" aria-label="expand">
            {expanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
          </IconButton>
        </SummaryRow>

        <Collapse in={expanded}>
          <ContentWrap>{children}</ContentWrap>
        </Collapse>
      </StyledCardContent>
    </Card>
  )
}
