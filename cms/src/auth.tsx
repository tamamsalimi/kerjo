import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { api, ApiError } from './api'
import type { Admin, Role } from './types'

interface AuthValue {
  admin: Admin | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  can: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth
      .me()
      .then(setAdmin)
      .catch((error) => {
        if (!(error instanceof ApiError && error.status === 401)) console.error(error)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      admin,
      loading,
      login: async (email, password) => setAdmin(await api.auth.login(email, password)),
      logout: async () => {
        await api.auth.logout()
        setAdmin(null)
      },
      can: (...roles) => Boolean(admin && roles.includes(admin.role)),
    }),
    [admin, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook and provider intentionally share the private context.
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
