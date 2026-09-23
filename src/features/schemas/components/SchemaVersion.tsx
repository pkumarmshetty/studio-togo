import { Field, FormikProps } from 'formik'
import React, { JSX } from 'react'

import { IFormData } from '../type/schemas-interface'

interface SchemaVersionProps {
  readonly formikHandlers?: FormikProps<IFormData>
  readonly readOnlyValue?: string
}

function SchemaVersion({
  formikHandlers,
  readOnlyValue,
}: SchemaVersionProps): JSX.Element {
  const isReadOnly = readOnlyValue !== undefined
  const inputProps = {
    id: 'schemaVersion',
    name: 'schemaVersion',
    className:
      'border-input file:text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
  }

  return (
    <div
      className="flex-col sm:w-full md:flex md:w-96"
      style={{ marginLeft: 0 }}
    >
      <div>
        <label
          htmlFor="schemaVersion"
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Version<span className="text-destructive">*</span>
        </label>
      </div>

      <div className="flex-col md:flex">
        {isReadOnly ? (
          <input
            {...inputProps}
            value={readOnlyValue}
            readOnly
            aria-describedby="schemaVersionHelp"
          />
        ) : (
          <Field {...inputProps} placeholder="eg. 0.1 or 0.0.1" />
        )}
        {isReadOnly ? (
          <p
            id="schemaVersionHelp"
            className="text-muted-foreground min-h-5 text-xs"
          >
            Automatically assigned for W3C credential schemas
          </p>
        ) : formikHandlers?.touched.schemaVersion &&
          formikHandlers?.errors.schemaVersion ? (
          <label
            htmlFor="schemaVersion"
            className="text-destructive h-5 text-xs"
          >
            {formikHandlers.errors.schemaVersion}
          </label>
        ) : (
          <span aria-hidden="true" className="text-destructive h-5 text-xs">
            &nbsp;
          </span>
        )}
      </div>
    </div>
  )
}

export default SchemaVersion
