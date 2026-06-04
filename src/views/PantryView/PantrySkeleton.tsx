import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import Box from '@mui/material/Box'

// Mirrors ProductRow: display:flex, min-width:600px, same cell flex/padding
export function SkeletonRow() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--scheme-border)',
        background: 'var(--scheme-surface)',
        minWidth: 600,
      }}
    >
      {/* NameCell: flex 3, minWidth 150px */}
      <Box sx={{ flex: 3, minWidth: '150px', px: 1, py: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Skeleton variant="text" sx={{ flex: 1 }} height={20} />
        <Skeleton variant="rounded" width={80} height={24} />
      </Box>
      {/* Brand: flex 2, minWidth 80px */}
      <Box sx={{ flex: 2, minWidth: '80px', px: 1, py: '10px' }}>
        <Skeleton variant="text" width="65%" height={20} />
      </Box>
      {/* PurchaseDate: flex 2, minWidth 95px */}
      <Box sx={{ flex: 2, minWidth: '95px', px: 1, py: '10px' }}>
        <Skeleton variant="text" width="80%" height={20} />
      </Box>
      {/* Location: flex 2, minWidth 100px */}
      <Box sx={{ flex: 2, minWidth: '100px', px: 1, py: '10px' }}>
        <Skeleton variant="text" width="55%" height={20} />
      </Box>
      {/* ExpiryDate: flex 2, minWidth 95px */}
      <Box sx={{ flex: 2, minWidth: '95px', px: 1, py: '10px' }}>
        <Skeleton variant="text" width="75%" height={20} />
      </Box>
      {/* ActionsCell: width 72px, 3 icons */}
      <Box sx={{ width: 72, flexShrink: 0, display: 'flex', justifyContent: 'center', gap: '2px', p: '4px' }}>
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="circular" width={24} height={24} />
      </Box>
    </Box>
  )
}

// Mirrors ProductCard: MUI Card with summary row
export function SkeletonCard() {
  return (
    <Card
      elevation={0}
      sx={{
        mb: 0.75,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        px: 2,
        py: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="text" width="55%" height={20} />
          <Skeleton variant="text" width="35%" height={16} />
        </Box>
        <Skeleton variant="text" width={70} height={16} />
        <Skeleton variant="rounded" width={80} height={28} />
        <Skeleton variant="circular" width={28} height={28} />
        <Skeleton variant="circular" width={28} height={28} />
      </Box>
    </Card>
  )
}
