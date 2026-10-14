import { Controller, Get, Query } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import { Roles } from '../../common/auth/auth.decorators.js'
import { DAY_MS, parseWibDate } from '../../common/utils/wib.js'
import { ActivityLogService } from './activity-log.service.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/

class ActivityLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorId?: number

  @IsOptional()
  @IsString()
  @MaxLength(40)
  action?: string

  /** tanggal WIB "YYYY-MM-DD", inklusif */
  @IsOptional()
  @Matches(DATE, { message: 'Tanggal "dari" format YYYY-MM-DD' })
  from?: string

  @IsOptional()
  @Matches(DATE, { message: 'Tanggal "sampai" format YYYY-MM-DD' })
  to?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

// Layar O-Log
@Roles('OWNER')
@Controller('owner/activity-logs')
export class ActivityLogOwnerController {
  constructor(private readonly logs: ActivityLogService) {}

  @Get()
  list(@Query() q: ActivityLogQueryDto) {
    return this.logs.list({
      ...q,
      from: q.from ? parseWibDate(q.from) : undefined,
      to: q.to ? new Date(parseWibDate(q.to).getTime() + DAY_MS) : undefined,
    })
  }
}
