import { AdminAuthProvider } from "@/components/admin/admin-auth-provider";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = {
  title: "Admin | Research Aggregator",
  robots: "noindex",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
