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
import {
  MdSearch,
  MdInfoOutline,
  MdStorefront,
  MdShoppingCart,
  MdClear,
  MdTranslate,
  MdPersonOutline,
  MdPersonAddAlt1,
  MdLogout,
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
  ActionsGroup,
  DesktopTabs,
  SearchIconWrapper,
  UserGreeting,
} from './Header.styles'
import ThemePicker from '../ThemePicker'
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
  const { user, logout, openAuthModal } = useAuth()
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  const toggleLanguage = (): void => {
    void i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')
  }

  const tabValue = currentView === 'pantry' ? 0 : currentView === 'shopping' ? 1 : false

  const handleTabChange = (_: React.SyntheticEvent, newValue: number): void => {
    onViewChange(newValue === 0 ? 'pantry' : 'shopping')
  }

  const searchInput = (
    <>
      <SearchIconWrapper>
        <MdSearch size={18} color="rgba(255,255,255,0.7)" />
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
          sx={{ color: 'rgba(255,255,255,0.7)', p: 0.5 }}
        >
          <MdClear size={16} />
        </IconButton>
      )}
    </>
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

          <ActionsGroup>
            {user ? (
              <>
                <UserGreeting>{t('auth.greeting', { name: user.username })}</UserGreeting>
                <Tooltip
                  title={
                    user.partner
                      ? t('auth.linkedWith') + ' @' + user.partner.username
                      : t('auth.linkTab')
                  }
                >
                  <IconButton
                    onClick={() => openAuthModal('link')}
                    size="small"
                    aria-label={t('auth.linkTab')}
                    sx={{ color: user.partner ? '#a5d6a7' : 'rgba(255,255,255,0.8)' }}
                  >
                    <MdPersonAddAlt1 size={20} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('auth.signOut')}>
                  <IconButton
                    onClick={() => setLogoutConfirm(true)}
                    size="small"
                    aria-label={t('auth.signOut')}
                    sx={{ color: 'rgba(255,255,255,0.8)' }}
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
                    onClick={() => openAuthModal('login')}
                    size="small"
                    startIcon={<MdPersonOutline size={16} />}
                    sx={{
                      color: 'rgba(255,255,255,0.85)',
                      minWidth: 0,
                      px: 1,
                      py: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
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

            <ThemePicker />

            <Tooltip title={i18n.language === 'es' ? 'Switch to English' : 'Switch to Spanish'}>
              <Button
                onClick={toggleLanguage}
                size="small"
                startIcon={<MdTranslate size={16} />}
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  minWidth: 0,
                  px: 1,
                  py: 0.5,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                }}
              >
                {i18n.language === 'es' ? 'EN' : 'ES'}
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
                  color={currentView === 'about' ? '#a5d6a7' : 'rgba(255,255,255,0.8)'}
                />
              </IconButton>
            </Tooltip>
          </ActionsGroup>
        </TopRow>

        <SearchBoxMobile>{searchInput}</SearchBoxMobile>
      </Toolbar>

      <DesktopTabs>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: '#a5d6a7', height: 3 } }}
          sx={{ minHeight: 40 }}
        >
          <Tab
            label={t('nav.pantry')}
            icon={<MdStorefront size={18} />}
            iconPosition="start"
            sx={{
              minHeight: 40,
              fontSize: '0.85rem',
              color: 'rgba(255,255,255,0.75)',
              '&.Mui-selected': { color: 'white' },
              py: 0,
            }}
          />
          <Tab
            label={t('nav.shopping')}
            icon={<MdShoppingCart size={18} />}
            iconPosition="start"
            sx={{
              minHeight: 40,
              fontSize: '0.85rem',
              color: 'rgba(255,255,255,0.75)',
              '&.Mui-selected': { color: 'white' },
              py: 0,
            }}
          />
        </Tabs>
      </DesktopTabs>

      <Dialog
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{t('auth.logoutConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('auth.logoutConfirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogoutConfirm(false)} variant="outlined" color="inherit">
            {t('modal.cancel')}
          </Button>
          <Button
            onClick={() => { logout(); setLogoutConfirm(false) }}
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
