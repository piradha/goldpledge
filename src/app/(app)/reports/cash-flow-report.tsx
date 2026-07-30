"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Payment, Pledge, UserProfile } from "@/lib/types";
import { collection, query, where } from "firebase/firestore";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function CashFlowReport() {
    const { firestore } = useFirebase();
    const { user } = useUser();
    const [timeRange, setTimeRange] = useState("thisMonth");

    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    const pledgesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: pledges, isLoading: isLoadingPledges } = useCollection<Pledge>(pledgesQuery);

    const paymentsQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'payments'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);

    const metrics = useMemo(() => {
        if (!pledges || !payments) return { disbursed: 0, collected: 0, interest: 0, principal: 0, net: 0, count: 0 };

        const now = new Date();
        const startOfRange = new Date();

        if (timeRange === 'today') {
            startOfRange.setHours(0, 0, 0, 0);
        } else if (timeRange === 'thisMonth') {
            startOfRange.setDate(1);
            startOfRange.setHours(0, 0, 0, 0);
        } else if (timeRange === 'thisYear') {
            startOfRange.setMonth(0, 1);
            startOfRange.setHours(0, 0, 0, 0);
        } else {
            startOfRange.setFullYear(2000); // All time
        }

        let disbursed = 0;
        let count = 0;
        pledges.forEach(p => {
            if (new Date(p.createdAt) >= startOfRange) {
                disbursed += Number(p.loanAmount) || 0;
                count++;
            }
        });

        let principalCollected = 0;
        let interestCollected = 0;

        payments.forEach(p => {
            // In a real app we might distinguish principal vs interest in payment record.
            // For now assuming:
            // 'Interest' type -> all interest
            // 'Settlement' / 'Partial' -> mostly principal? 
            // This logic needs refinement based on how payments are stored.
            // Looking at Payment Type: 'Interest' | 'Partial' | 'Settlement'
            // Ideally we have fields for principalAmount and interestAmount in Payment.
            // If not, this is an estimation.

            if (new Date(p.paymentDate) >= startOfRange) {
                const amount = Number(p.amount) || 0;
                if (p.paymentType === 'Interest') {
                    interestCollected += amount;
                } else {
                    // Partial/Settlement usually implies Principal (+ maybe Interest)
                    // Without breakdown, let's treat as Principal for Cash Flow "Collected"
                    // Or just total Inflow.
                    principalCollected += amount;
                }
            }
        });

        const totalCollected = principalCollected + interestCollected;

        return {
            disbursed,
            principal: principalCollected,
            interest: interestCollected,
            collected: totalCollected,
            net: totalCollected - disbursed,
            count
        };
    }, [pledges, payments, timeRange]);

    const isLoading = isLoadingPledges || isLoadingPayments;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Cash Flow Statement</CardTitle>
                    <CardDescription>Income vs. Outflow Analysis</CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="thisYear">This Year</SelectItem>
                        <SelectItem value="allTime">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="bg-red-500/10 border-red-500/20 shadow-none">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-red-600">Total Disbursed (Out)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-red-700">₹{metrics.disbursed.toLocaleString('en-IN')}</div>
                                    <p className="text-xs text-muted-foreground mt-1">{metrics.count} new loans given</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-green-500/10 border-green-500/20 shadow-none">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-green-600">Total Collected (In)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-700">₹{metrics.collected.toLocaleString('en-IN')}</div>
                                    <p className="text-xs text-muted-foreground mt-1">₹{metrics.interest.toLocaleString('en-IN')} from Interest payments</p>
                                </CardContent>
                            </Card>

                            <Card className={cn("shadow-none border", metrics.net >= 0 ? "bg-blue-500/10 border-blue-500/20" : "bg-orange-500/10 border-orange-500/20")}>
                                <CardHeader className="pb-2">
                                    <CardTitle className={cn("text-sm font-medium", metrics.net >= 0 ? "text-blue-600" : "text-orange-600")}>Net Cash Flow</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className={cn("text-2xl font-bold", metrics.net >= 0 ? "text-blue-700" : "text-orange-700")}>
                                        {metrics.net >= 0 ? '+' : ''}₹{metrics.net.toLocaleString('en-IN')}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Net profit/loss in cash terms</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base">Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between py-2 border-b">
                                        <span>New Loans Disbursed</span>
                                        <span className="font-semibold text-red-600">- ₹{metrics.disbursed.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b">
                                        <span>Principal Repayments Recd. (Est.)</span>
                                        <span className="font-semibold text-green-600">+ ₹{metrics.principal.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b">
                                        <span>Interest Payments Recd.</span>
                                        <span className="font-semibold text-green-600">+ ₹{metrics.interest.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between py-2 font-bold text-base mt-2">
                                        <span>Net Movement</span>
                                        <span className={metrics.net >= 0 ? "text-green-600" : "text-red-600"}>
                                            ₹{metrics.net.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
