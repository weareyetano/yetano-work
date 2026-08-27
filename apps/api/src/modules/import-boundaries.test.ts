import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { applicationModules } from './index.js'

interface ModuleBoundary {
  dependencies: readonly string[]
  directory: string
  id: string
  kind: 'api' | 'web'
}

interface SourceFile {
  path: string
  source: string
}

interface ImportViolation {
  importer: string
  message: string
  specifier: string
}

describe('module import boundaries', () => {
  it('keeps every repository consumer on module public entrypoints', async () => {
    const workspace = resolve(import.meta.dirname, '../../../..')
    const apiSource = join(workspace, 'apps/api/src')
    const webSource = join(workspace, 'apps/web/src')
    const apiModules = await discoverModules(join(apiSource, 'modules'), 'api')
    const webModules = await discoverModules(join(webSource, 'modules'), 'web')
    const dependencies = new Map(
      applicationModules.map((module) => [module.id, module.dependencies] as const),
    )
    const boundaries = [
      ...apiModules.map((module) => ({
        ...module,
        dependencies: dependencies.get(module.id) ?? [],
      })),
      ...webModules.map((module) => ({ ...module, dependencies: [] })),
    ]
    const files = [...(await readSourceFiles(apiSource)), ...(await readSourceFiles(webSource))]

    expect(findImportViolations(files, boundaries)).toEqual([])
  })

  it('allows module-local internals and declared public API dependencies', () => {
    const boundaries = fixtureBoundaries({ activitiesDependencies: ['cases'] })
    const files = fixtureFiles({
      '/repo/apps/api/src/modules/activities/service.ts': `
        import { caseTransitionedEvent } from '../cases/index.js'
        import { helper } from './internal.js'
        export { helper }
      `,
      '/repo/apps/api/src/modules/activities/internal.ts': 'export const helper = true',
      '/repo/apps/api/src/modules/cases/index.ts': `export { value } from './internal.js'`,
      '/repo/apps/api/src/modules/cases/internal.ts': 'export const value = true',
      '/repo/apps/web/src/routes/cases.tsx': `import { CasesPage } from '#modules/cases'`,
    })

    expect(findImportViolations(files, boundaries)).toEqual([])
  })

  it('rejects deep imports, re-exports, dynamic imports, and undeclared module dependencies', () => {
    const boundaries = fixtureBoundaries({ activitiesDependencies: [] })
    const files = fixtureFiles({
      '/repo/apps/api/src/modules/activities/service.ts': `
        import { internal } from '../cases/internal.js'
        export { value } from '../cases/index.js'
        const lazy = import('../cases/private.js')
      `,
      '/repo/apps/api/src/modules/cases/index.ts': 'export const value = true',
      '/repo/apps/api/src/modules/cases/internal.ts': 'export const internal = true',
      '/repo/apps/api/src/modules/cases/private.ts': 'export const privateValue = true',
      '/repo/apps/web/src/routes/cases.tsx': `import { hidden } from '#modules/cases/ui/hidden'`,
    })

    expect(findImportViolations(files, boundaries).map(({ message }) => message)).toEqual([
      'Module activities must import cases through its public index.ts',
      'Module activities must declare a dependency on cases',
      'Module activities must import cases through its public index.ts',
      'Web module imports must use #modules/cases without a deep path',
    ])
  })
})

async function discoverModules(root: string, kind: ModuleBoundary['kind']) {
  const entries = await readdir(root, { withFileTypes: true })
  const modules: Array<Pick<ModuleBoundary, 'directory' | 'id' | 'kind'>> = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const directory = join(root, entry.name)
    const children = await readdir(directory)
    if (!children.includes('index.ts')) continue
    modules.push({ directory, id: entry.name, kind })
  }
  return modules
}

async function readSourceFiles(root: string): Promise<SourceFile[]> {
  const files: SourceFile[] = []
  const visit = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!/\.(?:ts|tsx)$/.test(entry.name) || entry.name === 'routeTree.gen.ts') continue
      files.push({ path, source: await readFile(path, 'utf8') })
    }
  }
  await visit(root)
  return files
}

function findImportViolations(
  files: readonly SourceFile[],
  boundaries: readonly ModuleBoundary[],
): ImportViolation[] {
  const normalizedFiles = new Map(files.map((file) => [normalize(file.path), file]))
  const violations: ImportViolation[] = []

  for (const file of normalizedFiles.values()) {
    const importerBoundary = boundaryForPath(file.path, boundaries)
    for (const specifier of importSpecifiers(file)) {
      if (specifier.startsWith('#modules/')) {
        const [moduleId, ...deepPath] = specifier.slice('#modules/'.length).split('/')
        if (deepPath.length > 0) {
          violations.push({
            importer: file.path,
            message: `Web module imports must use #modules/${moduleId} without a deep path`,
            specifier,
          })
        }
        continue
      }
      if (!specifier.startsWith('.')) continue

      const target = resolveImport(file.path, specifier, normalizedFiles)
      const targetBoundary = boundaryForPath(target, boundaries)
      if (!targetBoundary || targetBoundary === importerBoundary) continue

      if (normalize(target) !== normalize(join(targetBoundary.directory, 'index.ts'))) {
        violations.push({
          importer: file.path,
          message: `${importerBoundary ? `Module ${importerBoundary.id}` : 'External code'} must import ${targetBoundary.id} through its public index.ts`,
          specifier,
        })
        continue
      }

      if (
        importerBoundary?.kind === 'api' &&
        targetBoundary.kind === 'api' &&
        !importerBoundary.dependencies.includes(targetBoundary.id)
      ) {
        violations.push({
          importer: file.path,
          message: `Module ${importerBoundary.id} must declare a dependency on ${targetBoundary.id}`,
          specifier,
        })
      }
    }
  }

  return violations
}

function importSpecifiers(file: SourceFile) {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const specifiers: string[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

function resolveImport(
  importer: string,
  specifier: string,
  files: ReadonlyMap<string, SourceFile>,
) {
  const unresolved = normalize(resolve(dirname(importer), specifier))
  const extension = extname(unresolved)
  const candidates = extension
    ? [
        unresolved,
        `${unresolved.slice(0, -extension.length)}.ts`,
        `${unresolved.slice(0, -extension.length)}.tsx`,
      ]
    : [unresolved, `${unresolved}.ts`, `${unresolved}.tsx`, join(unresolved, 'index.ts')]
  return candidates.find((candidate) => files.has(candidate)) ?? unresolved
}

function boundaryForPath(path: string, boundaries: readonly ModuleBoundary[]) {
  return boundaries.find((boundary) => {
    const child = relative(boundary.directory, path)
    return child === '' || (!child.startsWith(`..${sep}`) && child !== '..')
  })
}

function fixtureBoundaries({ activitiesDependencies }: { activitiesDependencies: string[] }) {
  return [
    {
      dependencies: activitiesDependencies,
      directory: '/repo/apps/api/src/modules/activities',
      id: 'activities',
      kind: 'api' as const,
    },
    {
      dependencies: [],
      directory: '/repo/apps/api/src/modules/cases',
      id: 'cases',
      kind: 'api' as const,
    },
    {
      dependencies: [],
      directory: '/repo/apps/web/src/modules/cases',
      id: 'cases',
      kind: 'web' as const,
    },
  ]
}

function fixtureFiles(files: Record<string, string>): SourceFile[] {
  return Object.entries(files).map(([path, source]) => ({ path, source }))
}
