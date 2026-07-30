"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Pledge, UserProfile } from "@/lib/types";
import { collection, query, where } from "firebase/firestore";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ActiveInventoryReport() {
    const { firestore } = useFirebase();
    const { user } = useUser();

    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    const activePledgesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId), where('status', '==', 'ACTIVE')) : null),
        [firestore, userProfile]
    );
    // Note: We might also want to include 'OVERDUE' in active inventory as we still hold the stock.
    const overduePledgesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId), where('status', '==', 'OVERDUE')) : null),
        [firestore, userProfile]
    );

    const { data: activePledges, isLoading: isLoadingActive } = useCollection<Pledge>(activePledgesQuery);
    const { data: overduePledges, isLoading: isLoadingOverdue } = useCollection<Pledge>(overduePledgesQuery);

    const allInventory = useMemo(() => {
        const active = activePledges || [];
        const overdue = overduePledges || [];
        return [...active, ...overdue].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [activePledges, overduePledges]);

    const summary = useMemo(() => {
        return allInventory.reduce((acc, pledge) => {
            acc.totalCount += 1;
            acc.totalLoanAmount += Number(pledge.loanAmount) || 0;

            // Calc weights
            pledge.items.forEach(item => {
                const weight = Number(item.totalWeight) || 0;
                if (item.metalType === 'Gold') acc.goldWeight += weight;
                if (item.metalType === 'Silver') acc.silverWeight += weight;
            });
            return acc;
        }, { totalCount: 0, totalLoanAmount: 0, goldWeight: 0, silverWeight: 0 });
    }, [allInventory]);

    const isLoading = isLoadingActive || isLoadingOverdue;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Active Inventory & Stock</CardTitle>
                <CardDescription>Current unreleased pledges (Active & Overdue)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm font-medium text-muted-foreground">Active Pledges</div>
                        <div className="text-2xl font-bold">{summary.totalCount}</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm font-medium text-muted-foreground">Total Loan Value</div>
                        <div className="text-2xl font-bold">₹{summary.totalLoanAmount.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <div className="text-sm font-medium text-yellow-700 dark:text-yellow-500">Gold Stock</div>
                        <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-500">{summary.goldWeight.toFixed(2)}g</div>
                    </div>
                    <div className="p-4 bg-slate-500/10 rounded-lg border border-slate-500/20">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-400">Silver Stock</div>
                        <div className="text-2xl font-bold text-slate-700 dark:text-slate-400">{summary.silverWeight.toFixed(2)}g</div>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pledge ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead className="text-right">Gold (g)</TableHead>
                                <TableHead className="text-right">Silver (g)</TableHead>
                                <TableHead className="text-right">Loan Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : allInventory.length > 0 ? (
                                allInventory.map((pledge) => {
                                    const goldWt = pledge.items.filter(i => i.metalType === 'Gold').reduce((sum, i) => sum + (Number(i.totalWeight) || 0), 0);
                                    const silverWt = pledge.items.filter(i => i.metalType === 'Silver').reduce((sum, i) => sum + (Number(i.totalWeight) || 0), 0);
                                    return (
                                        <TableRow key={pledge.id}>
                                            <TableCell className="font-medium">{pledge.id}</TableCell>
                                            <TableCell>{new Date(pledge.createdAt).toLocaleDateString('en-IN')}</TableCell>
                                            <TableCell>{pledge.customerName}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={pledge.items.map(i => i.type).join(', ')}>
                                                {pledge.items.map(i => i.type).join(', ')}
                                            </TableCell>
                                            <TableCell className="text-right">{goldWt > 0 ? goldWt.toFixed(2) : '-'}</TableCell>
                                            <TableCell className="text-right">{silverWt > 0 ? silverWt.toFixed(2) : '-'}</TableCell>
                                            <TableCell className="text-right">₹{pledge.loanAmount.toLocaleString('en-IN')}</TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No active inventory found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
