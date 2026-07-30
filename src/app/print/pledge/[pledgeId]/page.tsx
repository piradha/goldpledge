

'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Customer, Pledge, UserProfile, Shop, Scheme } from '@/lib/types';
import { PledgeVoucher } from '@/app/(app)/pledges/pledge-voucher';
import { Skeleton } from '@/components/ui/skeleton';

function PrintPageSkeleton() {
    return (
        <div className="max-w-4xl mx-auto p-8">
            <Skeleton className="h-screen w-full" />
        </div>
    )
}


export default function PrintPledgePage() {
    const params = useParams();
    const { firestore } = useFirebase();
    const pledgeId = params.pledgeId as string;

    const pledgeRef = useMemoFirebase(
        () => (firestore && pledgeId ? doc(firestore, 'pledges', pledgeId) : null),
        [firestore, pledgeId]
    );
    const { data: pledge, isLoading: isLoadingPledge } = useDoc<Pledge>(pledgeRef);

    const customerRef = useMemoFirebase(
        () => (firestore && pledge ? doc(firestore, 'customers', pledge.customerId) : null),
        [firestore, pledge]
    );
    const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);
    
    // We fetch the shop details directly using the shopId from the pledge.
    const shopRef = useMemoFirebase(
        () => (firestore && pledge ? doc(firestore, 'shops', pledge.shopId) : null),
        [firestore, pledge]
    );
    const { data: shop, isLoading: isLoadingShop } = useDoc<Shop>(shopRef);

    const isLoading = isLoadingPledge || isLoadingCustomer || isLoadingShop;
    
    if (isLoading) {
        return <PrintPageSkeleton />;
    }

    if (!pledge || !customer || !shop) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Could not load voucher data. Please ensure the pledge, customer, and shop exist.</p>
            </div>
        );
    }
    
    return (
         <PledgeVoucher pledge={pledge} customer={customer} shop={shop} />
    );
}
