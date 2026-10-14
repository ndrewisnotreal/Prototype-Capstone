import { Module } from '@nestjs/common'
import { FilesModule } from '../files/files.module.js'
import { DashboardPanelController } from './dashboard.panel.controller.js'
import { OrdersCustomerController } from './orders.customer.controller.js'
import { OrdersPanelController } from './orders.panel.controller.js'
import { OrdersPanelService } from './orders.panel.service.js'
import { OrdersExpiryScheduler } from './orders.scheduler.js'
import { OrdersService } from './orders.service.js'
import { PaymentProofFilesController } from './payment-proof-files.controller.js'
import { PaymentsPanelController } from './payments.panel.controller.js'

@Module({
  imports: [FilesModule],
  controllers: [
    OrdersCustomerController,
    PaymentProofFilesController,
    OrdersPanelController,
    PaymentsPanelController,
    DashboardPanelController,
  ],
  providers: [OrdersService, OrdersPanelService, OrdersExpiryScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
