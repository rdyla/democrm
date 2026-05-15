import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import path from "node:path";
import os from "node:os";

const PERSIST_PATH = path.join(os.tmpdir(), "democrm-wrangler-state", "v3");

const nextConfig: NextConfig = {};

initOpenNextCloudflareForDev({ persist: { path: PERSIST_PATH } });

export default nextConfig;
