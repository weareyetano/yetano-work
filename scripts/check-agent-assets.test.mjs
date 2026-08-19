import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { validateAgentAssets } from './check-agent-assets.mjs'

const skills = ['yetano-api-slice', 'yetano-code-review', 'yetano-verify']

function canonicalSkill(
  name,
  description = 'Use this repository workflow when its matching task is requested.',
) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# Workflow\n`
}

function claudeAdapter(
  name,
  description = 'Use this repository workflow when its matching task is requested.',
) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# Canonical workflow\n\nRead and follow [the canonical Yetano skill](../../../.agents/skills/${name}/SKILL.md), including its referenced resources. Treat it as authoritative.\n`
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yetano-agents-'))
  const routes = skills.map((name) => `.agents/skills/${name}/SKILL.md`).join('\n')
  await writeFile(path.join(root, 'AGENTS.md'), routes)
  await writeFile(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n')

  for (const nested of ['apps/api', 'apps/web', 'packages/contracts']) {
    await mkdir(path.join(root, nested), { recursive: true })
    await writeFile(path.join(root, nested, 'AGENTS.md'), '# Instructions\n')
    await writeFile(path.join(root, nested, 'CLAUDE.md'), '@AGENTS.md\n')
  }

  for (const name of skills) {
    const skillRoot = path.join(root, '.agents/skills', name)
    const claudeSkillRoot = path.join(root, '.claude/skills', name)
    await mkdir(skillRoot, { recursive: true })
    await mkdir(claudeSkillRoot, { recursive: true })
    await writeFile(path.join(skillRoot, 'SKILL.md'), canonicalSkill(name))
    await writeFile(path.join(claudeSkillRoot, 'SKILL.md'), claudeAdapter(name))
  }

  return root
}

test('accepts a valid agent asset tree', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  assert.deepEqual(await validateAgentAssets(root), [])
})

test('catches a missing task-router entry', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(path.join(root, 'AGENTS.md'), '.agents/skills/yetano-verify/SKILL.md\n')
  assert.ok((await validateAgentAssets(root)).some((error) => error.includes('task router')))
})

test('catches invalid frontmatter', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(path.join(root, '.agents/skills/yetano-verify/SKILL.md'), '# Missing metadata\n')
  assert.ok((await validateAgentAssets(root)).some((error) => error.includes('frontmatter')))
})

test('catches a missing referenced resource', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  const skillPath = path.join(root, '.agents/skills/yetano-verify/SKILL.md')
  await writeFile(
    skillPath,
    `---\nname: yetano-verify\ndescription: Verify repository changes with evidence and explicit outcomes.\n---\n\n[Gate](references/missing.md)\n`,
  )
  assert.ok(
    (await validateAgentAssets(root)).some((error) => error.includes('referenced resource')),
  )
})

test('catches an oversized root instruction file', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(path.join(root, 'AGENTS.md'), 'x'.repeat(12 * 1024 + 1))
  assert.ok((await validateAgentAssets(root)).some((error) => error.includes('byte limit')))
})

for (const relativePath of ['CLAUDE.md', 'apps/api/CLAUDE.md']) {
  test(`catches a missing ${relativePath}`, async (context) => {
    const root = await fixture()
    context.after(() => rm(root, { force: true, recursive: true }))
    await rm(path.join(root, relativePath))
    assert.ok(
      (await validateAgentAssets(root)).some(
        (error) => error.includes(relativePath) && error.includes('missing'),
      ),
    )
  })
}

test('catches a missing Claude skill adapter', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  await rm(path.join(root, '.claude/skills/yetano-verify'), { recursive: true })
  assert.ok(
    (await validateAgentAssets(root)).some(
      (error) => error.includes('yetano-verify') && error.includes('missing adapter'),
    ),
  )
})

test('catches a stale Claude skill adapter', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  const staleRoot = path.join(root, '.claude/skills/stale-skill')
  await mkdir(staleRoot, { recursive: true })
  await writeFile(path.join(staleRoot, 'SKILL.md'), claudeAdapter('stale-skill'))
  assert.ok((await validateAgentAssets(root)).some((error) => error.includes('stale adapter')))
})

test('catches Claude adapter metadata drift', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(
    path.join(root, '.claude/skills/yetano-verify/SKILL.md'),
    claudeAdapter('yetano-verify', 'A different description that no longer matches canonical.'),
  )
  assert.ok(
    (await validateAgentAssets(root)).some((error) => error.includes('description must match')),
  )
})

test('catches a Claude adapter name mismatch', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  const adapter = claudeAdapter('yetano-verify').replace('name: yetano-verify', 'name: wrong-name')
  await writeFile(path.join(root, '.claude/skills/yetano-verify/SKILL.md'), adapter)
  assert.ok(
    (await validateAgentAssets(root)).some((error) =>
      error.includes('frontmatter name must equal'),
    ),
  )
})

test('catches a misdirected Claude adapter body', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  const adapter = claudeAdapter('yetano-verify').replace(
    '.agents/skills/yetano-verify/SKILL.md',
    '.agents/skills/yetano-code-review/SKILL.md',
  )
  await writeFile(path.join(root, '.claude/skills/yetano-verify/SKILL.md'), adapter)
  assert.ok(
    (await validateAgentAssets(root)).some((error) =>
      error.includes('metadata-only canonical adapter'),
    ),
  )
})

test('catches a copied workflow in a Claude adapter body', async (context) => {
  const root = await fixture()
  context.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(
    path.join(root, '.claude/skills/yetano-verify/SKILL.md'),
    `${claudeAdapter('yetano-verify')}\n## Duplicated workflow\n\nRun every test.\n`,
  )
  assert.ok(
    (await validateAgentAssets(root)).some((error) =>
      error.includes('metadata-only canonical adapter'),
    ),
  )
})
