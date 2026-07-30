
'use client';

import { useAuth, useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Gem, LogOut, User } from 'lucide-react';
import { SidebarTrigger } from './ui/sidebar';
import { useRouter } from 'next/navigation';
import { collection, query, where, doc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { useMemo } from 'react';

export default function Header() {
  const { auth, firestore, user } = useFirebase();
  const router = useRouter();

  const userProfileQuery = useMemoFirebase(
    () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
    [firestore, user?.email]
  );
  const { data: userProfiles, isLoading: isProfileLoading } = useCollection<UserProfile>(userProfileQuery);
  const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);


  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
    }
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>

      <div className="flex-1" />
      
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <User className="h-5 w-5 rounded-full" />
               <div className="flex flex-col items-start">
                  {isProfileLoading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    <span className="text-2xl font-medium">{userProfile?.shopName || 'Account'}</span>
                  )}
               </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
