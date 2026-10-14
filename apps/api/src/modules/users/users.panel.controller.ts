import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { ChangePasswordDto } from './users.dto.js'
import { UsersService } from './users.service.js'

// Akun sendiri untuk pegawai dan owner (customer memakai /me di users.customer.controller.ts)
@Roles('STAFF', 'OWNER')
@Controller('panel/me')
export class UsersPanelController {
  constructor(private readonly users: UsersService) {}

  @Post('change-password')
  @HttpCode(204)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUserDto) {
    return this.users.changePassword(user.id, dto)
  }
}
