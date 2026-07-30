
'use client';

import AppClientLayout from './client-layout';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // All auth logic has been moved to the root AuthenticationGuard.
  // This layout is now only responsible for the app's visual structure.
  return <AppClientLayout>{children}</AppClientLayout>;
}
