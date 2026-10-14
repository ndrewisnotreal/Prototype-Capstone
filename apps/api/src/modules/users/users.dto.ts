import { Transform, Type } from 'class-transformer'
import {
  Equals,
  IsBoolean,
  IsEmail,
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
  MinLength,
} from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const stripPhone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s-]/g, '') : value

export class UpdateProfileDto {
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @Length(2, 100, { message: 'Nama 2 sampai 100 karakter' })
  name!: string

  @Transform(stripPhone)
  @Matches(/^(\+62|62|0)8\d{7,12}$/, { message: 'Nomor WhatsApp belum benar, contoh 081234567890' })
  phone!: string
}

export class AddressDto {
  @Transform(trim)
  @IsString({ message: 'Label wajib diisi' })
  @Length(2, 30, { message: 'Label 2 sampai 30 karakter, mis. Rumah atau Kos' })
  label!: string

  @Transform(trim)
  @IsString({ message: 'Alamat wajib diisi' })
  @Length(10, 300, { message: 'Alamat 10 sampai 300 karakter' })
  line!: string

  @Transform(trim)
  @IsString({ message: 'Kota wajib diisi' })
  @Length(2, 60, { message: 'Kota wajib diisi' })
  city!: string

  @Transform(trim)
  @Matches(/^\d{5}$/, { message: 'Kode pos harus 5 angka' })
  postalCode!: string
}

/** PATCH: field alamat sebagian, atau `{ isPrimary: true }` untuk "Jadikan utama" */
export class UpdateAddressDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 30, { message: 'Label 2 sampai 30 karakter, mis. Rumah atau Kos' })
  label?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(10, 300, { message: 'Alamat 10 sampai 300 karakter' })
  line?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 60, { message: 'Kota wajib diisi' })
  city?: string

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{5}$/, { message: 'Kode pos harus 5 angka' })
  postalCode?: string

  // false tidak didukung: alamat utama berpindah dengan menjadikan alamat lain utama
  @IsOptional()
  @IsBoolean()
  @Equals(true, { message: 'Pilih alamat lain sebagai utama' })
  isPrimary?: true
}

export class ChangePasswordDto {
  @IsString({ message: 'Password sekarang wajib diisi' })
  @IsNotEmpty({ message: 'Password sekarang wajib diisi' })
  currentPassword!: string

  @IsString({ message: 'Password baru wajib diisi' })
  @MinLength(8, { message: 'Password baru minimal 8 karakter' })
  @MaxLength(72, { message: 'Password baru maksimal 72 karakter' })
  newPassword!: string
}

export class OwnerUserListQueryDto {
  @IsIn(['STAFF', 'CUSTOMER'], { message: 'Pilih pegawai atau customer' })
  role!: 'STAFF' | 'CUSTOMER'

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

export class CreateStaffDto {
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @Length(2, 100, { message: 'Nama 2 sampai 100 karakter' })
  name!: string

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Format email belum benar' })
  email!: string

  @Transform(stripPhone)
  @Matches(/^(\+62|62|0)8\d{7,12}$/, { message: 'Nomor WhatsApp belum benar, contoh 081234567890' })
  phone!: string
}

export class UpdateUserStatusDto {
  @IsBoolean({ message: 'Status aktif wajib diisi' })
  isActive!: boolean
}
