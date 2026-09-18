const assert = require('node:assert/strict')
const test = require('node:test')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const apiRoot = path.join(__dirname, '..')

test('production mode requires AUTH_SECRET from the environment', () => {
  const result = spawnSync(process.execPath, ['-e', "process.env.NODE_ENV='production'; require('./src/config')"], {
    cwd: apiRoot,
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr.toString(), /AUTH_SECRET/i)
})

test('development mode can generate a demo secret if none is set', () => {
  const result = spawnSync(process.execPath, ['-e', "process.env.NODE_ENV='development'; const c=require('./src/config'); console.log(Boolean(c.AUTH_SECRET))"], {
    cwd: apiRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /true/i)
})
