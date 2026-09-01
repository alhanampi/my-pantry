import { useState } from 'react'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import {
  MdSearch,
  MdInfoOutline,
  MdOutlineStorefront,
  MdOutlineShoppingCart,
  MdOutlineRestaurantMenu,
  MdOutlineFavorite,
  MdOutlineLightbulb,
  MdClear,
  MdTranslate,
  MdPersonOutline,
  MdPersonAddAlt1,
  MdLogout,
  MdMenu,
  MdPeopleOutline,
} from 'react-icons/md'
import appIcon from '../../assets/icon.png'
import { useTranslation } from 'react-i18next'
import {
  StyledAppBar,
  TopRow,
  TitleGroup,
  SearchBox,
  SearchBoxMobile,
  StyledInputBase,
  DesktopActions,
  MobileHamburger,
  DesktopTabs,
  SearchIconWrapper,
  UserGreeting,
} from './Header.styles'
import ThemePicker from '../ThemePicker'
import UnitSystemToggle from '../UnitSystemToggle'
import NotificationBell from '../NotificationBell'
import { useUser, useClerk } from '@clerk/clerk-react'
import { useAuth } from '../../context/AuthContext'
import type { HeaderProps } from '../../utils/types'

export default function Header({
  searchQuery,
  onSearchChange,
  onAboutClick,
  currentView,
  onViewChange,
}: HeaderProps) {
  const { t, i18n } = useTranslation()
  const { user, isSignedIn } = useUser()
  const { openSignIn, signOut } = useClerk()
  const { partner, openLinkModal } = useAuth()
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const toggleLanguage = (): void => {
    void i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')
  }

  const tabOrder = ['pantry', 'recipes', 'favorites', 'chat', 'shopping'] as const
  const tabValue = tabOrder.includes(currentView as (typeof tabOrder)[number])
    ? tabOrder.indexOf(currentView as (typeof tabOrder)[number])
    : false

  const handleTabChange = (_: React.SyntheticEvent, newValue: number): void => {
    onViewChange(tabOrder[newValue] ?? 'pantry')
  }

  const displayName = user?.username ?? user?.firstName ?? t('auth.guest')

  const searchInput = (
    <>
      <SearchIconWrapper>
        <MdSearch size={18} color="var(--scheme-on-primary-muted)" />
      </SearchIconWrapper>
      <StyledInputBase
        placeholder={t('header.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        inputProps={{ 'aria-label': t('header.searchPlaceholder') }}
      />
      {searchQuery && (
        <IconButton
          size="small"
          onClick={() => onSearchChange('')}
          sx={{ color: 'var(--scheme-on-primary-muted)', p: 0.5 }}
        >
          <MdClear size={16} />
        </IconButton>
      )}
    </>
  )

  const mobileDrawer = (
    <Box sx={{ width: 272, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cierre */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 1 }}>
        <IconButton onClick={() => setDrawerOpen(false)} size="small">
          <MdClear size={20} />
        </IconButton>
      </Box>

      {/* Estado de auth */}
      <Box sx={{ px: 2.5, pt: 1, pb: 2 }}>
        {isSignedIn ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {t('auth.greeting', { name: displayName })}
            </Typography>
            {partner ? (
              <Chip
                icon={<MdPeopleOutline size={14} />}
                label={`@${partner.username}`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            ) : (
              <Typography variant="caption" color="text.disabled">
                {t('auth.noPartnerYet')}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('auth.notSignedIn')}
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Acciones de cuenta */}
      <List dense disablePadding>
        {isSignedIn ? (
          <>
            <ListItemButton
              onClick={() => {
                openLinkModal()
                setDrawerOpen(false)
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <MdPersonAddAlt1
                  size={20}
                  color={partner ? 'var(--scheme-accent-medium)' : undefined}
                />
              </ListItemIcon>
              <ListItemText
                primary={partner ? t('auth.manageLinkTab') : t('auth.linkTab')}
                primaryTypographyProps={{ fontSize: '0.9rem' }}
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => {
                setLogoutConfirm(true)
                setDrawerOpen(false)
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'error.main' }}>
                <MdLogout size={20} />
              </ListItemIcon>
              <ListItemText
                primary={t('auth.signOut')}
                primaryTypographyProps={{ fontSize: '0.9rem' }}
              />
            </ListItemButton>
          </>
        ) : (
          <ListItemButton
            onClick={() => {
              openSignIn()
              setDrawerOpen(false)
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <MdPersonOutline size={20} />
            </ListItemIcon>
            <ListItemText
              primary={t('auth.signIn')}
              primaryTypographyProps={{ fontSize: '0.9rem' }}
            />
          </ListItemButton>
        )}
      </List>

      <Divider />

      {/* Preferencias */}
      <List dense disablePadding>
        <ListItemButton onClick={toggleLanguage}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <MdTranslate size={20} />
          </ListItemIcon>
          <ListItemText
            primary={t('header.switchLanguage')}
            primaryTypographyProps={{ fontSize: '0.9rem' }}
          />
        </ListItemButton>

        <ListItem sx={{ py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 36 }} />
          <ThemePicker />
        </ListItem>

        <ListItem sx={{ py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 36 }} />
          <UnitSystemToggle variant="plain" />
        </ListItem>

        {isSignedIn && (
          <ListItem sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }} />
            <NotificationBell />
          </ListItem>
        )}

        <ListItemButton
          onClick={() => {
            onAboutClick()
            setDrawerOpen(false)
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <MdInfoOutline
              size={20}
              color={currentView === 'about' ? 'var(--scheme-accent-medium)' : undefined}
            />
          </ListItemIcon>
          <ListItemText
            primary={currentView === 'about' ? t('nav.pantry') : t('header.about')}
            primaryTypographyProps={{ fontSize: '0.9rem' }}
          />
        </ListItemButton>
      </List>
    </Box>
  )

  return (
    <StyledAppBar>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1, gap: 0 }}>
        <TopRow>
          <TitleGroup>
            <img src={appIcon} alt="" width={26} height={26} style={{ objectFit: 'contain' }} />
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: 700,
                letterSpacing: 0.5,
                fontSize: { xs: '0.95rem', sm: '1.15rem' },
              }}
            >
              {t('appName')}
            </Typography>
          </TitleGroup>

          <SearchBox>{searchInput}</SearchBox>

          {/* Acciones desktop */}
          <DesktopActions>
            {isSignedIn ? (
              <>
                <UserGreeting>{t('auth.greeting', { name: displayName })}</UserGreeting>
                <Tooltip
                  title={
                    partner
                      ? t('auth.linkedWith') + ' @' + partner.username
                      : t('auth.linkTab')
                  }
                >
                  <IconButton
                    onClick={openLinkModal}
                    size="small"
                    aria-label={t('auth.linkTab')}
                    sx={{ color: partner ? 'var(--scheme-accent-medium)' : 'var(--scheme-on-primary)' }}
                  >
                    <MdPersonAddAlt1 size={20} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('auth.signOut')}>
                  <IconButton
                    onClick={() => setLogoutConfirm(true)}
                    size="small"
                    aria-label={t('auth.signOut')}
                    sx={{ color: 'var(--scheme-on-primary)' }}
                  >
                    <MdLogout size={18} />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <UserGreeting>{t('auth.greeting', { name: t('auth.guest') })}</UserGreeting>
                <Tooltip title={t('auth.signIn')}>
                  <Button
                    onClick={() => openSignIn()}
                    size="small"
                    startIcon={<MdPersonOutline size={16} />}
                    sx={{
                      color: 'var(--scheme-on-primary)',
                      minWidth: 0,
                      px: 1,
                      py: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'var(--scheme-on-primary-hover)' },
                    }}
                  >
                    <Typography
                      component="span"
                      sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: 'inherit' }}
                    >
                      {t('auth.signIn')}
                    </Typography>
                  </Button>
                </Tooltip>
              </>
            )}

            <NotificationBell />

            <ThemePicker />

            <UnitSystemToggle />

            <Tooltip title={t('header.switchLanguage')}>
              <Button
                onClick={toggleLanguage}
                size="small"
                startIcon={<MdTranslate size={16} />}
                sx={{
                  color: 'var(--scheme-on-primary)',
                  minWidth: 0,
                  px: 1,
                  py: 0.5,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  '&:hover': { bgcolor: 'var(--scheme-on-primary-hover)' },
                }}
              >
                {i18n.language === 'es' ? 'ES' : 'EN'}
              </Button>
            </Tooltip>

            <Tooltip title={currentView === 'about' ? t('nav.pantry') : t('header.about')}>
              <IconButton
                onClick={onAboutClick}
                color="inherit"
                size="medium"
                aria-label={t('header.about')}
              >
                <MdInfoOutline
                  size={24}
                  color={currentView === 'about' ? 'var(--scheme-accent-medium)' : 'var(--scheme-on-primary)'}
                />
              </IconButton>
            </Tooltip>
          </DesktopActions>

          {/* Hamburguesa mobile */}
          <MobileHamburger>
            <IconButton
              onClick={() => setDrawerOpen(true)}
              size="medium"
              aria-label="Menú"
              sx={{ color: 'var(--scheme-on-primary)' }}
            >
              <MdMenu size={24} />
            </IconButton>
          </MobileHamburger>
        </TopRow>

        <SearchBoxMobile>{searchInput}</SearchBoxMobile>
      </Toolbar>

      <DesktopTabs>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: 'var(--scheme-accent-medium)', height: 3 } }}
          sx={{ minHeight: 40 }}
        >
          <Tab
            label={t('nav.pantry')}
            icon={<MdOutlineStorefront size={18} />}
            iconPosition="start"
            sx={{
              minHeight: 40,
              fontSize: '0.85rem',
              color: 'var(--scheme-on-primary-muted)',
              '&.Mui-selected': { color: 'var(--scheme-on-primary)' },
              py: 0,
            }}
          />
          <Tab
            label={t('nav.recipes')}
            icon={<MdOutlineRestaurantMenu size={18} />}
            iconPosition="start"
            sx={{
              minHeight: 40,
              fontSize: '0.85rem',
              color: 'var(--scheme-on-primary-muted)',
              '&.Mui-selected': { color: 'var(--scheme-on-primary)' },
              py: 0,
            }}
          />
          <Tab
            label={t('nav.favorites')}
            icon={<MdOutlineFavorite size={18} />}
            iconPosition="start"
            sx={{
              minHeight: 40,
              fontSize: '0.85rem',
              color: 'var(--scheme-on-primary-muted)',
              '&.Mui-selected': { color: 'var(--scheme-on-primary)' },
              py: 0,
            }}
          />
          <Tab
            label={t('nav.chat')}
            icon={<MdOutlineLightbulb size={18} />}
            iconPosition="start"
            sx={{
              minHeight: 40,
              fontSize: '0.85rem',
              color: 'var(--scheme-on-primary-muted)',
              '&.Mui-selected': { color: 'var(--scheme-on-primary)' },
              py: 0,
            }}
          />
          <Tab
            label={t('nav.shopping')}
            icon={<MdOutlineShoppingCart size={18} />}
            iconPosition="start"
            sx={{
              minHeight: 40,
              fontSize: '0.85rem',
              color: 'var(--scheme-on-primary-muted)',
              '&.Mui-selected': { color: 'var(--scheme-on-primary)' },
              py: 0,
            }}
          />
        </Tabs>
      </DesktopTabs>

      {/* Drawer mobile */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ display: { sm: 'none' } }}
      >
        {mobileDrawer}
      </Drawer>

      {/* Confirmación logout */}
      <Dialog open={logoutConfirm} onClose={() => setLogoutConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('auth.logoutConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('auth.logoutConfirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogoutConfirm(false)} variant="outlined" color="inherit">
            {t('modal.cancel')}
          </Button>
          <Button
            onClick={() => {
              void signOut()
              setLogoutConfirm(false)
            }}
            variant="contained"
            color="error"
            disableElevation
          >
            {t('auth.signOut')}
          </Button>
        </DialogActions>
      </Dialog>
    </StyledAppBar>
  )
}
