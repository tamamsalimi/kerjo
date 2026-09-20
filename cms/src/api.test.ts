import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('API client', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses a relative API URL and cookie credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: '1', name: 'Admin', email: 'a@b.co', role: 'superadmin' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await api.auth.me()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('sends mandatory moderation reasons', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'job-1', hidden: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await api.jobs.hide('job-1', 'Fraudulent listing')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/jobs/job-1/hide',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Fraudulent listing' }),
      }),
    )
  })

  it('adapts backend pagination and snake-case user fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        items: [{
          user_id: 'user-1',
          email: 'user@kerjo.id',
          name: 'Kerjo User',
          verification_status: 'approved',
          suspended_at: null,
          created_at: '2026-09-20T00:00:00Z',
        }],
        page: { limit: 20, offset: 20, total: 42 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await api.users.list({ search: 'Kerjo', page: 2, pageSize: 20 })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users?q=Kerjo&limit=20&offset=20',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 42 })
    expect(result.items[0]).toMatchObject({
      id: 'user-1',
      status: 'active',
      verificationStatus: 'approved',
    })
  })

  it('uses the audited history-cleanup endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await api.maintenance.execute('user-1', 'Requested by account owner', 'DELETE USER user-1 HISTORY')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/maintenance/history/execute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-1',
          reason: 'Requested by account owner',
          confirmation: 'DELETE USER user-1 HISTORY',
        }),
      }),
    )
  })
})
