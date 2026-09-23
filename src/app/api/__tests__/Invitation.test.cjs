const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

function createFixture(response = { data: { statusCode: 200 } }) {
  const calls = []
  const moduleExports = {}
  const ecosystem = {
    getEcosystemMemberInvitations: async (...args) => {
      calls.push(args)
      return response
    },
  }
  const modules = {
    '@/services/apiRequests': { ecosystemAxiosGet: async () => response },
    '@/config/apiRoutes': {
      apiRoutes: { Ecosystem: { root: '/ecosystem', usersInvitation: '/users/invitations' } },
    },
    '@/config/GetHeaderConfigs': { getHeaderConfigs: () => ({}) },
    '@/features/common/enum': { EcosystemRoles: { ECOSYSTEM_MEMBER: 'Ecosystem Member' } },
    './ecosystem': ecosystem,
  }
  const file = path.resolve(__dirname, '../Invitation.ts')
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(compiled, {
    exports: moduleExports,
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`)
      return modules[name]
    },
  })
  return { request: moduleExports.getUserEcosystemInvitations, calls, response }
}

for (const pageNumber of [1, 3]) {
  test(`uses the platform member invitation helper for page ${pageNumber}`, async () => {
    const fixture = createFixture()

    assert.equal(await fixture.request(pageNumber, 10, 'University', 'org-id'), fixture.response)
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls)), [
      ['org-id', '', { pageNumber: pageNumber - 1, pageSize: 10, searchTerm: 'University' }, 'Ecosystem Member'],
    ])
  })
}

test('preserves errors returned by the authenticated platform helper', async () => {
  const fixture = createFixture('Invitation request failed')

  assert.equal(await fixture.request(1, 10, '', 'org-id'), 'Invitation request failed')
  assert.equal(fixture.calls.length, 1)
})