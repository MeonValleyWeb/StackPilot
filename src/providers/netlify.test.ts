import { afterEach, describe, expect, test } from "bun:test"
import { NetlifyClient } from "./netlify.ts"

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

describe("NetlifyClient", () => {
  test("normalizes sites and their latest published deployments", async () => {
    setFetch(async (input, init) => {
      expect(String(input)).toBe("https://api.netlify.com/api/v1/sites?per_page=100")
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token")
      return json([
        {
          id: "site-id",
          name: "example-site",
          ssl_url: "https://example-site.netlify.app",
          admin_url: "https://app.netlify.com/sites/example-site",
          custom_domain: "example.test",
          domain_aliases: ["www.example.test"],
          build_settings: {
            repo_url: "https://github.com/example/example-site",
            repo_branch: "main",
          },
          published_deploy: {
            id: "deploy-id",
            state: "ready",
            branch: "main",
            framework: "astro",
            published_at: "2026-08-28T10:00:00.000Z",
          },
        },
        {
          id: "empty-site-id",
          name: "empty-site",
        },
      ])
    })

    const result = await new NetlifyClient("token").fetchSites()

    expect(result.sites).toHaveLength(2)
    expect(result.sites[0]).toMatchObject({
      id: "site-id",
      provider: { id: "netlify", name: "Netlify" },
      status: "ready",
      lastDeploy: "2026-08-28T10:00:00.000Z",
      stack: "astro",
      repo: "https://github.com/example/example-site",
      branch: "main",
      domains: ["example.test", "www.example.test"],
      deploymentUrl: "https://example-site.netlify.app",
      adminUrl: "https://app.netlify.com/sites/example-site",
    })
    expect(result.sites[1]).toMatchObject({ status: "unpublished", domains: [] })
    expect(result.deploys).toEqual([
      {
        id: "deploy-id",
        provider: "netlify",
        siteId: "site-id",
        siteName: "example-site",
        status: "ready",
        createdAt: "2026-08-28T10:00:00.000Z",
        url: "https://example-site.netlify.app",
        inspectorUrl: "https://app.netlify.com/sites/example-site/deploys/deploy-id",
        branch: "main",
        target: "production",
        creator: null,
        errorCode: null,
        errorMessage: null,
        readyState: "ready",
      },
    ])
  })

  test("encodes site IDs and normalizes deployment history", async () => {
    setFetch(async (input) => {
      expect(String(input)).toBe("https://api.netlify.com/api/v1/sites/site%2Fid/deploys?per_page=20")
      return json([
        {
          id: "deploy-id",
          site_id: "site/id",
          state: "error",
          branch: "feature/example",
          context: "deploy-preview",
          committer: "Example Author",
          created_at: "2026-08-28T11:00:00.000Z",
          error_message: "Build failed",
          deploy_ssl_url: "https://deploy.example.test",
          admin_url: "https://app.netlify.com/sites/example-site",
        },
      ])
    })

    const deploys = await new NetlifyClient("token").listDeploys("site/id", "example-site")

    expect(deploys[0]).toEqual({
      id: "deploy-id",
      provider: "netlify",
      siteId: "site/id",
      siteName: "example-site",
      status: "error",
      createdAt: "2026-08-28T11:00:00.000Z",
      url: "https://deploy.example.test",
      inspectorUrl: "https://app.netlify.com/sites/example-site/deploys/deploy-id",
      branch: "feature/example",
      target: "deploy-preview",
      creator: "Example Author",
      errorCode: null,
      errorMessage: "Build failed",
      readyState: "error",
    })
  })

  test("returns the first visible account", async () => {
    setFetch(async () => json([{ name: "Example Team", type_name: "Pro" }]))

    await expect(new NetlifyClient("token").getAccount()).resolves.toEqual({
      name: "Example Team",
      plan: "Pro",
    })
  })

  test("surfaces Netlify API error details", async () => {
    setFetch(async () => new Response("token expired", { status: 401, statusText: "Unauthorized" }))

    await expect(new NetlifyClient("token").fetchSites()).rejects.toThrow(
      "Netlify API error (401 Unauthorized): token expired",
    )
  })
})
