import { FULFILLMENT_LABELS, type SalesReportDto } from '@ssb/shared'
import ExcelJS from 'exceljs'
import pdfmake from 'pdfmake'
import type { TableCell, TDocumentDefinitions } from 'pdfmake/interfaces.js'

// Ekspor laporan penjualan (ADR-0005). Isi file sama dengan GET /owner/reports/sales.
const STORE = 'Suwandi SecondBranded'
const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(n)
    .replace(/\s/g, ' ')
const date = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))
const periodLabel = (r: SalesReportDto) =>
  `${date(`${r.from}T00:00:00+07:00`)} sampai ${date(`${r.to}T00:00:00+07:00`)}` +
  (r.fulfillment ? `, ${FULFILLMENT_LABELS[r.fulfillment]}` : '')

const COLUMNS = [
  'Tanggal',
  'Kode pesanan',
  'Customer',
  'Sepatu',
  'Metode',
  'Diverifikasi oleh',
  'Total',
]
const cells = (r: SalesReportDto['rows'][number]) => [
  date(r.verifiedAt),
  r.code,
  r.customerName,
  r.itemNames.join(', '),
  FULFILLMENT_LABELS[r.fulfillment],
  r.verifiedBy ?? '-',
]

export function salesReportFilename(r: SalesReportDto, ext: 'pdf' | 'xlsx') {
  return `laporan-penjualan_${r.from}_${r.to}.${ext}`
}

export async function salesReportXlsx(r: SalesReportDto): Promise<Buffer> {
  const book = new ExcelJS.Workbook()
  book.creator = STORE
  const sheet = book.addWorksheet('Penjualan')
  sheet.addRow([`Laporan penjualan ${STORE}`]).font = { bold: true, size: 14 }
  sheet.addRow([periodLabel(r)])
  sheet.addRow([])
  sheet.addRow(['Total pendapatan', r.summary.revenue])
  sheet.addRow(['Transaksi', r.summary.transactions])
  sheet.addRow(['Sepatu terjual', r.summary.itemsSold])
  sheet.addRow(['Rata-rata per sepatu', r.summary.averagePerItem])
  sheet.addRow([])
  const header = sheet.addRow(COLUMNS)
  header.font = { bold: true }
  for (const row of r.rows) sheet.addRow([...cells(row), row.total])
  sheet.addRow(['', '', '', '', '', 'Total', r.summary.revenue]).font = { bold: true }

  const money = '"Rp" #,##0'
  for (const n of [4, 7]) sheet.getCell(`B${n}`).numFmt = money
  sheet.getColumn(7).numFmt = money
  sheet.columns.forEach((c, i) => (c.width = [14, 20, 22, 40, 22, 18, 14][i]))
  return Buffer.from(await book.xlsx.writeBuffer())
}

// Font standar PDF: tidak perlu menyimpan file font di repo
const HELVETICA = {
  normal: 'Helvetica',
  bold: 'Helvetica-Bold',
  italics: 'Helvetica-Oblique',
  bolditalics: 'Helvetica-BoldOblique',
}
pdfmake.setFonts({ Helvetica: HELVETICA })
// Dokumen hanya berisi teks dari database: tolak akses URL, dan file lokal selain nama font standar
const STANDARD_FONTS = new Set(Object.values(HELVETICA))
pdfmake.setUrlAccessPolicy(() => false)
pdfmake.setLocalAccessPolicy((path) => STANDARD_FONTS.has(path))

export function salesReportPdf(r: SalesReportDto): Promise<Buffer> {
  const body: TableCell[][] = [
    COLUMNS.map((c, i) => ({ text: c, bold: true, alignment: i === 6 ? 'right' : 'left' })),
    ...r.rows.map((row) => [
      ...cells(row),
      { text: rupiah(row.total), alignment: 'right' as const },
    ]),
    [
      { text: `Total ${r.summary.transactions} transaksi`, colSpan: 6, bold: true },
      ...Array.from({ length: 5 }, () => ({})),
      { text: rupiah(r.summary.revenue), bold: true, alignment: 'right' },
    ],
  ]
  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [36, 36, 36, 36],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: [
      { text: `Laporan penjualan ${STORE}`, fontSize: 16, bold: true },
      { text: periodLabel(r), margin: [0, 2, 0, 12], color: '#4B5563' },
      {
        columns: [
          ['Total pendapatan', rupiah(r.summary.revenue)],
          ['Transaksi', String(r.summary.transactions)],
          ['Sepatu terjual', String(r.summary.itemsSold)],
          ['Rata-rata per sepatu', rupiah(r.summary.averagePerItem)],
        ].map(([label, value]) => ({
          stack: [
            { text: label, color: '#4B5563' },
            { text: value, fontSize: 13, bold: true },
          ],
        })),
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          headerRows: 1,
          widths: [60, 95, 90, '*', 80, 70, 70],
          body,
        },
        layout: 'lightHorizontalLines',
      },
    ],
    footer: (page, pages) => ({
      text: `Dibuat otomatis oleh sistem ${STORE}. Halaman ${page} dari ${pages}`,
      fontSize: 8,
      color: '#4B5563',
      margin: [36, 0, 36, 0],
    }),
  }
  return pdfmake.createPdf(doc).getBuffer()
}
