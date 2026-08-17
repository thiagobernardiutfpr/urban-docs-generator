import type { Express } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/local-storage/*", (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key || !ENV.localStorageDir) {
      res.status(404).send("Local storage not configured");
      return;
    }
    const root = path.resolve(ENV.localStorageDir);
    const filePath = path.resolve(root, key);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      res.status(400).send("Invalid local storage key");
      return;
    }
    if (!existsSync(filePath)) {
      res.status(404).send("Local file not found");
      return;
    }
    res.set("Cache-Control", "private, no-store");
    res.sendFile(filePath);
  });

  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
