import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const prisma = new PrismaClient()

const USER_ID = 'user_3DKUbCSCkR5GWGWclydqAKBZj4p'

const today = new Date()
const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000)
const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000)

const products = [
  // Expiring very soon — should trigger notifications
  { name: 'Yogur natural', quantity: '2', brand: 'Danone', expiryDate: daysFromNow(2), location: 'Nevera', details: '' },
  { name: 'Leche entera', quantity: '1', brand: 'Hacendado', expiryDate: daysFromNow(4), location: 'Nevera', details: '' },
  { name: 'Queso fresco', quantity: '1', brand: 'President', expiryDate: daysFromNow(6), location: 'Nevera', details: '' },

  // Expiring in a couple of weeks
  { name: 'Jamón cocido', quantity: '1', brand: 'Campofrío', expiryDate: daysFromNow(12), location: 'Nevera', details: 'Loncheado' },
  { name: 'Huevos', quantity: '12', brand: '', expiryDate: daysFromNow(18), location: 'Nevera', details: 'Talla M' },
  { name: 'Mantequilla', quantity: '1', brand: 'Kerrygold', expiryDate: daysFromNow(22), location: 'Nevera', details: '' },

  // Longer shelf life
  { name: 'Pasta', quantity: '3', brand: 'Barilla', expiryDate: daysFromNow(180), location: 'Despensa', details: 'Espaguetis' },
  { name: 'Arroz', quantity: '2', brand: 'La Fallera', expiryDate: daysFromNow(365), location: 'Despensa', details: 'Redondo' },
  { name: 'Lentejas', quantity: '1', brand: 'Mercadona', expiryDate: daysFromNow(400), location: 'Despensa', details: '' },
  { name: 'Garbanzos cocidos', quantity: '3', brand: 'Cidacos', expiryDate: daysFromNow(300), location: 'Despensa', details: 'Bote cristal' },
  { name: 'Tomate frito', quantity: '4', brand: 'Heinz', expiryDate: daysFromNow(500), location: 'Despensa', details: '' },
  { name: 'Atún en lata', quantity: '6', brand: 'Calvo', expiryDate: daysFromNow(730), location: 'Despensa', details: 'En aceite de oliva' },
  { name: 'Aceite de oliva virgen extra', quantity: '1', brand: 'Carbonell', expiryDate: daysFromNow(540), location: 'Despensa', details: '1L' },
  { name: 'Sal', quantity: '1', brand: '', expiryDate: null, location: 'Despensa', details: '' },
  { name: 'Azúcar', quantity: '1', brand: 'Azucarera', expiryDate: daysFromNow(900), location: 'Despensa', details: '' },
  { name: 'Harina de trigo', quantity: '1', brand: 'El Molino', expiryDate: daysFromNow(200), location: 'Despensa', details: '' },

  // Frozen
  { name: 'Guisantes congelados', quantity: '2', brand: 'Findus', expiryDate: daysFromNow(300), location: 'Congelador', details: '' },
  { name: 'Croquetas', quantity: '1', brand: 'La Cocinera', expiryDate: daysFromNow(180), location: 'Congelador', details: 'Jamón' },

  // Recently purchased
  { name: 'Pan de molde', quantity: '1', brand: 'Bimbo', purchaseDate: daysAgo(1).toISOString().slice(0, 10), expiryDate: daysFromNow(10), location: 'Despensa', details: '' },
  { name: 'Cerveza', quantity: '12', brand: 'Estrella Damm', purchaseDate: daysAgo(2).toISOString().slice(0, 10), expiryDate: daysFromNow(90), location: 'Despensa', details: 'Lata 33cl' },
]

async function main() {
  console.log('Upserting user...')
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      username: 'alhanampi',
      email: 'alhanampi@gmail.com',
    },
    update: {},
  })

  console.log(`Seeding ${products.length} products...`)
  for (const p of products) {
    await prisma.product.create({
      data: {
        name: p.name,
        quantity: p.quantity ?? '1',
        brand: p.brand ?? '',
        purchaseDate: (p as { purchaseDate?: string }).purchaseDate ?? '',
        expiryDate: p.expiryDate ?? null,
        location: p.location ?? '',
        details: p.details ?? '',
        ownerId: USER_ID,
      },
    })
  }

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
