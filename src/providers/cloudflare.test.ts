import { afterEach, describe, expect, test } from "bun:test"
import { CloudflareClient } from "./cloudflare.ts"

const realFetch = globalThis.fetch

function setFetch(handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>) {
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
}

function envelope(result: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe("CloudflareClient", () => {
  test("paginates Pages projects at Cloudflare's ten-project limit", async () => {
    const requested: string[] = []
    const firstPage = Array.from({ length: 10 }, (_, index) => ({ name: `project-${index + 1}` }))
    const secondPage = [{ name: "project-11" }]

    setFetch(async (input) => {
      const url = String(input)
      requested.push(url)
      return envelope(url.includes("page=2") ? secondPage : firstPage)
    })

    const result = await new CloudflareClient("token", "account-id").fetchPages()

    expect(result.sites).toHaveLength(11)
    expect(requested).toEqual([
      "https://api.cloudflare.com/client/v4/accounts/account-id/pages/projects?page=1&per_page=10",
      "https://api.cloudflare.com/client/v4/accounts/account-id/pages/projects?page=2&per_page=10",
    ])
  })

  test("normalizes deployment detail and duration", async () => {
    setFetch(async () =>
      envelope([
        {
          name: "example-project",
          latest_deployment: {
            id: "deployment-id",
            url: "https://deployment.example.test",
            environment: "production",
            created_on: "2026-08-24T10:00:00.000Z",
            latest_stage: {
              name: "deploy",
              status: "success",
              started_on: "2026-08-24T10:00:01.000Z",
              ended_on: "2026-08-24T10:00:12.000Z",
            },
            deployment_trigger: {
              type: "ad_hoc",
              metadata: {
                branch: "main",
                commit_hash: "0123456789abcdef",
                commit_message: "Deploy the current build",
              },
            },
          },
        },
      ]))

    const result = await new CloudflareClient("token", "account-id").fetchPages()
    const deployment = result.deploys[0]

    expect(deployment).toMatchObject({
      id: "deployment-id",
      siteId: "example-project",
      status: "ready",
      branch: "main",
      target: "production",
      commitHash: "0123456789abcdef",
      trigger: "ad_hoc",
      durationMs: 11_000,
      inspectorUrl: null,
    })
  })

  test("surfaces Cloudflare API error messages", async () => {
    setFetch(async () =>
      new Response(JSON.stringify({ success: false, errors: [{ message: "Token lacks permission" }], result: null }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }))

    await expect(new CloudflareClient("token", "account-id").fetchPages()).rejects.toThrow(
      "Cloudflare API error (403): Token lacks permission",
    )
  })
})
