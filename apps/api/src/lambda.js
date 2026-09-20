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

const slsHandler = serverless(app, {
  binary: ['image/*', 'font/*', 'application/octet-stream'],
})


module.exports.handler = async (event, context) => {
  const res = await slsHandler(event, context)
  if (res && res.headers) {
    for (const key of Object.keys(res.headers)) {
      if (key.toLowerCase().startsWith('access-control-')) {
        delete res.headers[key]
      }
    }
  }
  if (res && res.multiValueHeaders) {
    for (const key of Object.keys(res.multiValueHeaders)) {
      if (key.toLowerCase().startsWith('access-control-')) {
        delete res.multiValueHeaders[key]
      }
    }
  }
  return res
}