import { OmitType, PartialType } from '@nestjs/mapped-types'
import { Condition, ProductStatus, type ProductSort } from '@ssb/shared'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

// Form tambah produk dikirim sebagai multipart (semua nilai string), edit sebagai JSON.
// '' dari multipart = kosong (null), null dari JSON = hapus nilai opsional.
const toNumber = ({ value }: { value: unknown }) =>
  value === '' ? null : value === undefined || value === null ? value : Number(value)
const toBoolean = ({ value }: { value: unknown }) =>
  value === undefined
    ? undefined
    : value === true || value === 'true' || value === '1' || value === 'on'
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const decimal = { maxDecimalPlaces: 1 }

export class CreateProductDto {
  @Type(() => Number)
  @IsInt({ message: 'Pilih merek' })
  brandId!: number

  @Type(() => Number)
  @IsInt({ message: 'Pilih kategori' })
  categoryId!: number

  @Transform(trim)
  @IsString({ message: 'Nama atau model wajib diisi' })
  @Length(2, 120, { message: 'Nama atau model 2 sampai 120 karakter' })
  model!: string

  @Transform(toNumber)
  @IsNumber(decimal, { message: 'Ukuran EU harus angka, contoh 42 atau 42.5' })
  @Min(30, { message: 'Ukuran EU minimal 30' })
  @Max(50, { message: 'Ukuran EU maksimal 50' })
  sizeEu!: number

  @IsOptional()
  @Transform(toNumber)
  @IsNumber(decimal, { message: 'Ukuran UK harus angka' })
  @Min(1)
  @Max(20)
  sizeUk?: number | null

  @IsOptional()
  @Transform(toNumber)
  @IsNumber(decimal, { message: 'Ukuran US harus angka' })
  @Min(1)
  @Max(20)
  sizeUs?: number | null

  @IsOptional()
  @Transform(toNumber)
  @IsNumber(decimal, { message: 'Panjang insole harus angka, contoh 26.5' })
  @Min(10)
  @Max(40)
  insoleCm?: number | null

  @IsIn(Object.values(Condition), { message: 'Pilih kondisi' })
  condition!: Condition

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Catatan minus maksimal 1000 karakter' })
  defects?: string | null

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasBox?: boolean

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasOriginalInsole?: boolean

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasOriginalLaces?: boolean

  @Transform(toNumber)
  @IsInt({ message: 'Harga harus angka bulat dalam rupiah' })
  @Min(1000, { message: 'Harga minimal Rp 1.000' })
  @Max(100_000_000, { message: 'Harga maksimal Rp 100.000.000' })
  price!: number

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Deskripsi maksimal 2000 karakter' })
  description?: string | null

  /** "Tampilkan di katalog" di form: AVAILABLE (default) atau INACTIVE */
  @IsOptional()
  @IsIn([ProductStatus.AVAILABLE, ProductStatus.INACTIVE])
  status?: 'AVAILABLE' | 'INACTIVE'
}

// Status punya endpoint sendiri (PATCH /:id/status)
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['status'] as const),
) {}

export class ProductStatusDto {
  @IsIn([ProductStatus.AVAILABLE, ProductStatus.INACTIVE], {
    message: 'Status hanya bisa Tersedia atau Nonaktif',
  })
  status!: 'AVAILABLE' | 'INACTIVE'
}

export class ReorderPhotosDto {
  /** Semua id foto produk, dalam urutan baru */
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  photoIds!: number[]

  @Type(() => Number)
  @IsInt()
  primaryPhotoId!: number
}

export class PanelProductListQueryDto {
  @IsOptional()
  @IsIn(Object.values(ProductStatus), { message: 'Status tidak dikenal' })
  status?: ProductStatus

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'], { message: 'Urutan tidak dikenal' })
  sort?: ProductSort

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50, { message: 'Maksimal 50 per halaman' })
  limit?: number
}
