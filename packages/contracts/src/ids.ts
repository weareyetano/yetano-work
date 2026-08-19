import Type from 'typebox'

function uuidSchema(title: string, description: string) {
  return Type.String({
    description,
    format: 'uuid',
    title,
  })
}

export const CaseIdSchema = uuidSchema('CaseId', 'Unique identifier of a case.')
export const CustomerIdSchema = uuidSchema(
  'CustomerId',
  'Soft cross-module reference to a customer.',
)
export const OrganizationIdSchema = uuidSchema(
  'OrganizationId',
  'Organization scope assigned by the server.',
)

export type CaseId = Type.Static<typeof CaseIdSchema>
export type CustomerId = Type.Static<typeof CustomerIdSchema>
export type OrganizationId = Type.Static<typeof OrganizationIdSchema>
