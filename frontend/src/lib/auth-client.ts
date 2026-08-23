import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "https://laci.pelajarnumagetan.or.id",
  user: {
    additionalFields: {
      role: {
        type: "string",
      },
      isActive: {
        type: "boolean",
      },
      periodeAktifId: {
        type: "string",
      },
    },
  },
  plugins: [genericOAuthClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
