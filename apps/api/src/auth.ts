import { CLI_CLIENT_ID } from "@crosswalk/contract";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import type { Database } from "./db/client";
import * as schema from "./db/schema";

export interface AuthSettings {
  publicUrl: string;
  trustedOrigins: string[];
  secret: string;
  google: { clientId: string; clientSecret: string } | null;
}

export function createAuth(db: Database, settings: AuthSettings) {
  return betterAuth({
    appName: "Crosswalk",
    baseURL: settings.publicUrl,
    basePath: "/api/auth",
    secret: settings.secret,
    trustedOrigins: settings.trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // No email is sent in v1, so a new account is signed in right away.
      autoSignIn: true,
    },
    socialProviders: settings.google
      ? {
          google: {
            clientId: settings.google.clientId,
            clientSecret: settings.google.clientSecret,
          },
        }
      : {},
    account: {
      accountLinking: {
        // Google verifies the address, so the same email is the same account.
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    session: {
      // A linked CLI stays linked for 90 days of use, and each use renews it.
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      bearer(),
      deviceAuthorization({
        expiresIn: "10m",
        interval: "2s",
        verificationUri: "/device",
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
