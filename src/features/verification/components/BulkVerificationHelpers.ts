import { IAttributeMapping, ISelectedAttributes } from '../type/interface'

export interface FilteredAttribute {
  attributeName: string
  credDefId?: string
  schemaId?: string
  condition?: string
  value?: string
}

export interface CheckedW3CAttribute {
  attributeName: string
  schemaId: string
  schemaName: string
}

export interface IMatchedConnection {
  connectionId: string
  theirLabel: string
  createDateTime: string
}

export const CSV_TEMPLATE_CONTENT = 'connectionId\n'

/**
 * Parses a simple, single-column CSV file (optionally with a `connectionId`
 * header row) into a flat list of trimmed connection ID strings.
 */
export const parseCsvConnectionIds = (content: string): string[] => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const [firstLine, ...restLines] = lines
  const firstCell = firstLine.split(',')[0]?.trim().toLowerCase()
  const dataLines = firstCell === 'connectionid' ? restLines : lines

  return dataLines
    .map((line) => line.split(',')[0]?.trim())
    .filter((id): id is string => Boolean(id))
}

export const mapCheckedAttributes = (
  attributeData: ISelectedAttributes[],
): FilteredAttribute[] =>
  attributeData
    .filter((attribute: ISelectedAttributes) => attribute.isChecked)
    .map((attribute: ISelectedAttributes) => {
      const basePayload: FilteredAttribute = {
        attributeName: attribute.attributeName,
        credDefId: attribute.credDefId,
        schemaId: attribute.schemaId,
      }

      if (
        attribute.dataType === 'number' &&
        attribute.selectedOption !== 'Select' &&
        attribute?.selectedOption !== '' &&
        attribute?.value !== ''
      ) {
        return {
          ...basePayload,
          condition: attribute.selectedOption,
          value: attribute.value,
        }
      }

      return basePayload
    })

export const checkedW3cAttributes = (
  attributeData: ISelectedAttributes[],
): IAttributeMapping[] =>
  attributeData
    .filter(
      (w3cSchemaAttributes: ISelectedAttributes) =>
        w3cSchemaAttributes.isChecked,
    )
    .map((attribute: ISelectedAttributes) => ({
      attributeName: attribute.attributeName,
      schemaId: attribute.schemaId,
      schemaName: attribute.schemaName,
    }))

export const generateNonW3CCredential = (
  connectionIds: string[],
  checkedAttributes: FilteredAttribute[],
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => ({
  connectionId: connectionIds.length === 1 ? connectionIds[0] : connectionIds,
  orgId,
  proofFormats: {
    indy: {
      attributes: checkedAttributes,
    },
  },
  comment: 'string',
})

export const generateW3CCredential = (
  connectionIds: string[],
  checkedW3CAttributes: IAttributeMapping[],
  uuidv4: () => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  const schemas = checkedW3CAttributes.map((attr) => ({
    schemaId: attr.schemaId,
    schemaName: attr.schemaName,
  }))

  const groupedAttributes = checkedW3CAttributes.reduce<
    Record<string, CheckedW3CAttribute[]>
  >((acc, curr) => {
    const { schemaName } = curr
    if (!acc[schemaName]) {
      acc[schemaName] = []
    }
    acc[schemaName].push(curr)
    return acc
  }, {})

  return {
    connectionId: connectionIds.length === 1 ? connectionIds[0] : connectionIds,
    comment: 'proof request',
    presentationDefinition: {
      id: uuidv4(),
      purpose: 'proof request',
      // eslint-disable-next-line camelcase
      input_descriptors: Object.keys(groupedAttributes).map((schemaName) => {
        const attributesForSchema = groupedAttributes[schemaName]

        const attributePathsForSchema = attributesForSchema.map(
          (attr) => `$.credentialSubject['${attr.attributeName}']`,
        )

        return {
          id: uuidv4(),
          name: schemaName,
          schema: [
            {
              uri: schemas.find((schema) => schema.schemaName === schemaName)
                ?.schemaId,
            },
          ],
          constraints: {
            fields: [
              {
                path: attributePathsForSchema,
              },
            ],
          },
          purpose: 'Verify proof',
        }
      }),
    },
  }
}
