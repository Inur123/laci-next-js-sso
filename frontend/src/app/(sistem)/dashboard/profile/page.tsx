import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ProfilePageClient from "@/components/features/profile/profile-page-client";
import { getApplicationUser } from "@/lib/application-context";

export const metadata = {
  title: "Profile | Laci Digital",
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const dbUser = await getApplicationUser();

  if (!dbUser) {
    redirect("/");
  }

  const userForProfile = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    isActive: dbUser.isActive,
    periodeAktifId: dbUser.periodeAktifId,
    emailVerified: dbUser.emailVerified,
    image: dbUser.image,
  };

  return <ProfilePageClient user={userForProfile} />;
}
