import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      hasGroqKey: boolean;
      nativeLanguage: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    hasGroqKey: boolean;
    nativeLanguage: string | null;
  }
}
