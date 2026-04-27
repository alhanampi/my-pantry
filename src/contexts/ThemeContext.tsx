import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Theme } from '@mui/material/styles'
import { applySchemeVars, buildMuiTheme } from '../styles/colorSchemes'
import type { ColorScheme } from '../styles/colorSchemes'

interface ThemeContextValue {
  colorScheme: ColorScheme
  setColorScheme: (scheme: ColorScheme) => void
  muiTheme: Theme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'mi-despensa-color-scheme'

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ColorScheme | null
    const scheme: ColorScheme = saved ?? 'green'
    applySchemeVars(scheme)
    return scheme
  })

  const muiTheme = useMemo(() => buildMuiTheme(colorScheme), [colorScheme])

  useEffect(() => {
    applySchemeVars(colorScheme)
    localStorage.setItem(STORAGE_KEY, colorScheme)
  }, [colorScheme])

  const setColorScheme = (scheme: ColorScheme) => setColorSchemeState(scheme)

  return (
    <ThemeContext.Provider value={{ colorScheme, setColorScheme, muiTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useColorScheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useColorScheme must be used within ThemeContextProvider')
  return ctx
}
