# Repository instructions

## Documentation

Write all repository documentation in English.

## Git commits

Use Conventional Commits:

```text
<type>(<scope>): <description>
```

Allowed types:

- `feat`
- `fix`
- `refactor`
- `perf`
- `test`
- `docs`
- `build`
- `ci`
- `chore`

Prefer scopes matching workspace packages or modules:

- `web`
- `api`
- `db`
- `contracts`
- `api-client`
- `core`
- `<module-name>`

Keep commits atomic. Do not combine unrelated changes.

Do not commit failing tests or typecheck errors.

Write commit messages in English. Use lowercase descriptions without a trailing period.

Use `!` for breaking changes, for example:

```text
feat(api)!: change contact response format
```
