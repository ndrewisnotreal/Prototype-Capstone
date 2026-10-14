import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { UsersCustomerController } from './users.customer.controller.js'
import { UsersOwnerController } from './users.owner.controller.js'
import { UsersPanelController } from './users.panel.controller.js'
import { UsersService } from './users.service.js'

@Module({
  imports: [AuthModule],
  controllers: [UsersCustomerController, UsersOwnerController, UsersPanelController],
  providers: [UsersService],
})
export class UsersModule {}
