export interface ClientOptions {
  token: string
  baseUrl: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export class StackPilotClient {
  constructor(_opts: ClientOptions) {}
}
