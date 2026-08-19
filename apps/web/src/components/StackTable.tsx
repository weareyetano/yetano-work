import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'

interface StackArea {
  area: string
  detail: string
  status: string
}

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, StackArea>()
const columns = columnHelper.columns([
  columnHelper.accessor('area', { header: 'Warstwa' }),
  columnHelper.accessor('detail', { header: 'Technologie' }),
  columnHelper.accessor('status', {
    cell: ({ getValue }) => <span className="table-status">{getValue()}</span>,
    header: 'Stan',
  }),
])
const data: StackArea[] = [
  { area: 'Frontend', detail: 'React · Vite · TanStack', status: 'Gotowe' },
  { area: 'API', detail: 'Hono · TypeBox · OpenAPI', status: 'Gotowe' },
  { area: 'Dane', detail: 'MikroORM · PostgreSQL', status: 'Gotowe' },
]

export function StackTable() {
  const table = useTable({ columns, data, features })

  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} scope="col">
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
