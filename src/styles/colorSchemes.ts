import { createTheme } from '@mui/material/styles'
import type { ThemeOptions } from '@mui/material/styles'

export type ColorScheme = 'green' | 'light' | 'dark' | 'pink' | 'celeste' | 'purple'

export interface SchemeConfig {
  labelEs: string
  labelEn: string
  swatch: string
  muiMode: 'light' | 'dark'
  muiPrimary: string
  vars: Record<string, string>
}

const baseThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 20px',
        },
      },
    },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 14 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
  },
}

export const schemes: Record<ColorScheme, SchemeConfig> = {
  green: {
    labelEs: 'Verde',
    labelEn: 'Green',
    swatch: '#2e7d32',
    muiMode: 'light',
    muiPrimary: '#2e7d32',
    vars: {
      '--scheme-bg': '#f1f8e9',
      '--scheme-surface': '#ffffff',
      '--scheme-surface-alt': '#f9fbe7',
      '--scheme-accent-light': '#e8f5e9',
      '--scheme-accent-medium': '#c8e6c9',
      '--scheme-primary': '#2e7d32',
      '--scheme-primary-dark': '#1b5e20',
      '--scheme-primary-light': '#388e3c',
      '--scheme-text-primary': '#212121',
      '--scheme-text-secondary': '#616161',
      '--scheme-text-muted': '#9e9e9e',
      '--scheme-border': '#f0f0f0',
    },
  },
  light: {
    labelEs: 'Claro',
    labelEn: 'Light',
    swatch: '#546e7a',
    muiMode: 'light',
    muiPrimary: '#546e7a',
    vars: {
      '--scheme-bg': '#f5f5f5',
      '--scheme-surface': '#ffffff',
      '--scheme-surface-alt': '#eeeeee',
      '--scheme-accent-light': '#eceff1',
      '--scheme-accent-medium': '#cfd8dc',
      '--scheme-primary': '#546e7a',
      '--scheme-primary-dark': '#263238',
      '--scheme-primary-light': '#78909c',
      '--scheme-text-primary': '#212121',
      '--scheme-text-secondary': '#616161',
      '--scheme-text-muted': '#9e9e9e',
      '--scheme-border': '#e0e0e0',
    },
  },
  dark: {
    labelEs: 'Oscuro',
    labelEn: 'Dark',
    swatch: '#1e1e1e',
    muiMode: 'dark',
    muiPrimary: '#90caf9',
    vars: {
      '--scheme-bg': '#121212',
      '--scheme-surface': '#1e1e1e',
      '--scheme-surface-alt': '#2a2a2a',
      '--scheme-accent-light': '#1e2a3a',
      '--scheme-accent-medium': '#37474f',
      '--scheme-primary': '#90caf9',
      '--scheme-primary-dark': '#42a5f5',
      '--scheme-primary-light': '#bbdefb',
      '--scheme-text-primary': '#e0e0e0',
      '--scheme-text-secondary': '#b0b0b0',
      '--scheme-text-muted': '#757575',
      '--scheme-border': '#333333',
    },
  },
  pink: {
    labelEs: 'Rosa',
    labelEn: 'Pink',
    swatch: '#c2185b',
    muiMode: 'light',
    muiPrimary: '#c2185b',
    vars: {
      '--scheme-bg': '#fce4ec',
      '--scheme-surface': '#ffffff',
      '--scheme-surface-alt': '#fff0f6',
      '--scheme-accent-light': '#fce4ec',
      '--scheme-accent-medium': '#f8bbd0',
      '--scheme-primary': '#c2185b',
      '--scheme-primary-dark': '#880e4f',
      '--scheme-primary-light': '#e91e63',
      '--scheme-text-primary': '#212121',
      '--scheme-text-secondary': '#616161',
      '--scheme-text-muted': '#9e9e9e',
      '--scheme-border': '#f0f0f0',
    },
  },
  celeste: {
    labelEs: 'Celeste',
    labelEn: 'Sky Blue',
    swatch: '#0288d1',
    muiMode: 'light',
    muiPrimary: '#0288d1',
    vars: {
      '--scheme-bg': '#e1f5fe',
      '--scheme-surface': '#ffffff',
      '--scheme-surface-alt': '#f0faff',
      '--scheme-accent-light': '#e1f5fe',
      '--scheme-accent-medium': '#b3e5fc',
      '--scheme-primary': '#0288d1',
      '--scheme-primary-dark': '#01579b',
      '--scheme-primary-light': '#29b6f6',
      '--scheme-text-primary': '#212121',
      '--scheme-text-secondary': '#616161',
      '--scheme-text-muted': '#9e9e9e',
      '--scheme-border': '#f0f0f0',
    },
  },
  purple: {
    labelEs: 'Púrpura',
    labelEn: 'Purple',
    swatch: '#7b1fa2',
    muiMode: 'light',
    muiPrimary: '#7b1fa2',
    vars: {
      '--scheme-bg': '#f3e5f5',
      '--scheme-surface': '#ffffff',
      '--scheme-surface-alt': '#faf0fc',
      '--scheme-accent-light': '#f3e5f5',
      '--scheme-accent-medium': '#e1bee7',
      '--scheme-primary': '#7b1fa2',
      '--scheme-primary-dark': '#4a148c',
      '--scheme-primary-light': '#9c27b0',
      '--scheme-text-primary': '#212121',
      '--scheme-text-secondary': '#616161',
      '--scheme-text-muted': '#9e9e9e',
      '--scheme-border': '#f0f0f0',
    },
  },
}

export function applySchemeVars(scheme: ColorScheme): void {
  const { vars } = schemes[scheme]
  const root = document.documentElement
  Object.entries(vars).forEach(([key, val]) => root.style.setProperty(key, val))
}

export function buildMuiTheme(scheme: ColorScheme) {
  const { muiMode, muiPrimary } = schemes[scheme]
  return createTheme({
    ...baseThemeOptions,
    palette: {
      mode: muiMode,
      primary: { main: muiPrimary },
      error: { main: '#c62828' },
      warning: { main: '#e65100' },
    },
  })
}
