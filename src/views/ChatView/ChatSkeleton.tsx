import Skeleton from '@mui/material/Skeleton'
import { Wrapper } from './ChatView.styles'

export default function ChatSkeleton() {
  return (
    <Wrapper>
      <Skeleton variant="rounded" height={32} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={80} sx={{ mb: 1, alignSelf: 'flex-end', width: '60%', ml: 'auto' }} />
      <Skeleton variant="rounded" height={120} sx={{ mb: 1, width: '70%' }} />
      <Skeleton variant="rounded" height={48} />
    </Wrapper>
  )
}
