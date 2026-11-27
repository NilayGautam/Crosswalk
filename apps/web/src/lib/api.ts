import type { Dataset, Project, PublicConfig } from "@crosswalk/contract";

/** An error whose message is written for the person using the app. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const OFFLINE_MESSAGE = "Crosswalk could not be reached. Check that the server is running.";

/** Picks the most useful sentence out of an error response body. */
export function errorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ["error_description", "message", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim() !== "") {
        return value;
      }
    }
  }
  return `Something went wrong (${status}).`;
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }
  const text = await response.text();
  let parsed: unknown = null;
  if (text !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    throw new ApiError(errorMessage(parsed, response.status), response.status);
  }
  return parsed as T;
}

export interface Account {
  id: string;
  name: string;
  email: string;
}

export interface Device {
  id: string;
  label: string;
  linkedAt: string;
  lastUsedAt: string;
  current: boolean;
}

export const api = {
  config: () => request<PublicConfig>("/api/config"),
  me: () => request<Account>("/api/me"),

  signUp: (name: string, email: string, password: string) =>
    request<unknown>("/api/auth/sign-up/email", "POST", { name, email, password }),
  signIn: (email: string, password: string) =>
    request<unknown>("/api/auth/sign-in/email", "POST", { email, password }),
  signOut: () => request<unknown>("/api/auth/sign-out", "POST", {}),
  googleSignInUrl: async (callbackURL: string) => {
    const result = await request<{ url?: string }>("/api/auth/sign-in/social", "POST", {
      provider: "google",
      callbackURL,
      disableRedirect: true,
    });
    if (result.url === undefined) {
      throw new ApiError("Google sign-in did not start. Try again.", 500);
    }
    return result.url;
  },

  projects: async () => (await request<{ projects: Project[] }>("/api/projects")).projects,
  project: async (id: string) =>
    (await request<{ project: { id: string; name: string } }>(`/api/projects/${id}`)).project,
  createProject: async (name: string) =>
    (await request<{ project: Project }>("/api/projects", "POST", { name })).project,
  renameProject: (id: string, name: string) =>
    request<unknown>(`/api/projects/${id}`, "PATCH", { name }),
  deleteProject: (id: string) => request<unknown>(`/api/projects/${id}`, "DELETE"),

  datasets: async (projectId: string) =>
    (await request<{ datasets: Dataset[] }>(`/api/projects/${projectId}/datasets`)).datasets,
  moveDataset: (projectId: string, datasetId: string, x: number, y: number) =>
    request<unknown>(`/api/projects/${projectId}/datasets/${datasetId}`, "PATCH", { x, y }),
  removeDataset: (projectId: string, datasetId: string) =>
    request<unknown>(`/api/projects/${projectId}/datasets/${datasetId}`, "DELETE"),

  devices: async () => (await request<{ devices: Device[] }>("/api/devices")).devices,
  unlinkDevice: (id: string) => request<unknown>(`/api/devices/${id}`, "DELETE"),

  deviceRequest: (userCode: string) =>
    request<{ user_code: string; status: string }>(
      `/api/auth/device?user_code=${encodeURIComponent(userCode)}`,
    ),
  approveDevice: (userCode: string) =>
    request<unknown>("/api/auth/device/approve", "POST", { userCode }),
  denyDevice: (userCode: string) => request<unknown>("/api/auth/device/deny", "POST", { userCode }),
};
