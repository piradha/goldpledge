
import { Suspense } from "react";
import BankPledgesList from "./bank-pledges-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function BankPledgesSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-9 w-36" />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function BankPledgesPage() {
    return (
        <div className="space-y-6">
            <Suspense fallback={<BankPledgesSkeleton />}>
                <BankPledgesList />
            </Suspense>
        </div>
    )
}
