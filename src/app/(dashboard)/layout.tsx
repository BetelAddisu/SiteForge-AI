import { Shell } from '@/components/layout/shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Shell
      user={{
        name: 'Demo User',
        email: 'demo@siteforge.ai',
      }}
    >
      {children}
    </Shell>
  );
}
