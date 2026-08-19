import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT_INSTRUCTIONS_LIMIT = 12 * 1024
const SKILL_LINE_LIMIT = 150
const REQUIRED_INSTRUCTIONS = [
  'apps/api/AGENTS.md',
  'apps/web/AGENTS.md',
  'packages/contracts/AGENTS.md',
]
const REQUIRED_CLAUDE_INSTRUCTIONS = [
  'CLAUDE.md',
  'apps/api/CLAUDE.md',
  'apps/web/CLAUDE.md',
  'packages/contracts/CLAUDE.md',
]
const REQUIRED_SKILLS = ['yetano-api-slice', 'yetano-code-review', 'yetano-verify']

async function readable(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function parseFrontmatter(content, relativePath, errors) {
  const normalized = content.replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n')) {
    errors.push(`${relativePath}: missing YAML frontmatter`)
    return { body: normalized, fields: new Map() }
  }

  const end = normalized.indexOf('\n---\n', 4)
  if (end === -1) {
    errors.push(`${relativePath}: frontmatter is not closed`)
    return { body: normalized, fields: new Map() }
  }

  const fields = new Map()
  for (const line of normalized.slice(4, end).split('\n')) {
    const match = line.match(/^([a-z][a-z0-9_-]*):\s*(.+)$/)
    if (!match) {
      errors.push(`${relativePath}: invalid frontmatter line "${line}"`)
      continue
    }
    fields.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2').trim())
  }

  return { body: normalized.slice(end + 5).replace(/^\n/, ''), fields }
}

async function directoryNames(directoryPath, relativePath, errors) {
  try {
    return (await readdir(directoryPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch {
    errors.push(`${relativePath}: missing directory`)
    return []
  }
}

function expectedClaudeAdapterBody(skillName) {
  return `# Canonical workflow\n\nRead and follow [the canonical Yetano skill](../../../.agents/skills/${skillName}/SKILL.md), including its referenced resources. Treat it as authoritative.\n`
}

export async function validateAgentAssets(root) {
  const errors = []
  const rootInstructionsPath = path.join(root, 'AGENTS.md')
  let rootInstructions = ''

  try {
    rootInstructions = await readFile(rootInstructionsPath, 'utf8')
    const size = Buffer.byteLength(rootInstructions)
    if (size > ROOT_INSTRUCTIONS_LIMIT) {
      errors.push(`AGENTS.md: ${size} bytes exceeds the ${ROOT_INSTRUCTIONS_LIMIT}-byte limit`)
    }
  } catch {
    errors.push('AGENTS.md: missing root instructions')
  }

  for (const relativePath of REQUIRED_INSTRUCTIONS) {
    if (!(await readable(path.join(root, relativePath)))) {
      errors.push(`${relativePath}: missing layered instructions`)
    }
  }

  for (const relativePath of REQUIRED_CLAUDE_INSTRUCTIONS) {
    try {
      const content = await readFile(path.join(root, relativePath), 'utf8')
      if (content.trim() !== '@AGENTS.md') {
        errors.push(`${relativePath}: adapter must contain only @AGENTS.md`)
      }
    } catch {
      errors.push(`${relativePath}: missing Claude Code instruction adapter`)
    }
  }

  const skillsRoot = path.join(root, '.agents/skills')
  const skillNames = await directoryNames(skillsRoot, '.agents/skills', errors)
  const claudeSkillsRoot = path.join(root, '.claude/skills')
  const claudeSkillNames = await directoryNames(claudeSkillsRoot, '.claude/skills', errors)

  for (const requiredSkill of REQUIRED_SKILLS) {
    if (!skillNames.includes(requiredSkill)) {
      errors.push(`.agents/skills/${requiredSkill}: missing required skill`)
    }
  }

  for (const claudeSkillName of claudeSkillNames) {
    if (!skillNames.includes(claudeSkillName)) {
      errors.push(`.claude/skills/${claudeSkillName}: stale adapter has no canonical skill`)
    }
  }

  for (const skillName of skillNames) {
    const relativeSkillPath = `.agents/skills/${skillName}/SKILL.md`
    const skillPath = path.join(root, relativeSkillPath)
    let content

    try {
      content = await readFile(skillPath, 'utf8')
    } catch {
      errors.push(`${relativeSkillPath}: missing skill instructions`)
      continue
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) {
      errors.push(`${relativeSkillPath}: directory name must use lowercase kebab-case`)
    }

    const lineCount = content.replaceAll('\r\n', '\n').split('\n').length
    if (lineCount > SKILL_LINE_LIMIT) {
      errors.push(
        `${relativeSkillPath}: ${lineCount} lines exceeds the ${SKILL_LINE_LIMIT}-line limit`,
      )
    }

    const { body, fields } = parseFrontmatter(content, relativeSkillPath, errors)
    if (fields.get('name') !== skillName) {
      errors.push(`${relativeSkillPath}: frontmatter name must equal "${skillName}"`)
    }
    const description = fields.get('description')
    if (!description || description.length < 20 || description.length > 350) {
      errors.push(`${relativeSkillPath}: description must contain 20-350 characters`)
    }

    const routerPath = `.agents/skills/${skillName}/SKILL.md`
    if (!rootInstructions.includes(routerPath)) {
      errors.push(`AGENTS.md: task router does not reference ${routerPath}`)
    }

    for (const match of body.matchAll(/\]\(((?:references|scripts)\/[^)#\s]+)(?:#[^)]*)?\)/g)) {
      const resourcePath = path.resolve(path.dirname(skillPath), match[1])
      const skillDirectory = `${path.resolve(path.dirname(skillPath))}${path.sep}`
      if (!resourcePath.startsWith(skillDirectory) || !(await readable(resourcePath))) {
        errors.push(`${relativeSkillPath}: referenced resource does not exist: ${match[1]}`)
      }
    }

    const relativeClaudePath = `.claude/skills/${skillName}/SKILL.md`
    let claudeContent
    try {
      claudeContent = await readFile(path.join(root, relativeClaudePath), 'utf8')
    } catch {
      errors.push(`${relativeClaudePath}: missing adapter for canonical skill`)
      continue
    }

    const { body: claudeBody, fields: claudeFields } = parseFrontmatter(
      claudeContent,
      relativeClaudePath,
      errors,
    )
    if (claudeFields.get('name') !== skillName) {
      errors.push(`${relativeClaudePath}: frontmatter name must equal "${skillName}"`)
    }
    if (claudeFields.get('description') !== description) {
      errors.push(`${relativeClaudePath}: description must match the canonical skill`)
    }
    if (claudeBody !== expectedClaudeAdapterBody(skillName)) {
      errors.push(`${relativeClaudePath}: body must be the metadata-only canonical adapter`)
    }
  }

  return errors
}

async function main() {
  const rootFlag = process.argv.indexOf('--root')
  const root =
    rootFlag === -1
      ? path.resolve(import.meta.dirname, '..')
      : path.resolve(process.argv[rootFlag + 1])
  const errors = await validateAgentAssets(root)

  if (errors.length > 0) {
    console.error(`Agent asset validation failed with ${errors.length} error(s):`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log('Agent assets OK: layered instructions and repository skills are valid.')
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main()
}
