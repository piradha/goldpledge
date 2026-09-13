'use client';

import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Pledge, RepledgeHistoryItem } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { useRepledgeHistory } from '@/firebase/firestore/repledge-history';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { History, ArrowDown, ExternalLink, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface RepledgeHistoryCardProps {
    pledge: Pledge | null | undefined;
    variant?: 'table' | 'compact';
    className?: string;
}

export function RepledgeHistoryCard({
    pledge,
    variant = 'table',
    className,
}: RepledgeHistoryCardProps) {
    const { firestore } = useFirebase();
    const { history, isLoading, error, hasHistory } = useRepledgeHistory(pledge, firestore);

    if (isLoading) {
        return (
            <Card className={cn("overflow-hidden", className)}>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground animate-spin" />
                        <CardTitle className="text-lg">Repledge History</CardTitle>
                    </div>
                    <CardDescription>Loading repledge history...</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!pledge) {
        return null;
    }

    // If it's a stand-alone original pledge with no repledge history
    if (!hasHistory || history.length <= 1) {
        return (
            <Card className={cn(className)}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-lg">Repledge History</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs font-normal">Original Pledge</Badge>
                    </div>
                    <CardDescription>
                        This pledge was created directly and has not undergone repledging.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No repledge history available.
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Calculate Summary Metrics
    const originalPledge = history[0];
    const totalRepledges = history.length - 1;
    const currentPledgeItem = history[history.length - 1];

    if (variant === 'compact') {
        return (
            <Card className={cn("border-amber-200/60 dark:border-amber-900/40 bg-card", className)}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                            <CardTitle className="text-lg">Repledge History</CardTitle>
                        </div>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">
                            {totalRepledges} {totalRepledges === 1 ? 'Repledge' : 'Repledges'}
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        Originated from <span className="font-semibold text-foreground">{originalPledge.pledgeId}</span> (₹{originalPledge.loanAmount.toLocaleString('en-IN')})
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                    <div className="space-y-2">
                        {history.map((item, index) => {
                            const isLast = index === history.length - 1;
                            const isFirst = index === 0;

                            if (item.isUnavailable) {
                                return (
                                    <div key={item.id || index} className="space-y-2">
                                        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <span>Previous pledge details are unavailable (Ref: {item.pledgeId})</span>
                                        </div>
                                        {!isLast && (
                                            <div className="flex justify-center text-muted-foreground/60 py-0.5">
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div key={item.id} className="space-y-2">
                                    <div className={cn(
                                        "rounded-lg border p-3 transition-colors",
                                        item.isCurrent
                                            ? "border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-sm"
                                            : "border-muted bg-muted/30 hover:bg-muted/50"
                                    )}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-muted-foreground">
                                                    {isFirst ? 'Original Pledge' : item.isCurrent ? 'Current Pledge' : `Repledge #${item.historyLevel - 1}`}
                                                </span>
                                                {item.isCurrent && (
                                                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                                                        CURRENT
                                                    </Badge>
                                                )}
                                            </div>
                                            <Badge variant={item.status === 'ACTIVE' ? 'default' : item.status === 'CLOSED' ? 'outline' : 'secondary'} className="text-[10px] py-0 h-4">
                                                {item.status}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center justify-between text-sm">
                                            <div className="font-semibold text-primary flex items-center gap-1.5">
                                                {!item.isCurrent ? (
                                                    <Link href={`/pledges/${item.id}`} className="hover:underline flex items-center gap-1">
                                                        {item.pledgeId}
                                                        <ExternalLink className="h-3 w-3 inline opacity-70" />
                                                    </Link>
                                                ) : (
                                                    <span>{item.pledgeId}</span>
                                                )}
                                                {item.createdAt && (
                                                    <span className="text-xs font-normal text-muted-foreground">
                                                        ({format(new Date(item.createdAt), 'dd-MMM-yyyy')})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-sm">₹{item.loanAmount.toLocaleString('en-IN')}</div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-1 pt-1 border-t border-dashed">
                                            <span>Principal Paid: <span className="text-green-600 dark:text-green-400 font-medium">₹{(item.paidAmount || 0).toLocaleString('en-IN')}</span></span>
                                            <span>Outstanding: <span className="font-medium text-foreground">₹{Math.max(0, (item.loanAmount || 0) - (item.paidAmount || 0)).toLocaleString('en-IN')}</span></span>
                                        </div>
                                    </div>

                                    {!isLast && (
                                        <div className="flex items-center justify-center gap-1 text-muted-foreground/70 py-0.5">
                                            <ArrowDown className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-medium uppercase tracking-wider">Repledged</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Default: Full table variant for Pledge View Page
    return (
        <Card className={cn("overflow-hidden border-amber-200/50 dark:border-amber-900/30", className)}>
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                            <CardTitle className="text-xl">Repledge History</CardTitle>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 text-xs">
                                {totalRepledges} {totalRepledges === 1 ? 'Repledge' : 'Repledges'}
                            </Badge>
                        </div>
                        <CardDescription>
                            Complete chronological lineage from original pledge to the current pledge.
                        </CardDescription>
                    </div>

                    {/* Summary Metrics Bar */}
                    <div className="flex items-center gap-4 bg-muted/40 dark:bg-muted/20 px-3 py-2 rounded-lg text-xs sm:text-sm border">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Original Amount</span>
                            <span className="font-bold text-foreground">₹{originalPledge.loanAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-6 w-px bg-border" />
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Repledges</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">{totalRepledges}</span>
                        </div>
                        <div className="h-6 w-px bg-border" />
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Current Amount</span>
                            <span className="font-bold text-primary">₹{currentPledgeItem.loanAmount.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                {/* Timeline visual breadcrumb */}
                <div className="flex flex-wrap items-center gap-2 pt-3 text-xs">
                    {history.map((item, index) => {
                        const isLast = index === history.length - 1;
                        const isFirst = index === 0;

                        return (
                            <React.Fragment key={item.id || index}>
                                <div className={cn(
                                    "flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                                    item.isCurrent
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : item.isUnavailable
                                            ? "bg-destructive/10 text-destructive border-destructive/30"
                                            : "bg-background text-foreground hover:bg-muted"
                                )}>
                                    <span className="opacity-75">
                                        {isFirst ? 'Original' : item.isCurrent ? 'Current' : `#${item.historyLevel - 1}`}:
                                    </span>
                                    {!item.isCurrent && !item.isUnavailable ? (
                                        <Link href={`/pledges/${item.id}`} className="underline underline-offset-2 hover:opacity-80">
                                            {item.pledgeId}
                                        </Link>
                                    ) : (
                                        <span>{item.pledgeId}</span>
                                    )}
                                </div>
                                {!isLast && (
                                    <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </CardHeader>

            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40">
                                <TableHead className="w-[180px]">Pledge ID</TableHead>
                                <TableHead>Pledge Date</TableHead>
                                <TableHead className="text-right">Principal / Loan</TableHead>
                                <TableHead className="text-right">Interest Rate</TableHead>
                                <TableHead className="text-right">Paid Amount</TableHead>
                                <TableHead className="text-right">Outstanding</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.map((item, index) => {
                                const isFirst = index === 0;
                                const outstanding = Math.max(0, (item.loanAmount || 0) - (item.paidAmount || 0));

                                if (item.isUnavailable) {
                                    return (
                                        <TableRow key={item.id || index} className="bg-destructive/5">
                                            <TableCell className="font-medium text-destructive flex items-center gap-1.5">
                                                <AlertTriangle className="h-4 w-4" />
                                                <span>{item.pledgeId}</span>
                                            </TableCell>
                                            <TableCell colSpan={5} className="text-destructive text-sm italic">
                                                Previous pledge details are unavailable.
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="text-destructive border-destructive/40">UNAVAILABLE</Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }

                                return (
                                    <TableRow
                                        key={item.id}
                                        className={cn(
                                            item.isCurrent ? "bg-primary/5 font-medium" : ""
                                        )}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    {!item.isCurrent ? (
                                                        <Link
                                                            href={`/pledges/${item.id}`}
                                                            className="font-semibold text-primary hover:underline flex items-center gap-1"
                                                        >
                                                            {item.pledgeId}
                                                            <ExternalLink className="h-3 w-3 opacity-60" />
                                                        </Link>
                                                    ) : (
                                                        <span className="font-bold text-primary">{item.pledgeId}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                    {isFirst ? (
                                                        <span className="text-amber-700 dark:text-amber-400 font-medium">Original Pledge</span>
                                                    ) : item.isCurrent ? (
                                                        <Badge className="h-4 text-[9px] px-1 py-0 bg-primary text-primary-foreground font-semibold">
                                                            CURRENT PLEDGE
                                                        </Badge>
                                                    ) : (
                                                        <span>Repledge #{item.historyLevel - 1}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.createdAt ? format(new Date(item.createdAt), 'dd-MMM-yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ₹{item.loanAmount.toLocaleString('en-IN')}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {item.interestRate ? `${item.interestRate}% p.m.` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                                            ₹{(item.paidAmount || 0).toLocaleString('en-IN')}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ₹{outstanding.toLocaleString('en-IN')}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                variant={
                                                    item.status === 'ACTIVE'
                                                        ? 'default'
                                                        : item.status === 'CLOSED'
                                                            ? 'outline'
                                                            : 'secondary'
                                                }
                                                className={cn(
                                                    "text-xs capitalize",
                                                    item.status === 'ACTIVE' && "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20"
                                                )}
                                            >
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
