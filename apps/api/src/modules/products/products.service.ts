import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, type Product } from '@prisma/client'
import {
  assertTransition,
  PRODUCT_TRANSITIONS,
  type Paginated,
  type PanelProductDetailDto,
  type PanelProductDto,
  type ProductCardDto,
  type ProductDetailDto,
  type ProductSort,
  type ProductStatus,
  type RecentlySoldDto,
} from '@ssb/shared'
import { PrismaService } from '../../prisma/prisma.service.js'
import { ActivityAction, ActivityLogService } from '../activity-log/activity-log.service.js'
import { StorageService } from '../files/storage.service.js'
import type { ProductListQueryDto } from './products.dto.js'
import type {
  CreateProductDto,
  PanelProductListQueryDto,
  ReorderPhotosDto,
  UpdateProductDto,
} from './products.panel.dto.js'

const DAY_MS = 24 * 60 * 60 * 1000
/** [KONFIRMASI] no. 8 di docs/business-rules.md: badge "Baru masuk" */
export const NEW_PRODUCT_DAYS = 7
/** [KONFIRMASI] no. 4: blok "Baru terjual" di beranda */
export const RECENTLY_SOLD = { limit: 8, days: 30 }
export const PHOTO_LIMITS = { min: 3, max: 6 }
const SIMILAR_LIMIT = 4
const DEFAULT_LIMIT = 12
/** Harga dan status hanya boleh diubah selama sepatu belum ikut pesanan (business-rules: Status sepatu). */
const EDITABLE_STATUSES = ['AVAILABLE', 'INACTIVE'] as const

export const CARD_INCLUDE = {
  brand: { select: { name: true } },
  // foto utama dulu, sisanya sesuai urutan
  photos: {
    select: { url: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductInclude
type CardRow = Prisma.ProductGetPayload<{ include: typeof CARD_INCLUDE }>

/** Bentuk kartu sepatu yang sama di katalog, keranjang, dan pesanan (query wajib pakai CARD_INCLUDE). */
export function toProductCard(p: CardRow): ProductCardDto {
  return {
    code: p.code,
    brand: p.brand.name,
    model: p.model,
    sizeEu: Number(p.sizeEu),
    condition: p.condition,
    price: p.price,
    status: p.status,
    primaryPhotoUrl: p.photos[0]?.url ?? null,
    isNew: Date.now() - p.createdAt.getTime() <= NEW_PRODUCT_DAYS * DAY_MS,
  }
}

const DETAIL_INCLUDE = {
  brand: { select: { name: true } },
  category: { select: { id: true, name: true, slug: true } },
  photos: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude
type DetailRow = Prisma.ProductGetPayload<{ include: typeof DETAIL_INCLUDE }>

const notFound = () =>
  new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Sepatu tidak ditemukan.' })
const locked = (what: string) =>
  new ConflictException({
    code: 'PRODUCT_LOCKED',
    message: `Sepatu yang sedang dipesan atau sudah terjual tidak bisa diubah ${what}nya.`,
  })
const photoCount = (message: string) => new BadRequestException({ code: 'PHOTO_COUNT', message })

const orderByFor = (sort?: ProductSort): Prisma.ProductOrderByWithRelationInput[] =>
  sort === 'price_asc'
    ? [{ price: 'asc' }, { id: 'asc' }]
    : sort === 'price_desc'
      ? [{ price: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }]

/** Kode SSB dari id (autoincrement): urut, unik, dan tidak pernah dipakai ulang tanpa perlu kunci. */
export const productCode = (id: number) => `SSB-${String(id).padStart(4, '0')}`

// Field yang dicatat di log saat edit; Decimal dibandingkan sebagai angka
const TRACKED_FIELDS = [
  'brandId',
  'categoryId',
  'model',
  'sizeEu',
  'sizeUk',
  'sizeUs',
  'insoleCm',
  'condition',
  'defects',
  'hasBox',
  'hasOriginalInsole',
  'hasOriginalLaces',
  'price',
  'description',
] as const
const plain = (v: unknown) => (v instanceof Prisma.Decimal ? v.toNumber() : (v ?? null))

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly storage: StorageService,
  ) {}

  // ---------- Publik ----------

  /** Katalog publik: hanya AVAILABLE + RESERVED (SOLD hanya di "Baru terjual", INACTIVE tidak pernah). */
  async listPublic(query: ProductListQueryDto): Promise<Paginated<ProductCardDto>> {
    const where: Prisma.ProductWhereInput = {
      status: { in: query.hideReserved ? ['AVAILABLE'] : ['AVAILABLE', 'RESERVED'] },
      ...(query.brand?.length && {
        brand: { name: { in: query.brand, mode: 'insensitive' } },
      }),
      ...(query.category?.length && { category: { slug: { in: query.category } } }),
      ...(query.size?.length && { sizeEu: { in: query.size } }),
      ...(query.condition?.length && { condition: { in: query.condition } }),
      ...((query.minPrice !== undefined || query.maxPrice !== undefined) && {
        price: { gte: query.minPrice, lte: query.maxPrice },
      }),
      AND: this.searchTerms(query.q),
    }
    return this.paginate(where, orderByFor(query.sort), query.page, query.limit, (r) =>
      toProductCard(r),
    )
  }

  async findPublicByCode(code: string): Promise<ProductDetailDto> {
    const p = await this.prisma.product.findUnique({
      where: { code: code.toUpperCase() },
      include: DETAIL_INCLUDE,
    })
    if (!p || p.status === 'INACTIVE') throw notFound()
    return this.toDetail(p)
  }

  /** Kategori sama, ukuran EU ±1, masih AVAILABLE. */
  async findSimilar(code: string): Promise<ProductCardDto[]> {
    const base = await this.prisma.product.findUnique({ where: { code: code.toUpperCase() } })
    if (!base || base.status === 'INACTIVE') throw notFound()
    const size = Number(base.sizeEu)
    const rows = await this.prisma.product.findMany({
      where: {
        id: { not: base.id },
        status: 'AVAILABLE',
        categoryId: base.categoryId,
        sizeEu: { gte: size - 1, lte: size + 1 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SIMILAR_LIMIT,
      include: CARD_INCLUDE,
    })
    return rows.map((r) => toProductCard(r))
  }

  async recentlySold(): Promise<RecentlySoldDto[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        status: 'SOLD',
        soldAt: { gte: new Date(Date.now() - RECENTLY_SOLD.days * DAY_MS) },
      },
      orderBy: { soldAt: 'desc' },
      take: RECENTLY_SOLD.limit,
      include: CARD_INCLUDE,
    })
    return rows.map((r) => ({ ...toProductCard(r), soldAt: r.soldAt!.toISOString() }))
  }

  // ---------- Panel (STAFF, OWNER) ----------

  /** Semua status, termasuk INACTIVE dan SOLD. */
  listPanel(query: PanelProductListQueryDto): Promise<Paginated<PanelProductDto>> {
    const where: Prisma.ProductWhereInput = {
      ...(query.status && { status: query.status }),
      AND: this.searchTerms(query.q),
    }
    return this.paginate(where, orderByFor(query.sort), query.page, query.limit, (r) => ({
      ...toProductCard(r),
      id: r.id,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  /** Jumlah per status untuk tab di panel daftar produk. */
  async statusCounts(): Promise<Record<'all' | ProductStatus, number>> {
    const rows = await this.prisma.product.groupBy({ by: ['status'], _count: true })
    const counts = { all: 0, AVAILABLE: 0, RESERVED: 0, SOLD: 0, INACTIVE: 0 }
    for (const r of rows) {
      counts[r.status] = r._count
      counts.all += r._count
    }
    return counts
  }

  async findPanelById(id: number): Promise<PanelProductDetailDto> {
    const p = await this.prisma.product.findUnique({ where: { id }, include: DETAIL_INCLUDE })
    if (!p) throw notFound()
    return { ...this.toDetail(p), brandId: p.brandId }
  }

  async create(dto: CreateProductDto, files: Express.Multer.File[], actorId: number) {
    if (files.length < PHOTO_LIMITS.min || files.length > PHOTO_LIMITS.max) {
      throw photoCount(`Unggah ${PHOTO_LIMITS.min} sampai ${PHOTO_LIMITS.max} foto.`)
    }
    await this.assertRelationsExist(dto.brandId, dto.categoryId)
    const urls = await this.storage.saveProductPhotos(files)
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            ...dto,
            code: `TMP-${randomUUID()}`, // diganti kode SSB dari id di bawah
            status: dto.status ?? 'AVAILABLE',
            createdById: actorId,
            photos: {
              create: urls.map((url, i) => ({ url, sortOrder: i, isPrimary: i === 0 })),
            },
          },
        })
        const product = await tx.product.update({
          where: { id: created.id },
          data: { code: productCode(created.id) },
        })
        await this.activity.record(tx, {
          actorId,
          action: ActivityAction.PRODUCT_CREATED,
          entityType: 'Product',
          entityId: product.id,
          after: this.snapshot(product),
        })
        return product.id
      })
      return this.findPanelById(id)
    } catch (e) {
      await this.storage.removeProductPhotos(urls) // jangan tinggalkan file yatim
      throw e
    }
  }

  async update(id: number, dto: UpdateProductDto, actorId: number) {
    await this.assertRelationsExist(dto.brandId, dto.categoryId)
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id } })
      if (!current) throw notFound()
      const priceChanges = dto.price !== undefined && dto.price !== current.price
      // Update bersyarat: kalau checkout mereservasi sepatu ini bersamaan, salah satunya gagal dengan jelas
      const { count } = await tx.product.updateMany({
        where: { id, ...(priceChanges && { status: { in: [...EDITABLE_STATUSES] } }) },
        data: dto,
      })
      if (count === 0) throw locked('harga')

      const after = await tx.product.findUniqueOrThrow({ where: { id } })
      const before = this.snapshot(current)
      const now = this.snapshot(after)
      const changed = TRACKED_FIELDS.filter((f) => before[f] !== now[f])
      if (changed.length === 0) return
      await this.activity.record(tx, {
        actorId,
        action: changed.includes('price')
          ? ActivityAction.PRICE_CHANGED
          : ActivityAction.PRODUCT_UPDATED,
        entityType: 'Product',
        entityId: id,
        before: Object.fromEntries(changed.map((f) => [f, before[f]])),
        after: Object.fromEntries(changed.map((f) => [f, now[f]])),
      })
    })
    return this.findPanelById(id)
  }

  /** Hanya AVAILABLE ↔ INACTIVE dari panel. RESERVED/SOLD diatur oleh alur pesanan. */
  async setStatus(id: number, status: 'AVAILABLE' | 'INACTIVE', actorId: number) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id } })
      if (!current) throw notFound()
      if (current.status === status) return
      if (!(EDITABLE_STATUSES as readonly string[]).includes(current.status)) throw locked('status')
      assertTransition(PRODUCT_TRANSITIONS, current.status, status)

      const { count } = await tx.product.updateMany({
        where: { id, status: current.status },
        data: { status },
      })
      if (count === 0) throw locked('status') // baru saja direservasi checkout
      await this.activity.record(tx, {
        actorId,
        action: ActivityAction.PRODUCT_STATUS_CHANGED,
        entityType: 'Product',
        entityId: id,
        before: { status: current.status },
        after: { status },
      })
    })
    return this.findPanelById(id)
  }

  async addPhotos(id: number, files: Express.Multer.File[], actorId: number) {
    if (files.length === 0) throw photoCount('Pilih minimal 1 foto.')
    const urls = await this.storage.saveProductPhotos(files)
    try {
      await this.prisma.$transaction(async (tx) => {
        const photos = await this.photosOf(tx, id)
        if (photos.length + files.length > PHOTO_LIMITS.max) {
          throw photoCount(
            `Maksimal ${PHOTO_LIMITS.max} foto. Sekarang ada ${photos.length}, jadi bisa tambah ${PHOTO_LIMITS.max - photos.length} lagi.`,
          )
        }
        const nextOrder = Math.max(-1, ...photos.map((p) => p.sortOrder)) + 1
        await tx.productPhoto.createMany({
          // produk lama tanpa foto (mis. data seed) belum punya foto utama: foto baru pertama jadi utama
          data: urls.map((url, i) => ({
            productId: id,
            url,
            sortOrder: nextOrder + i,
            isPrimary: i === 0 && !photos.some((ph) => ph.isPrimary),
          })),
        })
        await this.logPhotos(tx, id, actorId, photos.length)
      })
    } catch (e) {
      await this.storage.removeProductPhotos(urls)
      throw e
    }
    return this.findPanelById(id)
  }

  async removePhoto(id: number, photoId: number, actorId: number) {
    const removed = await this.prisma.$transaction(async (tx) => {
      const photos = await this.photosOf(tx, id)
      const photo = photos.find((p) => p.id === photoId)
      if (!photo) {
        throw new NotFoundException({ code: 'PHOTO_NOT_FOUND', message: 'Foto tidak ditemukan.' })
      }
      if (photos.length <= PHOTO_LIMITS.min) {
        throw photoCount(
          `Minimal ${PHOTO_LIMITS.min} foto. Tambah foto lain dulu sebelum menghapus.`,
        )
      }
      await tx.productPhoto.delete({ where: { id: photoId } })
      if (photo.isPrimary) {
        const next = photos.find((p) => p.id !== photoId)!
        await tx.productPhoto.update({ where: { id: next.id }, data: { isPrimary: true } })
      }
      await this.logPhotos(tx, id, actorId, photos.length)
      return photo.url
    })
    await this.storage.removeProductPhotos([removed]) // file dihapus setelah database pasti berubah
    return this.findPanelById(id)
  }

  async reorderPhotos(id: number, dto: ReorderPhotosDto, actorId: number) {
    await this.prisma.$transaction(async (tx) => {
      const photos = await this.photosOf(tx, id)
      const ids = new Set(photos.map((p) => p.id))
      const sameSet =
        dto.photoIds.length === ids.size &&
        new Set(dto.photoIds).size === ids.size &&
        dto.photoIds.every((pid) => ids.has(pid))
      if (!sameSet || !ids.has(dto.primaryPhotoId)) {
        throw new BadRequestException({
          code: 'PHOTO_ORDER_INVALID',
          message: 'Urutan foto harus memuat semua foto produk ini tepat satu kali.',
        })
      }
      await Promise.all(
        dto.photoIds.map((pid, i) =>
          tx.productPhoto.update({
            where: { id: pid },
            data: { sortOrder: i, isPrimary: pid === dto.primaryPhotoId },
          }),
        ),
      )
      await this.logPhotos(tx, id, actorId, photos.length)
    })
    return this.findPanelById(id)
  }

  // ---------- Bantuan ----------

  private async paginate<T>(
    where: Prisma.ProductWhereInput,
    orderBy: Prisma.ProductOrderByWithRelationInput[],
    page = 1,
    limit = DEFAULT_LIMIT,
    map: (row: CardRow) => T,
  ): Promise<Paginated<T>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: CARD_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ])
    return { data: rows.map(map), meta: { page, limit, total } }
  }

  private async photosOf(tx: Prisma.TransactionClient, productId: number) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!product) throw notFound()
    return product.photos
  }

  private async logPhotos(
    tx: Prisma.TransactionClient,
    productId: number,
    actorId: number,
    before: number,
  ) {
    const after = await tx.productPhoto.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, isPrimary: true },
    })
    await this.activity.record(tx, {
      actorId,
      action: ActivityAction.PRODUCT_PHOTOS_CHANGED,
      entityType: 'Product',
      entityId: productId,
      before: { photoCount: before },
      after: { photoCount: after.length, order: after.map((p) => p.id) },
    })
  }

  private async assertRelationsExist(brandId?: number, categoryId?: number) {
    const [brand, category] = await Promise.all([
      brandId === undefined ? true : this.prisma.brand.findUnique({ where: { id: brandId } }),
      categoryId === undefined
        ? true
        : this.prisma.category.findUnique({ where: { id: categoryId } }),
    ])
    if (!brand || !category) {
      throw new BadRequestException({
        code: 'RELATION_NOT_FOUND',
        message: !brand ? 'Merek tidak ditemukan.' : 'Kategori tidak ditemukan.',
      })
    }
  }

  private snapshot(p: Product) {
    return Object.fromEntries(TRACKED_FIELDS.map((f) => [f, plain(p[f])])) as Record<
      (typeof TRACKED_FIELDS)[number],
      string | number | boolean | null
    >
  }

  /** Setiap kata harus cocok dengan merek, model, kode, atau ukuran ("nike 42" = Nike ukuran 42). */
  private searchTerms(q?: string): Prisma.ProductWhereInput[] {
    const words = (q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5)
    return words.map((w) => {
      const size = Number(w.replace(',', '.'))
      return {
        OR: [
          { model: { contains: w, mode: 'insensitive' } },
          { brand: { name: { contains: w, mode: 'insensitive' } } },
          { code: { contains: w, mode: 'insensitive' } },
          ...(Number.isFinite(size) && size > 0 && size < 100 ? [{ sizeEu: size }] : []),
        ],
      }
    })
  }

  private toDetail(p: DetailRow): ProductDetailDto {
    const primary = p.photos.find((ph) => ph.isPrimary) ?? p.photos[0]
    return {
      ...toProductCard({ ...p, photos: primary ? [primary] : [] }),
      id: p.id,
      sizeUk: p.sizeUk === null ? null : Number(p.sizeUk),
      sizeUs: p.sizeUs === null ? null : Number(p.sizeUs),
      insoleCm: p.insoleCm === null ? null : Number(p.insoleCm),
      defects: (p.defects ?? '')
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean),
      hasBox: p.hasBox,
      hasOriginalInsole: p.hasOriginalInsole,
      hasOriginalLaces: p.hasOriginalLaces,
      description: p.description,
      photos: p.photos.map((ph) => ({ id: ph.id, url: ph.url, isPrimary: ph.isPrimary })),
      category: p.category,
      createdAt: p.createdAt.toISOString(),
    }
  }
}
