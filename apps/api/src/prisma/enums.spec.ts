import { $Enums } from '@prisma/client'
import * as shared from '@ssb/shared'

// Aturan: enum status didefinisikan di @ssb/shared dan dipakai di schema Prisma dengan nama yang sama.
describe('enum Prisma sama dengan @ssb/shared', () => {
  it.each([
    'Role',
    'ProductStatus',
    'Condition',
    'OrderStatus',
    'PaymentStatus',
    'ProofStatus',
    'Fulfillment',
  ] as const)('%s', (name) => {
    expect(Object.values($Enums[name]).sort()).toEqual(Object.values(shared[name]).sort())
  })
})
