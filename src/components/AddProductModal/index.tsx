import { useState, useEffect, useRef } from 'react'
import DialogContentText from '@mui/material/DialogContentText'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Grid from '@mui/material/Grid'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import { MdClose, MdAddShoppingCart, MdStorefront } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { getProductSuggestions } from '../../data/productSuggestions'
import {
  StyledDialog,
  StyledDialogTitle,
  StyledDialogContent,
  StyledDialogActions,
  StyledCancelActions,
  SectionLabel,
  ModalTitleText,
} from './AddProductModal.styles'
import type { AddProductModalProps, ProductFormData, ProductSuggestion } from '../../utils/types'

const emptyForm: ProductFormData = {
  name: '',
  quantity: '',
  brand: '',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
}

export default function AddProductModal({
  open,
  context = 'pantry',
  initialData,
  onAccept,
  onCancel,
}: AddProductModalProps) {
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({})
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const isEditMode = Boolean(initialData)

  const suggestions = getProductSuggestions(i18n.language)

  useEffect(() => {
    if (!open) return
    setForm(initialData ?? emptyForm)
    setErrors({})
    const timer = setTimeout(() => nameInputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [open, initialData])

  const handleChange = (field: keyof ProductFormData, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = (): Partial<Record<keyof ProductFormData, string>> => {
    const newErrors: Partial<Record<keyof ProductFormData, string>> = {}
    if (!form.name.trim()) newErrors.name = t('modal.nameRequired')
    if (!form.quantity.toString().trim()) newErrors.quantity = t('modal.quantityRequired')
    else if (isNaN(Number(form.quantity)) || Number(form.quantity) <= 0)
      newErrors.quantity = t('modal.quantityInvalid')
    return newErrors
  }

  const handleAccept = (): void => {
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    onAccept({ ...form, name: form.name.trim() })
    setForm(emptyForm)
    setErrors({})
  }

  const handleCancelClick = (): void => {
    if (isEditMode) {
      handleConfirmCancel()
      return
    }
    const hasData = Object.values(form).some((v) => v !== '')
    if (hasData) {
      setCancelDialogOpen(true)
    } else {
      handleConfirmCancel()
    }
  }

  const handleConfirmCancel = (): void => {
    setCancelDialogOpen(false)
    setForm(emptyForm)
    setErrors({})
    onCancel()
  }

  const TitleIcon = context === 'shopping' ? MdAddShoppingCart : MdStorefront

  const titleKey = isEditMode
    ? context === 'shopping' ? 'modal.editShopping' : 'modal.editPantry'
    : context === 'shopping' ? 'modal.addShopping' : 'modal.addPantry'

  return (
    <>
      <StyledDialog open={open} onClose={handleCancelClick} maxWidth="sm" fullWidth>
        <StyledDialogTitle>
          <TitleIcon size={22} color="#2e7d32" />
          <ModalTitleText>
            {t(titleKey)}
          </ModalTitleText>
          <IconButton size="small" onClick={handleCancelClick} aria-label="close">
            <MdClose size={18} />
          </IconButton>
        </StyledDialogTitle>

        <Divider />

        <StyledDialogContent>
          <SectionLabel>{t('modal.requiredFields')}</SectionLabel>

          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={8}>
              <Autocomplete<ProductSuggestion, false, false, true>
                freeSolo
                options={suggestions}
                groupBy={(option) => option.category}
                getOptionLabel={(option) =>
                  typeof option === 'string' ? option : option.name
                }
                inputValue={form.name}
                onInputChange={(_, value) => handleChange('name', value)}
                onChange={(_, value) => {
                  if (value && typeof value !== 'string') handleChange('name', value.name)
                }}
                filterOptions={(options, { inputValue }) =>
                  options.filter((o) =>
                    o.name.toLowerCase().includes(inputValue.toLowerCase())
                  )
                }
                renderOption={(props, option) => (
                  <li {...props} key={`${option.name}-${option.category}`}>
                    {option.name}
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={nameInputRef}
                    label={t('modal.namePlaceholder')}
                    error={!!errors.name}
                    helperText={errors.name}
                    fullWidth
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label={t('modal.quantityPlaceholder')}
                type="number"
                inputProps={{ min: 0, step: 'any' }}
                value={form.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                error={!!errors.quantity}
                helperText={errors.quantity}
                fullWidth
              />
            </Grid>
          </Grid>

          <SectionLabel>{t('modal.optionalFields')}</SectionLabel>

          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('modal.brand')}
                value={form.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('modal.location')}
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('modal.purchaseDate')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.purchaseDate}
                onChange={(e) => handleChange('purchaseDate', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('modal.expiryDate')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.expiryDate}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('modal.details')}
                value={form.details}
                onChange={(e) => handleChange('details', e.target.value)}
                multiline
                rows={2}
                fullWidth
                placeholder={t('modal.detailsPlaceholder')}
              />
            </Grid>
          </Grid>
        </StyledDialogContent>

        <StyledDialogActions>
          <Button onClick={handleCancelClick} variant="outlined" color="inherit">
            {t('modal.cancel')}
          </Button>
          <Button onClick={handleAccept} variant="contained" disableElevation>
            {t('modal.save')}
          </Button>
        </StyledDialogActions>
      </StyledDialog>

      <StyledDialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="xs">
        <StyledDialogTitle>{t('modal.exitTitle')}</StyledDialogTitle>
        <StyledDialogContent>
          <DialogContentText>{t('modal.exitBody')}</DialogContentText>
        </StyledDialogContent>
        <StyledCancelActions>
          <Button onClick={() => setCancelDialogOpen(false)} variant="outlined" color="inherit">
            {t('modal.stay')}
          </Button>
          <Button onClick={handleConfirmCancel} variant="contained" color="error" disableElevation>
            {t('modal.exitConfirm')}
          </Button>
        </StyledCancelActions>
      </StyledDialog>
    </>
  )
}
