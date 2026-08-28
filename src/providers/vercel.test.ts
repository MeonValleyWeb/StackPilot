import { afterEach, describe, expect, test } from "bun:test"
import { VercelClient } from "./vercel.ts"

const realFetch = globalThis.fetch

function setFetch(handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>) {
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe("VercelClient", () => {
  test("scopes site requests to the configured team and normalizes projects", async () => {
    setFetch(async (input, init) => {
      expect(String(input)).toBe("https://api.vercel.com/v9/projects?limit=100&teamId=team-id")
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token")
      return json({
        projects: [
          {
            name: "example-project",
            framework: "astro",
            latestDeployments: [
              {
                state: "READY",
                createdAt: Date.parse("2026-08-28T10:00:00.000Z"),
                url: "example-project.vercel.app",
              },
            ],
            link: {
              org: "example-org",
              repo: "example-repo",
              productionBranch: "main",
            },
            targets: {
              production: { alias: ["https://example.test", "example.test"] },
              preview: { alias: ["preview.example.test"] },
            },
          },
        ],
      })
    })

    const sites = await new VercelClient("token", "team-id").listSites()

    expect(sites).toHaveLength(1)
    expect(sites[0]).toMatchObject({
      id: "example-project",
      provider: { id: "vercel", name: "Vercel" },
      status: "READY",
      lastDeploy: "2026-08-28T10:00:00.000Z",
      stack: "astro",
      repo: "example-org/example-repo",
      branch: "main",
      domains: ["example.test", "preview.example.test"],
      deploymentUrl: "example-project.vercel.app",
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canDeploy: true,
    })
  })

  test("normalizes account-wide deployments", async () => {
    setFetch(async () =>
      json({
        deployments: [
          {
            uid: "deployment-id",
            name: "example-project",
            state: "ERROR",
            target: "production",
            created: Date.parse("2026-08-28T11:00:00.000Z"),
            url: "failed.example.test",
            inspectorUrl: "https://vercel.com/example/deployment-id",
            meta: {
              githubCommitRef: "main",
              githubCommitAuthorName: "Example Author",
            },
          },
        ],
      }),
    )

    const deployments = await new VercelClient("token", null).listDeployments()

    expect(deployments).toEqual([
      {
        id: "deployment-id",
        provider: "vercel",
        siteId: "example-project",
        siteName: "example-project",
        status: "ERROR",
        createdAt: "2026-08-28T11:00:00.000Z",
        url: "failed.example.test",
        inspectorUrl: "https://vercel.com/example/deployment-id",
        branch: "main",
        target: "production",
        creator: "Example Author",
        errorCode: null,
        errorMessage: null,
        readyState: "ERROR",
      },
    ])
  })

  test("encodes project names when fetching one site", async () => {
    setFetch(async (input) => {
      expect(String(input)).toBe("https://api.vercel.com/v9/projects/example%2Fproject")
      return json({ name: "example/project", latestDeployment: { state: "READY" } })
    })

    await expect(new VercelClient("token", null).getSite("example/project")).resolves.toMatchObject({
      id: "example/project",
      status: "READY",
    })
  })

  test("falls back to the username when the account has no display name", async () => {
    setFetch(async () => json({ user: { username: "example-user", billing: { plan: "pro", status: "active" } } }))

    await expect(new VercelClient("token", null).getAccount()).resolves.toEqual({
      name: "example-user",
      plan: "pro",
      planStatus: "active",
    })
  })

  test("surfaces Vercel API error details", async () => {
    setFetch(async () => new Response("permission denied", { status: 403, statusText: "Forbidden" }))

    await expect(new VercelClient("token", null).listSites()).rejects.toThrow(
      "Vercel API error (403 Forbidden): permission denied",
    )
  })
})
