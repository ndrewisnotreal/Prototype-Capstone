import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import { AddressDto, ChangePasswordDto, UpdateAddressDto, UpdateProfileDto } from './users.dto.js'
import { UsersService } from './users.service.js'

@Roles('CUSTOMER')
@Controller('me')
export class UsersCustomerController {
  constructor(private readonly users: UsersService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthUserDto) {
    return { user }
  }

  @Patch('profile')
  async updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUserDto) {
    return { user: await this.users.updateProfile(user.id, dto) }
  }

  @Post('change-password')
  @HttpCode(204)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUserDto) {
    return this.users.changePassword(user.id, dto)
  }

  @Get('addresses')
  addresses(@CurrentUser() user: AuthUserDto) {
    return this.users.listAddresses(user.id)
  }

  @Post('addresses')
  createAddress(@Body() dto: AddressDto, @CurrentUser() user: AuthUserDto) {
    return this.users.createAddress(user.id, dto)
  }

  @Patch('addresses/:id')
  updateAddress(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.users.updateAddress(user.id, id, dto)
  }

  @Delete('addresses/:id')
  deleteAddress(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUserDto) {
    return this.users.deleteAddress(user.id, id)
  }
}
