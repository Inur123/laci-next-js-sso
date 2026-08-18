import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

const auth = betterAuth({
  database: {
    dialect: "sqlite",
    type: "sqlite",
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "sso-ipnu",
          discoveryUrl: "https://api.pelajarnumagetan.id/.well-known/openid-configuration",
          clientId: "test",
          clientSecret: "test",
          scopes: ["openid", "profile", "email"],
          pkce: true,
        },
      ],
    }),
  ],
});
console.log(auth);
