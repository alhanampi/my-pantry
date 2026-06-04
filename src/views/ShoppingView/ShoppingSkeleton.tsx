import Skeleton from '@mui/material/Skeleton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Box from '@mui/material/Box'
import { ItemsPaper, ItemsBox, Wrapper, TopBar } from './ShoppingView.styles'

// Mirrors ShoppingItem: checkbox + name/brand + stepper + icons
function SkeletonShoppingItem() {
  return (
    <ListItem
      disableGutters
      sx={{ px: 1, py: 0.75, borderBottom: '1px solid var(--scheme-border)', '&:last-child': { borderBottom: 'none' } }}
    >
      <Skeleton variant="circular" width={24} height={24} sx={{ flexShrink: 0, mr: 1 }} />
      <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
        <Skeleton variant="text" width="55%" height={20} />
        <Skeleton variant="text" width="35%" height={16} />
      </Box>
      <Skeleton variant="rounded" width={80} height={28} sx={{ flexShrink: 0, mr: 0.5 }} />
      <Skeleton variant="circular" width={28} height={28} sx={{ flexShrink: 0, mr: 0.5 }} />
      <Skeleton variant="circular" width={28} height={28} sx={{ flexShrink: 0, mr: 0.5 }} />
      <Skeleton variant="circular" width={28} height={28} sx={{ flexShrink: 0 }} />
    </ListItem>
  )
}

const SKELETON_COUNT = 5

export default function ShoppingSkeleton() {
  return (
    <Wrapper>
      <TopBar>
        <Skeleton variant="rounded" width={90} height={30} />
      </TopBar>
      <ItemsPaper elevation={0}>
        <ItemsBox>
          <List disablePadding>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <SkeletonShoppingItem key={i} />
            ))}
          </List>
        </ItemsBox>
      </ItemsPaper>
    </Wrapper>
  )
}
