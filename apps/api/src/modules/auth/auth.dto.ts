import { Transform } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator'

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

// bcrypt hanya memakai 72 byte pertama, jadi password lebih panjang ditolak supaya tidak menyesatkan
const PASSWORD_RULES = [
  IsString({ message: 'Password wajib diisi' }),
  MinLength(8, { message: 'Password minimal 8 karakter' }),
  MaxLength(72, { message: 'Password maksimal 72 karakter' }),
]
const Password = (): PropertyDecorator => (target, key) =>
  PASSWORD_RULES.forEach((rule) => rule(target, key))

export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @MinLength(2, { message: 'Nama minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama maksimal 100 karakter' })
  name!: string

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Format email belum benar' })
  email!: string

  @Transform(trim)
  @Matches(/^(\+62|62|0)8\d{7,12}$/, { message: 'Nomor HP belum benar, contoh 081234567890' })
  phone!: string

  @Password()
  password!: string
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Format email belum benar' })
  email!: string

  @IsString({ message: 'Password wajib diisi' })
  @IsNotEmpty({ message: 'Password wajib diisi' })
  password!: string
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Format email belum benar' })
  email!: string
}

export class ResetPasswordDto {
  @IsString({ message: 'Token reset wajib diisi' })
  @IsNotEmpty({ message: 'Token reset wajib diisi' })
  token!: string

  @Password()
  password!: string
}
