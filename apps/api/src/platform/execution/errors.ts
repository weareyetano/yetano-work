export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication is required.')
  }
}

export class AuthorizationDeniedError extends Error {
  constructor(readonly capability: string) {
    super(`Missing required capability: ${capability}`)
  }
}
