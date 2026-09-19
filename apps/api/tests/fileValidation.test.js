/**
 * Content-vs-claimed-type validation tests.
 *
 * The API trusts bytes, not the client's Content-Type header: a text file
 * renamed .pdf must be rejected before it is stored or sent to a printer.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-content-'))
process.env.UPLOAD_DIR = path.join(testRoot, 'uploads')
process.env.DATA_DIR = path.join(testRoot, 'data')

const { sniffContentType, assertUploadContent } = require('../src/utils/fileValidation')

test.after(() => fs.rmSync(testRoot, { recursive: true, force: true }))

function write(name, content) {
  const filePath = path.join(testRoot, name)
  fs.writeFileSync(filePath, content)
  return filePath
}

test('content signatures identify PDF, JPEG, PNG, GIF and plain text', () => {
  assert.equal(sniffContentType(Buffer.from('%PDF-1.7\n...')), 'application/pdf')
  assert.equal(sniffContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(sniffContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(sniffContentType(Buffer.from('GIF89a....')), 'image/gif')
  assert.equal(sniffContentType(Buffer.from('plain text document')), 'text/plain')

  // Unrecognized binary and empty content are never accepted.
  assert.equal(sniffContentType(Buffer.from([0x00, 0x01, 0x02, 0x03])), null)
  assert.equal(sniffContentType(Buffer.alloc(0)), null)
  assert.equal(sniffContentType(null), null)
})

test('a document whose content matches its declared type is accepted', () => {
  const pdf = write('real.pdf', '%PDF-1.4\n1 0 obj\n%%EOF\n')
  assert.equal(assertUploadContent(pdf, 'application/pdf'), 'application/pdf')

  const text = write('notes.txt', 'Customer notes')
  assert.equal(assertUploadContent(text, 'text/plain'), 'text/plain')
})

test('a spoofed document is rejected with an actionable message', () => {
  const fake = write('invoice.pdf', 'This is not a PDF at all')

  assert.throws(
    () => assertUploadContent(fake, 'application/pdf'),
    /does not match its declared type application\/pdf \(detected text\/plain\)/,
  )

  // Binary junk claiming to be an image is also refused.
  const binary = write('photo.png', Buffer.from([0x00, 0x01, 0x02, 0x03]))
  assert.throws(() => assertUploadContent(binary, 'image/png'), /unsupported format/)
})

test('empty and unreadable uploads are rejected', () => {
  const empty = write('empty.pdf', '')
  assert.throws(() => assertUploadContent(empty, 'application/pdf'), /empty or in an unsupported format/)

  assert.throws(
    () => assertUploadContent(path.join(testRoot, 'missing.pdf'), 'application/pdf'),
    /could not be read/,
  )
})
