import { Fulfillment } from '@ssb/shared'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value

class OpeningHourInput {
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Hari buka 2 sampai 40 karakter, mis. Senin sampai Sabtu' })
  days!: string

  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Jam buka 2 sampai 40 karakter, mis. 10.00 sampai 21.00' })
  hours!: string
}

/** PUT /owner/settings: seluruh pengaturan sekaligus */
export class UpdateStoreSettingsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @Matches(/^(\+62|62|0)8\d{7,12}$/, { message: 'Nomor WhatsApp belum benar, contoh 081234567890' })
  whatsapp!: string

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  instagram!: string | null

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tiktok!: string | null

  @Transform(trim)
  @IsString()
  @Length(10, 300, { message: 'Alamat toko 10 sampai 300 karakter' })
  address!: string

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHourInput)
  openingHours!: OpeningHourInput[]

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Batas bayar 1 sampai 72 jam' })
  @Max(72, { message: 'Batas bayar 1 sampai 72 jam' })
  paymentDeadlineHours!: number

  @IsArray()
  @ArrayMinSize(1, { message: 'Aktifkan minimal satu cara ambil sepatu' })
  @ArrayUnique()
  @IsIn(Object.values(Fulfillment), { each: true })
  fulfillmentMethods!: Fulfillment[]
}

/** Konfirmasi password owner untuk setiap perubahan rekening (business-rules: Kanal resmi) */
export class PasswordConfirmDto {
  @IsString({ message: 'Masukkan password owner untuk konfirmasi' })
  @IsNotEmpty({ message: 'Masukkan password owner untuk konfirmasi' })
  password!: string
}

export class BankAccountInputDto extends PasswordConfirmDto {
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Nama bank 2 sampai 40 karakter' })
  bankName!: string

  @Transform(trim)
  @Matches(/^[0-9 -]{5,30}$/, { message: 'Nomor rekening hanya angka, 5 sampai 30 digit' })
  accountNumber!: string

  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Atas nama 2 sampai 80 karakter' })
  accountName!: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class FaqInputDto {
  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'Pertanyaan 5 sampai 200 karakter' })
  question!: string

  @Transform(trim)
  @IsString()
  @Length(5, 2000, { message: 'Jawaban 5 sampai 2000 karakter' })
  answer!: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number
}
