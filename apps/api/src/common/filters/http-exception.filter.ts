import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import { InvalidTransitionError, type ApiError } from '@ssb/shared'

// Semua error keluar dengan bentuk { statusCode, code, message, details? } (docs/api.md).
// Lempar dengan kode khusus: new ConflictException({ code: 'PRODUCT_NOT_AVAILABLE', message, details }).
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const body = this.toBody(exception)
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body)
  }

  private toBody(exception: unknown): ApiError {
    if (exception instanceof InvalidTransitionError) {
      return { statusCode: HttpStatus.CONFLICT, code: exception.code, message: exception.message }
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus()
      const res = exception.getResponse()
      const r = (typeof res === 'string' ? { message: res } : res) as {
        code?: string
        message?: string | string[]
        details?: Record<string, unknown>
      }
      if (statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
        return {
          statusCode,
          code: 'FILE_TOO_LARGE',
          message: 'Ukuran file terlalu besar. Maksimal 5 MB per file.',
        }
      }
      // ValidationPipe mengirim message berupa array pesan per field
      if (Array.isArray(r.message)) {
        return {
          statusCode,
          code: 'VALIDATION_ERROR',
          message: 'Data yang dikirim belum valid',
          details: { errors: r.message },
        }
      }
      return {
        statusCode,
        code: r.code ?? HttpStatus[statusCode] ?? 'ERROR',
        message: r.message ?? exception.message,
        ...(r.details && { details: r.details }),
      }
    }

    this.logger.error(exception)
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server. Coba lagi sebentar.',
    }
  }
}
