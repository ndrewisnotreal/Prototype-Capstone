import { Module } from '@nestjs/common'
import { MailService } from '../../common/mail/mail.service.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailService],
  // dipakai modul users (undangan pegawai, reset password oleh owner)
  exports: [AuthService],
})
export class AuthModule {}
