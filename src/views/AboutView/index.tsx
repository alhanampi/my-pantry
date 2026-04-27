import Typography from '@mui/material/Typography'
import {
  MdStorefront,
  MdCalendarToday,
  MdLocationOn,
  MdInventory2,
  MdEventBusy,
  MdSearch,
  MdPhoneAndroid,
  MdShoppingCart,
  MdMap,
  MdTranslate,
  MdViewAgenda,
  MdPeopleOutline,
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import {
  Container,
  HeroCard,
  InfoCard,
  FeatureItem,
  HeroTitle,
  HeroSubtitle,
  VersionChip,
  SectionTitle,
  SectionTitleCompact,
  SectionDivider,
  FeatureLabel,
} from './AboutView.styles'
import type { Feature } from '../../utils/types'

export default function AboutView() {
  const { t } = useTranslation()

  const features: Feature[] = [
    {
      icon: <MdInventory2 size={24} color="var(--scheme-primary)" />,
      label: t('about.features.quantity'),
      desc: t('about.features.quantityDesc'),
    },
    {
      icon: <MdCalendarToday size={24} color="var(--scheme-primary)" />,
      label: t('about.features.purchaseDate'),
      desc: t('about.features.purchaseDateDesc'),
    },
    {
      icon: <MdLocationOn size={24} color="var(--scheme-primary)" />,
      label: t('about.features.location'),
      desc: t('about.features.locationDesc'),
    },
    {
      icon: <MdEventBusy size={24} color="var(--scheme-warning)" />,
      label: t('about.features.expiry'),
      desc: t('about.features.expiryDesc'),
    },
    {
      icon: <MdSearch size={24} color="var(--scheme-primary)" />,
      label: t('about.features.search'),
      desc: t('about.features.searchDesc'),
    },
    {
      icon: <MdShoppingCart size={24} color="var(--scheme-primary)" />,
      label: t('about.features.shoppingList'),
      desc: t('about.features.shoppingListDesc'),
    },
    {
      icon: <MdMap size={24} color="var(--scheme-primary)" />,
      label: t('about.features.nearbyStores'),
      desc: t('about.features.nearbyStoresDesc'),
    },
    {
      icon: <MdViewAgenda size={24} color="var(--scheme-primary)" />,
      label: t('about.features.mobile'),
      desc: t('about.features.mobileDesc'),
    },
    {
      icon: <MdTranslate size={24} color="var(--scheme-primary)" />,
      label: t('about.features.language'),
      desc: t('about.features.languageDesc'),
    },
    {
      icon: <MdPeopleOutline size={24} color="var(--scheme-primary)" />,
      label: t('about.features.sharing'),
      desc: t('about.features.sharingDesc'),
    },
    {
      icon: <MdPhoneAndroid size={24} color="var(--scheme-primary)" />,
      label: t('about.features.pwa'),
      desc: t('about.features.pwaDesc'),
    },
  ]

  return (
    <Container>
      <HeroCard elevation={0}>
        <MdStorefront size={52} color="var(--scheme-on-primary)" />
        <HeroTitle>{t('appName')}</HeroTitle>
        <HeroSubtitle>{t('about.subtitle')}</HeroSubtitle>
        <VersionChip
          label={t('about.version', { version: '1.0.0' })}
          size="small"
        />
      </HeroCard>

      <InfoCard elevation={1}>
        <SectionTitle>{t('about.featuresTitle')}</SectionTitle>
        <SectionDivider />
        {features.map((f, i) => (
          <FeatureItem key={i}>
            {f.icon}
            <div>
              <FeatureLabel>{f.label}</FeatureLabel>
              <Typography variant="caption" color="text.secondary">
                {f.desc}
              </Typography>
            </div>
          </FeatureItem>
        ))}
      </InfoCard>

      <InfoCard elevation={1}>
        <SectionTitleCompact>{t('about.privacyTitle')}</SectionTitleCompact>
        <Typography variant="body2" color="text.secondary">
          {t('about.privacyBody')}
        </Typography>
      </InfoCard>
    </Container>
  )
}
