import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { CreateStaffDto, OwnerUserListQueryDto, UpdateUserStatusDto } from './users.dto.js'
import { UsersService } from './users.service.js'

// Layar O-Akun
@Roles('OWNER')
@Controller('owner/users')
export class UsersOwnerController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() q: OwnerUserListQueryDto) {
    return this.users.listForOwner(q)
  }

  @Post('staff')
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() owner: AuthUserDto) {
    return this.users.createStaff(owner.id, dto)
  }

  @Patch(':id')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() owner: AuthUserDto,
  ) {
    return this.users.setActive(owner.id, id, dto.isActive)
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  resetPassword(@Param('id', ParseIntPipe) id: number, @CurrentUser() owner: AuthUserDto) {
    return this.users.sendResetLink(owner.id, id)
  }
}
