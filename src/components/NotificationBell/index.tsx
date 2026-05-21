import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import { MdNotifications, MdNotificationsOff, MdNotificationsNone } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { BellButton } from './NotificationBell.styles'

export default function NotificationBell() {
  const { t } = useTranslation()
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications()

  if (!isSupported) return null

  if (isLoading) {
    return <CircularProgress size={20} sx={{ color: 'var(--scheme-on-primary)', mx: 1 }} />
  }

  if (permission === 'denied') {
    return (
      <Tooltip title={t('notifications.permissionDenied')}>
        <span>
          <BellButton disabled>
            <MdNotificationsOff size={20} />
          </BellButton>
        </span>
      </Tooltip>
    )
  }

  if (isSubscribed) {
    return (
      <Tooltip title={t('notifications.disable')}>
        <BellButton onClick={unsubscribe} aria-label={t('notifications.disable')}>
          <MdNotifications size={20} />
        </BellButton>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={t('notifications.enable')}>
      <BellButton onClick={subscribe} aria-label={t('notifications.enable')}>
        <MdNotificationsNone size={20} />
      </BellButton>
    </Tooltip>
  )
}
