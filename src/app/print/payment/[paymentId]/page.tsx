
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Customer, Pledge, Shop, Payment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentReceipt } from '@/app/(app)/pledges/payment-receipt';

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
    const paymentId = params.paymentId as string;

    const paymentRef = useMemoFirebase(
        () => (firestore && paymentId ? doc(firestore, 'payments', paymentId) : null),
        [firestore, paymentId]
    );
    const { data: payment, isLoading: isLoadingPayment } = useDoc<Payment>(paymentRef);

    const pledgeRef = useMemoFirebase(
        () => (firestore && payment ? doc(firestore, 'pledges', payment.pledgeId) : null),
        [firestore, payment]
    );
    const { data: pledge, isLoading: isLoadingPledge } = useDoc<Pledge>(pledgeRef);

    const customerRef = useMemoFirebase(
        () => (firestore && pledge ? doc(firestore, 'customers', pledge.customerId) : null),
        [firestore, pledge]
    );
    const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);
    
    const shopRef = useMemoFirebase(
        () => (firestore && pledge ? doc(firestore, 'shops', pledge.shopId) : null),
        [firestore, pledge]
    );
    const { data: shop, isLoading: isLoadingShop } = useDoc<Shop>(shopRef);
    
    const allPaymentsQuery = useMemoFirebase(
        () => (firestore && pledge ? query(collection(firestore, 'payments'), where('pledgeId', '==', pledge.id)) : null),
        [firestore, pledge]
    );
    const { data: allPayments, isLoading: isLoadingAllPayments } = useCollection<Payment>(allPaymentsQuery);

    const isLoading = isLoadingPledge || isLoadingCustomer || isLoadingShop || isLoadingPayment || isLoadingAllPayments;
    
    if (isLoading) {
        return <PrintPageSkeleton />;
    }

    if (!payment || !pledge || !customer || !shop) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Could not load receipt data.</p>
            </div>
        );
    }
    
    return (
         <PaymentReceipt payment={payment} pledge={pledge} customer={customer} shop={shop} allPayments={allPayments || []} />
    );
}

