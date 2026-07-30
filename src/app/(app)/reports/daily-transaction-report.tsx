"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Payment, Pledge, UserProfile } from "@/lib/types";
import { collection, query, where, Timestamp } from "firebase/firestore";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Transaction = {
    id: string;
    type: 'New Loan' | 'Payment';
    date: Date;
    customerName: string; // derived
    amount: number; // Positive for IN, Negative for OUT (or just handle display logic)
    mode: string; // Cash, Online etc. (if available, else inferred)
    details: string; // Pledge ID, Payment Type
}

export function DailyTransactionReport() {
    const { firestore } = useFirebase();
    const { user } = useUser();
    const [date, setDate] = useState<Date>(new Date());

    // 1. Get User Profile for Shop ID
    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    // 2. Fetch Pledges (New Loans) for the selected date
    // Note: This is an approximation. Ideally we filter by date range in query, 
    // but for simplicity/small data we can fetch recent and filter client side or do exact date query if high volume.
    // Let's do client side filtering for now as data volume is likely low.
    const pledgesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: pledges, isLoading: isLoadingPledges } = useCollection<Pledge>(pledgesQuery);

    // 3. Fetch Payments
    const paymentsQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'payments'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);

    // 4. Combine and Filter Transactions
    const transactions = useMemo(() => {
        if (!pledges || !payments) return [];

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dailyTxns: Transaction[] = [];

        // Add New Loans (Money Out)
        pledges.forEach(p => {
            const pDate = new Date(p.createdAt);
            if (pDate >= startOfDay && pDate <= endOfDay) {
                dailyTxns.push({
                    id: p.id,
                    type: 'New Loan',
                    date: pDate,
                    customerName: p.customerName,
                    amount: -p.loanAmount, // Debit
                    mode: 'Cash', // Defaulting to Cash for now
                    details: `New Pledge Created`
                });
            }
        });

        // Add Payments (Money In)
        payments.forEach(p => {
            const pDate = new Date(p.paymentDate);
            // Need to find customer name for this payment via pledgeId
            const pledge = pledges.find(pl => pl.id === p.pledgeId);

            if (pDate >= startOfDay && pDate <= endOfDay) {
                dailyTxns.push({
                    id: p.id,
                    type: 'Payment',
                    date: pDate,
                    customerName: pledge?.customerName || 'Unknown',
                    amount: p.amount, // Credit
                    mode: 'Cash', // Default
                    details: `${p.paymentType} Payment - Ref: ${p.pledgeId}`
                });
            }
        });

        return dailyTxns.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [pledges, payments, date]);

    const totals = useMemo(() => {
        return transactions.reduce((acc, curr) => {
            const amount = Number(curr.amount) || 0;
            if (amount > 0) acc.in += amount;
            else acc.out += Math.abs(amount);
            return acc;
        }, { in: 0, out: 0 });
    }, [transactions]);

    const isLoading = isLoadingPledges || isLoadingPayments;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle>Daily Transaction Report</CardTitle>
                    <CardDescription>
                        Transactions for {format(date, "MMMM dd, yyyy")}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 mb-2" align="end">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => d && setDate(d)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex flex-col p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                        <span className="text-sm text-muted-foreground">Total In (Credit)</span>
                        <span className="text-2xl font-bold text-green-600">₹{totals.in.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex flex-col p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                        <span className="text-sm text-muted-foreground">Total Out (Debit)</span>
                        <span className="text-2xl font-bold text-red-600">₹{totals.out.toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right">Debit (Out)</TableHead>
                                <TableHead className="text-right">Credit (In)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : transactions.length > 0 ? (
                                transactions.map((txn) => (
                                    <TableRow key={txn.id}>
                                        <TableCell>{format(txn.date, "hh:mm a")}</TableCell>
                                        <TableCell>
                                            <Badge variant={txn.type === 'New Loan' ? 'outline' : 'secondary'}>
                                                {txn.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{txn.customerName}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{txn.details}</TableCell>
                                        <TableCell className="text-right text-red-600 font-medium">
                                            {txn.amount < 0 ? `₹${Math.abs(txn.amount).toLocaleString('en-IN')}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 font-medium">
                                            {txn.amount > 0 ? `₹${txn.amount.toLocaleString('en-IN')}` : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No transactions found for this date.
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
