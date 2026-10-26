import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  userLink: { findFirst: vi.fn() },
  mealPlan: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  favoriteMealPlan: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

const sampleEntry = {
  id: 'e1',
  dayOfWeek: 0,
  mealType: 'lunch',
  title: 'Milanesas',
  description: '',
  image: '',
  ingredients: [{ name: 'carne', amount: 1, unit: 'kg' }],
  steps: ['paso 1'],
  notes: '',
  prepTimeMinutes: 10,
  totalTimeMinutes: 30,
}

const sampleMealPlan = {
  id: 'plan_1',
  ownerId: 'user_1',
  weekStart: new Date('2026-10-26T00:00:00.000Z'),
  dietaryRestrictions: ['vegetariano'],
  servings: 2,
  includeBreakfast: false,
  batchPrepPlan: null,
  days: [sampleEntry],
}

const sampleFavorite = {
  id: 'fav_1',
  ownerId: 'user_1',
  name: 'Semana liviana',
  sourceMealPlanId: 'plan_1',
  dietaryRestrictions: ['vegetariano'],
  servings: 2,
  includeBreakfast: false,
  batchPrepPlan: null,
  days: [sampleEntry],
}

describe('favorite meal plans routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
  })

  it('GET /source-ids returns 401 without a token', async () => {
    const res = await request(app).get('/api/favorites/meal-plans/source-ids')
    expect(res.status).toBe(401)
  })

  it('GET /source-ids returns the caller-scoped source meal plan ids', async () => {
    mockPrisma.favoriteMealPlan.findMany.mockResolvedValue([{ sourceMealPlanId: 'plan_1' }])

    const res = await request(app)
      .get('/api/favorites/meal-plans/source-ids')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.sourceMealPlanIds).toEqual(['plan_1'])
    expect(mockPrisma.favoriteMealPlan.findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user_1', sourceMealPlanId: { not: null } },
      select: { sourceMealPlanId: true },
    })
  })

  it('GET / returns the caller-scoped favorite meal plans with their days', async () => {
    mockPrisma.favoriteMealPlan.findMany.mockResolvedValue([sampleFavorite])

    const res = await request(app).get('/api/favorites/meal-plans').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].name).toBe('Semana liviana')
  })

  it('POST / snapshots the caller-owned meal plan', async () => {
    mockPrisma.mealPlan.findFirst.mockResolvedValue(sampleMealPlan)
    mockPrisma.favoriteMealPlan.count.mockResolvedValue(1)
    mockPrisma.favoriteMealPlan.create.mockResolvedValue(sampleFavorite)

    const res = await request(app)
      .post('/api/favorites/meal-plans')
      .set('Authorization', 'Bearer good-token')
      .send({ mealPlanId: 'plan_1', name: 'Semana liviana' })

    expect(res.status).toBe(201)
    expect(mockPrisma.mealPlan.findFirst).toHaveBeenCalledWith({
      where: { id: 'plan_1', ownerId: 'user_1' },
      include: { days: true },
    })
    expect(mockPrisma.favoriteMealPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'user_1',
          name: 'Semana liviana',
          sourceMealPlanId: 'plan_1',
          servings: 2,
        }),
      }),
    )
  })

  it('POST / falls back to a default name when none is given', async () => {
    mockPrisma.mealPlan.findFirst.mockResolvedValue(sampleMealPlan)
    mockPrisma.favoriteMealPlan.count.mockResolvedValue(0)
    mockPrisma.favoriteMealPlan.create.mockResolvedValue(sampleFavorite)

    const res = await request(app)
      .post('/api/favorites/meal-plans')
      .set('Authorization', 'Bearer good-token')
      .send({ mealPlanId: 'plan_1' })

    expect(res.status).toBe(201)
    const data = mockPrisma.favoriteMealPlan.create.mock.calls[0][0].data
    expect(data.name).toContain('Semana del')
  })

  it('POST / returns 404 when the meal plan does not belong to the caller', async () => {
    mockPrisma.mealPlan.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/favorites/meal-plans')
      .set('Authorization', 'Bearer good-token')
      .send({ mealPlanId: 'not-mine' })

    expect(res.status).toBe(404)
    expect(mockPrisma.favoriteMealPlan.create).not.toHaveBeenCalled()
  })

  it('POST / returns 400 once MAX_FAVORITE_MEAL_PLANS_PER_USER is reached', async () => {
    mockPrisma.mealPlan.findFirst.mockResolvedValue(sampleMealPlan)
    mockPrisma.favoriteMealPlan.count.mockResolvedValue(15)

    const res = await request(app)
      .post('/api/favorites/meal-plans')
      .set('Authorization', 'Bearer good-token')
      .send({ mealPlanId: 'plan_1' })

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteMealPlan.create).not.toHaveBeenCalled()
  })

  it('DELETE /:id removes a favorite, scoped to the caller', async () => {
    const res = await request(app)
      .delete('/api/favorites/meal-plans/fav_1')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.favoriteMealPlan.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: 'user_1', id: 'fav_1' },
    })
  })

  it('POST /:id/restore creates a new live meal plan from the snapshot', async () => {
    mockPrisma.favoriteMealPlan.findFirst.mockResolvedValue(sampleFavorite)
    mockPrisma.mealPlan.count.mockResolvedValue(1)
    mockPrisma.mealPlan.create.mockResolvedValue(sampleMealPlan)

    const res = await request(app)
      .post('/api/favorites/meal-plans/fav_1/restore')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(201)
    expect(mockPrisma.favoriteMealPlan.findFirst).toHaveBeenCalledWith({
      where: { id: 'fav_1', ownerId: 'user_1' },
      include: { days: true },
    })
    expect(mockPrisma.mealPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'user_1', servings: 2, includeBreakfast: false }),
      }),
    )
  })

  it('POST /:id/restore returns 404 for a favorite that is not the caller\'s', async () => {
    mockPrisma.favoriteMealPlan.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/favorites/meal-plans/not-mine/restore')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(404)
    expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled()
  })

  it('POST /:id/restore returns 400 once MAX_MEAL_PLANS_PER_USER is reached', async () => {
    mockPrisma.favoriteMealPlan.findFirst.mockResolvedValue(sampleFavorite)
    mockPrisma.mealPlan.count.mockResolvedValue(10)

    const res = await request(app)
      .post('/api/favorites/meal-plans/fav_1/restore')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(400)
    expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled()
  })
})
