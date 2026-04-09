import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { TabShell } from "@/components/TabShell";
import { GroqKeyModal } from "@/components/GroqKeyModal";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <TabShell />
        </div>
      </main>

      {/* Show Groq key setup if the user hasn't added one yet */}
      {!session.user.hasGroqKey && <GroqKeyModal />}
    </div>
  );
}
