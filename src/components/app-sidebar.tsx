"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Gem,
  LayoutDashboard,
  Users,
  BookHeart,
  FileText,
  Settings,
  Layers,
  Package,
  Shield,
  Building2,
} from "lucide-react";
import { useFirebase, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { UserProfile } from "@/lib/types";
import { useMemo } from "react";
import { SUPER_ADMIN_EMAIL } from "@/lib/config";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/schemes", icon: Layers, label: "Schemes" },
  { href: "/pledges", icon: BookHeart, label: "Pledges" },
  { href: "/bank-pledges", icon: Building2, label: "Bank Pledges" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/items", icon: Package, label: "Items" },
  { href: "/reports", icon: FileText, label: "Reports" },
];

const adminNavItems = [
  { href: "/admin", icon: Shield, label: "Admin" },
]

export default function AppSidebar() {
  const pathname = usePathname();
  const { firestore, user } = useFirebase();

  const userProfileQuery = useMemoFirebase(
    () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
    [firestore, user?.email]
  );
  const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
  const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

  const isAdmin = user?.email === SUPER_ADMIN_EMAIL || userProfile?.role === 'admin';

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Gem className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold text-primary">PledgeVault</h1>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarContent className="p-2 mt-auto">
        <SidebarMenu>
          {isAdmin && adminNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="#">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
