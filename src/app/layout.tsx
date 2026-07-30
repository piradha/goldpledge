
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import { CursorFocusBackground } from '@/components/ui/cursor-focus-background';
import { AuthenticationGuard } from '@/components/authentication-guard';

export const metadata: Metadata = {
  title: 'PledgeVault',
  description: 'Securely manage your gold pledges.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <CursorFocusBackground />
        <FirebaseClientProvider>
          <AuthenticationGuard>
            {children}
          </AuthenticationGuard>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
