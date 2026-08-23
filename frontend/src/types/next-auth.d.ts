import { Role } from "@prisma/client";
import { DefaultSession, User as NextAuthUser } from "next-auth";
import { JWT as NextAuthJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isActive: boolean;
      periodeAktifId: string | null;
      emailVerified: boolean | null;
      image: string | null;
      name: string | null;
      email: string | null;
    };
  }

  interface User extends NextAuthUser {
    role: Role;
    isActive: boolean;
    periodeAktifId: string | null;
    emailVerified: boolean | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends NextAuthJWT {
    id: string;
    role: Role;
    isActive: boolean;
    periodeAktifId: string | null;
    emailVerified: boolean | null;
  }
}
