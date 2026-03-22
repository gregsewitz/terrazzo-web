export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Standalone layout — no AuthProvider, TabBar, or app chrome
  return <>{children}</>;
}
