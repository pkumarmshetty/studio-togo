/* eslint @typescript-eslint/no-var-requires: "off", @typescript-eslint/explicit-function-return-type: "off" */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const ReactDOMServer = require('react-dom/server')
const formik = require('formik')

const moduleExports = {}
const modules = { react: React, formik }
const file = path.resolve(__dirname, '../SchemaVersion.tsx')
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
}).outputText

vm.runInNewContext(compiled, {
  exports: moduleExports,
  require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`)
    return modules[name]
  },
})

const SchemaVersion = moduleExports.default
const automaticVersion = 'draft/2020-12'
const validationError = 'Enter valid schema version (eg. 0.1 or 0.0.1)'

function renderVersion({
  readOnlyValue,
  value = '0.1',
  touched = {},
  errors = {},
  withHandlers = true,
} = {}) {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      formik.Formik,
      {
        initialValues: { schemaVersion: value },
        initialTouched: touched,
        initialErrors: errors,
        onSubmit: () => undefined,
      },
      (handlers) =>
        React.createElement(SchemaVersion, {
          formikHandlers: withHandlers ? handlers : undefined,
          readOnlyValue,
        }),
    ),
  )
  const inputs = html.match(/<input\b[^>]*>/g) || []
  assert.equal(inputs.length, 1)
  const [input] = inputs
  assert.match(input, /\bid="schemaVersion"/)
  assert.match(input, /\bname="schemaVersion"/)
  return { html, input }
}

function assertRequiredLabel(html) {
  const label = html.match(
    /<label\b[^>]*\bfor="schemaVersion"[^>]*>(.*?)<\/label>/,
  )
  assert.ok(label, 'Version label must be associated with the input')
  assert.equal(label[1].replace(/<[^>]*>/g, ''), 'Version*')
}

test('editable Indy version preserves the required label and Formik field', () => {
  const { html, input } = renderVersion({ value: '0.0.1' })

  assertRequiredLabel(html)
  assert.match(input, /\bplaceholder="eg\. 0\.1 or 0\.0\.1"/)
  assert.match(input, /\bvalue="0\.0\.1"/)
  assert.doesNotMatch(input, /\s(?:readonly|disabled)(?:\s|=|\/?>)/i)
})

test('W3C version also displays the required Version* label', () => {
  const { html } = renderVersion({ readOnlyValue: automaticVersion })

  assertRequiredLabel(html)
})

test('W3C version is readOnly but remains enabled and keyboard focusable', () => {
  const { input } = renderVersion({
    readOnlyValue: automaticVersion,
    value: 'stale-indy-version',
  })

  assert.match(input, /\bvalue="draft\/2020-12"/)
  assert.match(input, /\sreadonly=""/i)
  assert.doesNotMatch(input, /\sdisabled(?:\s|=|\/?>)/i)
  assert.doesNotMatch(input, /\btabindex="-\d+"/i)
})

test('W3C version has visible automatic-version help linked to the input', () => {
  const { html, input } = renderVersion({ readOnlyValue: automaticVersion })
  const helper = html.match(
    /<(p|span)\b([^>]*)>Automatically assigned for W3C credential schemas\.?<\/\1>/,
  )

  assert.ok(helper, 'Automatic-version explanation must be visible text')
  assert.doesNotMatch(helper[2], /\b(?:aria-hidden="true"|hidden)/)
  const id = helper[2].match(/\bid="([^"]+)"/)
  assert.ok(id, 'Helper must have an accessible description target')
  assert.ok(input.includes(`aria-describedby="${id[1]}"`))
})

test('editable touched version displays its validation error', () => {
  const { html } = renderVersion({
    touched: { schemaVersion: true },
    errors: { schemaVersion: validationError },
  })

  assert.ok(html.includes(validationError))
  assert.doesNotMatch(html, /aria-hidden="true"/)
})

test('editable untouched version hides its validation error', () => {
  const { html } = renderVersion({
    errors: { schemaVersion: validationError },
  })

  assert.ok(!html.includes(validationError))
  assert.match(html, /<span\b[^>]*aria-hidden="true"/)
})

test('editable touched version without an error preserves the spacer', () => {
  const { html } = renderVersion({ touched: { schemaVersion: true } })

  assert.match(html, /<span\b[^>]*aria-hidden="true"/)
})

test('W3C version ignores stale touched Formik errors', () => {
  const { html, input } = renderVersion({
    readOnlyValue: automaticVersion,
    touched: { schemaVersion: true },
    errors: { schemaVersion: validationError },
  })

  assert.ok(!html.includes(validationError))
  assert.match(input, /\bvalue="draft\/2020-12"/)
})

test('editable version supports omitted optional validation handlers', () => {
  const { html, input } = renderVersion({ withHandlers: false })

  assertRequiredLabel(html)
  assert.match(input, /\bvalue="0\.1"/)
  assert.match(html, /<span\b[^>]*aria-hidden="true"/)
})

test('an empty readOnlyValue still selects read-only mode without handlers', () => {
  const { input } = renderVersion({ readOnlyValue: '', withHandlers: false })

  assert.match(input, /\bvalue=""/)
  assert.match(input, /\sreadonly=""/i)
  assert.doesNotMatch(input, /\bplaceholder=/)
})
