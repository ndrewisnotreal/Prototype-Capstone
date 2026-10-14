import { Fulfillment, type OrderTab, type PanelOrderTab } from '@ssb/shared'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CheckoutDto {
  @IsArray({ message: 'Pilih sepatu yang mau dibeli' })
  @ArrayMinSize(1, { message: 'Pilih minimal 1 sepatu' })
  @ArrayMaxSize(20, { message: 'Maksimal 20 sepatu per pesanan' })
  @ArrayUnique({ message: 'Sepatu yang sama tercantum dua kali' })
  @Type(() => Number)
  @IsInt({ each: true })
  productIds!: number[]

  @IsIn(Object.values(Fulfillment), { message: 'Pilih ambil di toko atau dikirim' })
  fulfillment!: Fulfillment

  @Transform(trim)
  @IsString({ message: 'Nama penerima wajib diisi' })
  @Length(2, 100, { message: 'Nama penerima 2 sampai 100 karakter' })
  recipientName!: string

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @Matches(/^(\+62|62|0)8\d{7,12}$/, { message: 'Nomor HP belum benar, contoh 081234567890' })
  recipientPhone!: string

  // Wajib hanya bila dikirim; untuk ambil di toko diabaikan
  @ValidateIf((o: CheckoutDto) => o.fulfillment === 'SHIPPING')
  @Transform(trim)
  @IsString({ message: 'Alamat pengiriman wajib diisi' })
  @Length(10, 500, { message: 'Alamat pengiriman 10 sampai 500 karakter' })
  shippingAddress?: string

  @Equals(true, { message: 'Setujui syarat belanja dulu untuk lanjut' })
  agree!: boolean
}

export class OrderListQueryDto {
  @IsOptional()
  @IsIn(['all', 'unpaid', 'verifying', 'processing', 'completed', 'cancelled'], {
    message: 'Tab tidak dikenal',
  })
  tab?: OrderTab

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

/** Field form unggah bukti (multipart; file di field `file`). */
export class SubmitProofDto {
  @Transform(trim)
  @IsString({ message: 'Nama pengirim wajib diisi' })
  @Length(2, 100, { message: 'Nama pengirim 2 sampai 100 karakter' })
  senderName!: string

  @Transform(trim)
  @IsString({ message: 'Bank pengirim wajib diisi' })
  @Length(2, 50, { message: 'Bank pengirim 2 sampai 50 karakter' })
  senderBank!: string

  @Type(() => Number)
  @IsInt({ message: 'Nominal harus angka bulat dalam rupiah' })
  @Min(1, { message: 'Nominal wajib diisi' })
  @Max(1_000_000_000)
  amount!: number
}

export class PanelOrderListQueryDto {
  @IsOptional()
  @IsIn(['all', 'unpaid', 'processing', 'delivering', 'completed', 'cancelled'], {
    message: 'Tab tidak dikenal',
  })
  tab?: PanelOrderTab

  @IsOptional()
  @IsString()
  @MaxLength(60)
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

/** Alasan tolak bukti / batal oleh pegawai: wajib dan terlihat customer */
export class StaffReasonDto {
  @Transform(trim)
  @IsString({ message: 'Alasan wajib diisi' })
  @Length(10, 300, { message: 'Alasan 10 sampai 300 karakter, supaya customer paham' })
  reason!: string
}

export class ShipOrderDto {
  @Transform(trim)
  @IsString({ message: 'Ekspedisi wajib diisi' })
  @Length(2, 50, { message: 'Ekspedisi wajib diisi' })
  courier!: string

  @Transform(trim)
  @IsString({ message: 'Nomor resi wajib diisi' })
  @Matches(/^[A-Za-z0-9-]{6,40}$/, { message: 'Nomor resi 6 sampai 40 huruf/angka' })
  trackingNumber!: string
}
