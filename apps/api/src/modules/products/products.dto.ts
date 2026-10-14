import { Condition, type ProductListQuery, type ProductSort } from '@ssb/shared'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

// ?brand=Nike&brand=Adidas atau ?brand=Nike,Adidas → ['Nike', 'Adidas']
const toList = ({ value }: { value: unknown }) =>
  (Array.isArray(value) ? value : [value])
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean)
const toNumberList = (arg: { value: unknown }) => toList(arg).map(Number)

export class ProductListQueryDto implements ProductListQuery {
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsString({ each: true })
  brand?: string[]

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsString({ each: true })
  category?: string[]

  @IsOptional()
  @Transform(toNumberList)
  @IsArray()
  @IsNumber({}, { each: true, message: 'Ukuran harus angka, contoh 42 atau 42.5' })
  size?: number[]

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(Object.values(Condition), { each: true, message: 'Kondisi tidak dikenal' })
  condition?: Condition[]

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Harga minimum harus angka bulat' })
  @Min(0)
  minPrice?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Harga maksimum harus angka bulat' })
  @Min(0)
  maxPrice?: number

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'], { message: 'Urutan tidak dikenal' })
  sort?: ProductSort

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  hideReserved?: boolean

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
