const { DOCUMENT_BUCKET } = require('../config')

/** The AWS SDK is loaded lazily so tests never need it when S3 is unused. */
function createS3Client() {
  const { S3Client } = require('@aws-sdk/client-s3')
  return new S3Client({})
}

/**
 * S3 access for document storage. The AWS SDK is loaded only here, so tests
 * and local development never need the dependency when DOCUMENT_BUCKET is
 * unset (the local-storage provider is used instead).
 */

let cachedPut = null
let cachedDelete = null
let cachedGet = null

function getBucket() {
  return typeof DOCUMENT_BUCKET === 'string' ? DOCUMENT_BUCKET.trim() : ''
}

function isS3Configured() {
  return Boolean(getBucket())
}

/**
 * Returns an async putObject(request) compatible with the document uploader's
 * S3 contract, or null when S3 is not configured (use local storage).
 */
function getS3Uploader() {
  if (!isS3Configured()) return null
  if (!cachedPut) {
    const client = createS3Client()
    const { PutObjectCommand } = require('@aws-sdk/client-s3')
    cachedPut = async (request) => client.send(new PutObjectCommand(request))
  }
  return cachedPut
}

/** Returns an async deleteObject(request), or null when S3 is not configured. */
function getS3Deleter() {
  if (!isS3Configured()) return null
  if (!cachedDelete) {
    const client = createS3Client()
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
    cachedDelete = async (request) => client.send(new DeleteObjectCommand(request))
  }
  return cachedDelete
}

/**
 * Returns an async getObject(request) yielding { Body (stream/bytes),
 * ContentType, ContentLength }, or null when S3 is not configured.
 */
function getS3Getter() {
  if (!isS3Configured()) return null
  if (!cachedGet) {
    const client = createS3Client()
    const { GetObjectCommand } = require('@aws-sdk/client-s3')
    cachedGet = async (request) => client.send(new GetObjectCommand(request))
  }
  return cachedGet
}

module.exports = {
  isS3Configured,
  getBucket,
  getS3Uploader,
  getS3Deleter,
  getS3Getter,
  _reset: () => { cachedPut = cachedDelete = cachedGet = null },
  /** Test seam only: pre-seed cached adapters with fakes (unit tests). */
  _overrideClients: ({ put, get, delete: deleteFn } = {}) => {
    if (put) cachedPut = put
    if (get) cachedGet = get
    if (deleteFn) cachedDelete = deleteFn
  },
}