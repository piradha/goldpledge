'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';

export function AuthenticationGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait until the initial user loading state is resolved.
    if (isUserLoading) {
      return;
    }

    const isLoginPage = pathname.startsWith('/login');

    if (!user) {
      // If user is not logged in, redirect to login page if they aren't already there.
      if (!isLoginPage) {
        router.replace('/login');
      } else {
        // If they are on the login page, we're done checking.
        setIsChecking(false);
      }
    } else {
      // If user is logged in, and they are on the login page, redirect to dashboard.
      if (isLoginPage) {
        router.replace('/dashboard');
      } else {
        // If they are on any other page, we're done checking.
        setIsChecking(false);
      }
    }
  }, [user, isUserLoading, pathname, router]);

  // While checking authentication status, show a loader.
  if (isChecking || isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Once checks are complete, render the children (either the login page or the main app).
  return <>{children}</>;
}
