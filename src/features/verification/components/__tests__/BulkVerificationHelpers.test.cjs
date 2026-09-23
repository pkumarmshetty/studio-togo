/* eslint @typescript-eslint/no-var-requires: "off", @typescript-eslint/explicit-function-return-type: "off" */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const moduleExports = {}
const file = path.resolve(__dirname, '../BulkVerificationHelpers.ts')
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText

vm.runInNewContext(compiled, {
  exports: moduleExports,
  require: (name) => assert.fail(`Unexpected dependency: ${name}`),
})

const {
  CSV_TEMPLATE_CONTENT,
  parseCsvConnectionIds,
  mapCheckedAttributes,
  checkedW3cAttributes,
  generateNonW3CCredential,
  generateW3CCredential,
} = moduleExports

function assertPayload(actual, expected) {
  // Normalize VM prototypes while retaining properties with undefined values.
  assert.deepEqual(structuredClone(actual), expected)
}

function attribute(overrides = {}) {
  return Object.freeze({
    displayName: 'Age',
    attributeName: 'age',
    isChecked: true,
    value: '18',
    condition: '',
    options: [],
    dataType: 'number',
    schemaName: 'Identity',
    schemaId: 'schema-identity',
    credDefId: 'cred-def-identity',
    selectedOption: '>=',
    inputError: '',
    selectError: '',
    ...overrides,
  })
}

function baseAttribute({ attributeName, credDefId, schemaId }) {
  return { attributeName, credDefId, schemaId }
}

function uuidFixture() {
  const calls = []
  return {
    calls,
    uuid: () => {
      const id = `00000000-0000-4000-8000-${String(calls.length + 1).padStart(12, '0')}`
      calls.push(id)
      return id
    },
  }
}

function descriptor(id, name, uri, attributeNames) {
  return {
    id,
    name,
    schema: [{ uri }],
    constraints: {
      fields: [
        { path: attributeNames.map((name) => `$.credentialSubject['${name}']`) },
      ],
    },
    purpose: 'Verify proof',
  }
}

test('CSV template is a header-only file with no connection IDs', () => {
  assert.equal(CSV_TEMPLATE_CONTENT, 'connectionId\n')
  assertPayload(parseCsvConnectionIds(CSV_TEMPLATE_CONTENT), [])
})

for (const { name, content, expected } of [
  {
    name: 'header with LF rows',
    content: 'connectionId\nconnection-a\nconnection-b\n',
    expected: ['connection-a', 'connection-b'],
  },
  {
    name: 'no header preserves the first ID',
    content: 'connection-a\nconnection-b',
    expected: ['connection-a', 'connection-b'],
  },
  {
    name: 'CRLF, case-insensitive header, whitespace and blank rows',
    content: '\r\n  CoNnEcTiOnId  \r\n connection-a \r\n \r\nconnection-b\r\n',
    expected: ['connection-a', 'connection-b'],
  },
  {
    name: 'no-header CRLF rows are trimmed',
    content: ' connection-a \r\n\r\n connection-b \r\n',
    expected: ['connection-a', 'connection-b'],
  },
  { name: 'empty input', content: '', expected: [] },
  { name: 'whitespace-only input', content: ' \t\r\n\n ', expected: [] },
  {
    name: 'only the first comma-separated cell is used',
    content: 'connectionId,label\n connection-a ,Alice\n,ignored\nconnection-b,Bob',
    expected: ['connection-a', 'connection-b'],
  },
  {
    name: 'duplicates and arbitrary nonempty IDs are preserved, not validated',
    content: 'connection-a\nconnection-a\nnot-a-uuid',
    expected: ['connection-a', 'connection-a', 'not-a-uuid'],
  },
]) {
  test(`parseCsvConnectionIds: ${name}`, () => {
    assertPayload(parseCsvConnectionIds(content), expected)
  })
}

test('mapCheckedAttributes filters unchecked attributes and preserves checked order', () => {
  const first = attribute({ attributeName: 'name', dataType: 'string' })
  const second = attribute({ attributeName: 'country', dataType: 'string' })
  const input = Object.freeze([first, attribute({ isChecked: false }), second])

  assertPayload(mapCheckedAttributes(input), [
    baseAttribute(first),
    baseAttribute(second),
  ])
})

for (const { name, overrides, predicate } of [
  { name: 'numeric predicate retains its string value', overrides: {}, predicate: true },
  { name: 'zero string is a predicate value', overrides: { value: '0' }, predicate: true },
  { name: 'Select placeholder omits predicate', overrides: { selectedOption: 'Select' }, predicate: false },
  { name: 'empty selection omits predicate', overrides: { selectedOption: '' }, predicate: false },
  { name: 'empty value omits predicate', overrides: { value: '' }, predicate: false },
  { name: 'nonnumeric attribute omits predicate', overrides: { dataType: 'string' }, predicate: false },
]) {
  test(`mapCheckedAttributes: ${name}`, () => {
    const input = attribute(overrides)
    const expected = baseAttribute(input)
    if (predicate) {
      expected.condition = input.selectedOption
      expected.value = input.value
    }

    assertPayload(mapCheckedAttributes(Object.freeze([input])), [expected])
  })
}

test('attribute mappings return empty arrays for empty or entirely unchecked input', () => {
  for (const map of [mapCheckedAttributes, checkedW3cAttributes]) {
    assertPayload(map([]), [])
    assertPayload(map([attribute({ isChecked: false })]), [])
  }
})

test('mapCheckedAttributes preserves an absent optional credential definition ID', () => {
  const input = attribute({ credDefId: undefined, dataType: 'string' })

  assertPayload(mapCheckedAttributes([input]), [baseAttribute(input)])
})

test('checkedW3cAttributes filters and projects only the W3C mapping fields', () => {
  const input = Object.freeze([
    attribute(),
    attribute({ attributeName: 'hidden', isChecked: false }),
    attribute({ attributeName: 'degree', schemaName: 'Education', schemaId: 'schema-education' }),
  ])

  assertPayload(checkedW3cAttributes(input), [
    { attributeName: 'age', schemaId: 'schema-identity', schemaName: 'Identity' },
    { attributeName: 'degree', schemaId: 'schema-education', schemaName: 'Education' },
  ])
})

for (const connectionIds of [['connection-a'], ['connection-a', 'connection-b']]) {
  const expectedConnection = connectionIds.length === 1 ? connectionIds[0] : connectionIds

  test(`generateNonW3CCredential builds the complete payload for ${connectionIds.length} connection(s)`, () => {
    const attributes = Object.freeze([
      Object.freeze({ attributeName: 'age', credDefId: 'cred-def-identity', schemaId: 'schema-identity', condition: '>=', value: '18' }),
    ])

    assertPayload(generateNonW3CCredential(Object.freeze(connectionIds), attributes, 'org-a'), {
      connectionId: expectedConnection,
      orgId: 'org-a',
      proofFormats: { indy: { attributes } },
      comment: 'string',
    })
  })

  test(`generateW3CCredential groups by schema name for ${connectionIds.length} connection(s) using injected UUIDs`, () => {
    const input = Object.freeze([
      Object.freeze({ attributeName: 'age', schemaId: 'schema-identity', schemaName: 'Identity' }),
      Object.freeze({ attributeName: 'degree', schemaId: 'schema-education', schemaName: 'Education' }),
      Object.freeze({ attributeName: 'name', schemaId: 'schema-identity', schemaName: 'Identity' }),
    ])
    const fixture = uuidFixture()
    const actual = generateW3CCredential(Object.freeze(connectionIds), input, fixture.uuid)

    assert.equal(fixture.calls.length, 3)
    assertPayload(actual, {
      connectionId: expectedConnection,
      comment: 'proof request',
      presentationDefinition: {
        id: fixture.calls[0],
        purpose: 'proof request',
        input_descriptors: [
          descriptor(fixture.calls[1], 'Identity', 'schema-identity', ['age', 'name']),
          descriptor(fixture.calls[2], 'Education', 'schema-education', ['degree']),
        ],
      },
    })
    const repeated = uuidFixture()
    assertPayload(generateW3CCredential(connectionIds, input, repeated.uuid), structuredClone(actual))
    assert.deepEqual(repeated.calls, fixture.calls)
  })
}

test('W3C grouping uses schema name and the first matching schema URI', () => {
  const fixture = uuidFixture()
  const actual = generateW3CCredential(['connection-a'], [
    { attributeName: 'age', schemaId: 'schema-first', schemaName: 'Identity' },
    { attributeName: 'name', schemaId: 'schema-second', schemaName: 'Identity' },
  ], fixture.uuid)

  assert.equal(fixture.calls.length, 2)
  assertPayload(actual.presentationDefinition.input_descriptors, [
    descriptor(fixture.calls[1], 'Identity', 'schema-first', ['age', 'name']),
  ])
})

test('empty payload inputs remain empty and W3C still requests a definition UUID', () => {
  assertPayload(generateNonW3CCredential([], [], 'org-a'), {
    connectionId: [],
    orgId: 'org-a',
    proofFormats: { indy: { attributes: [] } },
    comment: 'string',
  })
  const fixture = uuidFixture()
  const actual = generateW3CCredential([], [], fixture.uuid)

  assert.equal(fixture.calls.length, 1)
  assertPayload(actual, {
    connectionId: [],
    comment: 'proof request',
    presentationDefinition: {
      id: fixture.calls[0],
      purpose: 'proof request',
      input_descriptors: [],
    },
  })
})