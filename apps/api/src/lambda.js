/**
 * AWS Lambda entrypoint for the PrivacyPrint API.
 *
 * Wraps the existing Express app with serverless-http so every route,
 * middleware and tenancy check works unchanged behind a Lambda Function URL.
 * Requires the aws-serverless adapter in the deployment package; local
 * development (`npm run dev`) never loads this file.
 */
const serverless = require('serverless-http')
const { app } = require('./server')

module.exports.handler = serverless(app)