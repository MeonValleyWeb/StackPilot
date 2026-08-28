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

  test("normalizes Zone and Registrar operational details", async () => {
    setFetch(async (input) => {
      const url = String(input)
      if (url.endsWith("/zones?per_page=50")) {
        return envelope([
          {
            id: "zone-id",
            name: "example.test",
            status: "active",
            paused: true,
            plan: { name: "Pro" },
            type: "full",
            created_on: "2026-01-01T00:00:00.000Z",
            activated_on: "2026-01-02T00:00:00.000Z",
            modified_on: "2026-08-28T10:00:00.000Z",
            development_mode: 120,
            name_servers: ["ns1.example.test", "ns2.example.test"],
            original_registrar: "Example Registrar",
            original_dnshost: "Example DNS",
          },
        ])
      }
      if (url.endsWith("/accounts/account-id/registrar/domains")) {
        return envelope([
          {
            name: "example.test",
            expires_at: "2027-08-28T00:00:00.000Z",
            auto_renew: true,
            locked: true,
            status: "active",
          },
          { name: null },
        ])
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const client = new CloudflareClient("token", "account-id")

    await expect(client.listZones()).resolves.toEqual([
      {
        id: "zone-id",
        name: "example.test",
        status: "paused",
        paused: true,
        plan: "Pro",
        type: "full",
        createdOn: "2026-01-01T00:00:00.000Z",
        activatedOn: "2026-01-02T00:00:00.000Z",
        modifiedOn: "2026-08-28T10:00:00.000Z",
        developmentMode: 120,
        nameServers: ["ns1.example.test", "ns2.example.test"],
        originalRegistrar: "Example Registrar",
        originalDnsHost: "Example DNS",
      },
    ])
    await expect(client.listRegistrarDomains()).resolves.toEqual([
      {
        name: "example.test",
        expiresAt: "2027-08-28T00:00:00.000Z",
        autoRenew: true,
        locked: true,
        status: "active",
      },
    ])
  })

  test("joins Worker domains and normalizes deployment history", async () => {
    setFetch(async (input) => {
      const url = String(input)
      if (url.endsWith("/accounts/account-id/workers/scripts")) {
        return envelope([
          {
            id: "example-worker",
            modified_on: "2026-08-28T10:00:00.000Z",
            created_on: "2026-01-01T00:00:00.000Z",
            compatibility_date: "2026-08-01",
            handlers: ["fetch"],
            has_assets: true,
            has_modules: true,
            last_deployed_from: "wrangler",
            usage_model: "standard",
          },
        ])
      }
      if (url.endsWith("/accounts/account-id/workers/domains")) {
        return envelope([
          { hostname: "worker.example.test", service: "example-worker" },
          { hostname: "other.example.test", service: "other-worker" },
        ])
      }
      if (url.endsWith("/accounts/account-id/workers/scripts/example-worker/deployments")) {
        return envelope({
          deployments: [
            {
              id: "worker-deployment-id",
              created_on: "2026-08-28T11:00:00.000Z",
              source: "wrangler",
              strategy: "percentage",
              author_email: "operator@example.test",
              annotations: {
                "workers/message": "Deploy current build",
                "workers/triggered_by": "upload",
              },
              versions: [
                { percentage: 100, version_id: "version-id" },
                { percentage: 0, version_id: null },
              ],
            },
          ],
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const client = new CloudflareClient("token", "account-id")

    await expect(client.listWorkers()).resolves.toEqual([
      {
        id: "example-worker",
        modifiedOn: "2026-08-28T10:00:00.000Z",
        createdOn: "2026-01-01T00:00:00.000Z",
        compatibilityDate: "2026-08-01",
        handlers: ["fetch"],
        hasAssets: true,
        hasModules: true,
        lastDeployedFrom: "wrangler",
        usageModel: "standard",
        domains: ["worker.example.test"],
      },
    ])
    await expect(client.listWorkerDeployments("example-worker")).resolves.toEqual([
      {
        id: "worker-deployment-id",
        createdOn: "2026-08-28T11:00:00.000Z",
        source: "wrangler",
        strategy: "percentage",
        authorEmail: "operator@example.test",
        message: "Deploy current build",
        triggeredBy: "upload",
        versions: [{ percentage: 100, versionId: "version-id" }],
      },
    ])
  })

  test("encodes Pages project names and selects the configured account name", async () => {
    setFetch(async (input) => {
      const url = String(input)
      if (url.endsWith("/accounts/account-id/pages/projects/example%2Fproject/deployments?per_page=20")) {
        return envelope([
          {
            id: "deployment-id",
            environment: "preview",
            created_on: "2026-08-28T12:00:00.000Z",
            latest_stage: { name: "deploy", status: "success" },
          },
        ])
      }
      if (url.endsWith("/accounts")) {
        return envelope([
          { id: "other-account", name: "Other Account" },
          { id: "account-id", name: "Example Account" },
        ])
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const client = new CloudflareClient("token", "account-id")

    await expect(client.listDeployments("example/project")).resolves.toEqual([
      expect.objectContaining({
        id: "deployment-id",
        siteId: "example/project",
        status: "ready",
        target: "preview",
      }),
    ])
    await expect(client.getAccountName()).resolves.toBe("Example Account")
  })

  test("keeps Worker data usable when the optional domains request fails", async () => {
    setFetch(async (input) => {
      const url = String(input)
      if (url.endsWith("/accounts/account-id/workers/scripts")) return envelope([{ id: "example-worker" }])
      if (url.endsWith("/accounts/account-id/workers/domains")) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: "Not permitted" }] }), {
          status: 403,
          headers: { "content-type": "application/json" },
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    await expect(new CloudflareClient("token", "account-id").listWorkers()).resolves.toEqual([
      expect.objectContaining({ id: "example-worker", domains: [] }),
    ])
  })
})
