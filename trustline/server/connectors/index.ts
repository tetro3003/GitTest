import { ApiError } from "@/lib/api/client";
import type { RealConnector } from "@/lib/service/core";
import { fetchFigmaWork } from "./figma";
import { fetchGitHubWork } from "./github";

/** Direct API connectors (door #4). Every other app uses export upload, webhook or tracker. */
export const realConnector: RealConnector = async ({ source, credentials }) => {
  if (source.provider === "GitHub" && credentials.github) return fetchGitHubWork(credentials.github.username);
  if (source.provider === "Figma" && credentials.figma) return fetchFigmaWork(credentials.figma.token, credentials.figma.files);
  throw new ApiError(`${source.provider} has no direct sign-in yet. Upload an export, use the webhook, or run the desktop tracker.`, 400);
};

export const API_CONNECTORS = ["GitHub", "Figma"] as const;
