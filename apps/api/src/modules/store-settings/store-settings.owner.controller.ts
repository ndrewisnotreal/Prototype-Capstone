import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common'
import type { AuthUserDto } from '@ssb/shared'
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js'
import {
  BankAccountInputDto,
  FaqInputDto,
  PasswordConfirmDto,
  UpdateStoreSettingsDto,
} from './store-settings.dto.js'
import { StoreSettingsOwnerService } from './store-settings.owner.service.js'

// Layar O-Pengaturan: pengaturan toko, rekening resmi (konfirmasi password), FAQ chatbot.
@Roles('OWNER')
@Controller('owner')
export class StoreSettingsOwnerController {
  constructor(private readonly store: StoreSettingsOwnerService) {}

  @Get('settings')
  settings() {
    return this.store.settings()
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateStoreSettingsDto, @CurrentUser() owner: AuthUserDto) {
    return this.store.updateSettings(owner.id, dto)
  }

  @Get('bank-accounts')
  bankAccounts() {
    return this.store.bankAccounts()
  }

  @Post('bank-accounts')
  createBankAccount(@Body() dto: BankAccountInputDto, @CurrentUser() owner: AuthUserDto) {
    return this.store.createBankAccount(owner.id, dto)
  }

  @Patch('bank-accounts/:id')
  updateBankAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BankAccountInputDto,
    @CurrentUser() owner: AuthUserDto,
  ) {
    return this.store.updateBankAccount(owner.id, id, dto)
  }

  // DELETE dengan body: password konfirmasi tidak boleh lewat URL (tercatat di log server)
  @Delete('bank-accounts/:id')
  deleteBankAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PasswordConfirmDto,
    @CurrentUser() owner: AuthUserDto,
  ) {
    return this.store.deleteBankAccount(owner.id, id, dto.password)
  }

  @Get('faqs')
  faqs() {
    return this.store.faqs()
  }

  @Post('faqs')
  createFaq(@Body() dto: FaqInputDto, @CurrentUser() owner: AuthUserDto) {
    return this.store.createFaq(owner.id, dto)
  }

  @Patch('faqs/:id')
  updateFaq(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FaqInputDto,
    @CurrentUser() owner: AuthUserDto,
  ) {
    return this.store.updateFaq(owner.id, id, dto)
  }

  @Delete('faqs/:id')
  deleteFaq(@Param('id', ParseIntPipe) id: number, @CurrentUser() owner: AuthUserDto) {
    return this.store.deleteFaq(owner.id, id)
  }
}
