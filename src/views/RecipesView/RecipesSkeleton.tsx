import Skeleton from '@mui/material/Skeleton'
import { Wrapper } from './RecipesView.styles'
import { Grid } from './RecipeCardGrid/RecipeCardGrid.styles'

const SKELETON_COUNT = 8

function SkeletonCard() {
  return (
    <div>
      <Skeleton variant="rounded" height={140} />
      <Skeleton variant="text" width="90%" height={20} sx={{ mt: 1 }} />
      <Skeleton variant="text" width="60%" height={20} />
    </div>
  )
}

export default function RecipesSkeleton() {
  return (
    <Wrapper>
      <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
      <Grid>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </Grid>
    </Wrapper>
  )
}
