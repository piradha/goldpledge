"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Pledge, UserProfile } from "@/lib/types";
import { collection, query, where } from "firebase/firestore";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function OverdueReport() {
    const { firestore } = useFirebase();
    const { user } = useUser();

    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    // We can rely on 'status' == 'OVERDUE' field if it is maintained correctly by a scheduled job or update logic.
    // If not, we might need to fetch ACTIVE and calculate. Assuming 'OVERDUE' status is used for simplicity first,
    // OR checking dueDate relative to today.
    // Let's fetch all Non-closed and check dates for accuracy.
    const pledgesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: pledges, isLoading } = useCollection<Pledge>(pledgesQuery);

    const overduePledges = useMemo(() => {
        if (!pledges) return [];
        const today = new Date();

        return pledges.filter(p => {
            if (p.status === 'CLOSED') return false;
            // Check if truly overdue
            return new Date(p.dueDate) < today;
        }).map(p => {
            const dueDate = new Date(p.dueDate);
            const daysOverdue = differenceInDays(today, dueDate);
            return { ...p, daysOverdue };
        }).sort((a, b) => b.daysOverdue - a.daysOverdue);
    }, [pledges]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Overdue Pledges</CardTitle>
                <CardDescription>Loans that have crossed their due date.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pledge ID</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Days Overdue</TableHead>
                                <TableHead className="text-right">Loan Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : overduePledges.length > 0 ? (
                                overduePledges.map((pledge) => (
                                    <TableRow key={pledge.id}>
                                        <TableCell className="font-medium">{pledge.id}</TableCell>
                                        <TableCell>{pledge.customerName}</TableCell>
                                        <TableCell>{new Date(pledge.dueDate).toLocaleDateString('en-IN')}</TableCell>
                                        <TableCell className="text-red-600 font-bold">
                                            {pledge.daysOverdue} days
                                        </TableCell>
                                        <TableCell className="text-right">₹{pledge.loanAmount.toLocaleString('en-IN')}</TableCell>
                                        <TableCell>
                                            <Badge variant="destructive">Overdue</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No overdue pledges found. Great job!
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
