
'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { Pledge, Customer, Payment, PledgeItem, UserProfile , Scheme} from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { doc, collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { calculateInterest } from '@/lib/interest';
import Image from 'next/image';
import { ArrowLeft, Printer, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { useMemo, useRef } from 'react';
import { ImagePreviewDialog } from '../../customers/image-preview-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";

function PledgeDetailSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

function ItemDetails({ items, itemImageUrl }: { items: PledgeItem[], itemImageUrl?: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Metal</TableHead>
                            <TableHead className="text-right">Total Wt.</TableHead>
                            <TableHead className="text-right">Stone Wt.</TableHead>
                            <TableHead className="text-right">Net Wt.</TableHead>
                            <TableHead className="text-right">Purity</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>{item.type}</TableCell>
                                <TableCell>{item.metalType}</TableCell>
                                <TableCell className="text-right">{(Number(item.totalWeight) || 0).toFixed(2)}g</TableCell>
                                <TableCell className="text-right">{(Number(item.stoneWeight) || 0).toFixed(2)}g</TableCell>
                                <TableCell className="text-right font-medium">{(Number(item.netWeight) || 0).toFixed(2)}g</TableCell>
                                <TableCell className="text-right">{item.purity}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {itemImageUrl && (
                <div className="w-full max-w-xs mx-auto">
                    <ImagePreviewDialog imageUrl={itemImageUrl} name="Pledged Item Photo">
                        <div className="relative aspect-video w-full cursor-pointer">
                            <Image src={itemImageUrl} alt="Pledged item photo" fill className="rounded-md object-cover" />
                        </div>
                    </ImagePreviewDialog>
                </div>
            )}
        </div>
    )
}


export default function PledgeDetailPage() {
    const params = useParams();
    const { firestore } = useFirebase();
    const { user } = useUser();
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

    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles, isLoading: isLoadingProfile } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

      const schemesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, "schemes"), where("shopId", "==", userProfile.shopId)) : null),
        [firestore, userProfile]
      );
      const { data: schemes, isLoading: isLoadingSchemes } = useCollection<Scheme>(schemesQuery);
      const scheme = useMemo(() => {
      if (!schemes || !pledge?.schemeId) return null;
    
      return schemes.find(s => s.id === pledge.schemeId) ?? null;
    }, [schemes, pledge?.schemeId]);
    

    const paymentsQuery = useMemoFirebase(
        () => (firestore && pledgeId ? query(collection(firestore, 'payments'), where('pledgeId', '==', pledgeId)) : null),
        [firestore, pledgeId]
    );
    const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);

    const isLoading = isLoadingPledge || isLoadingCustomer || isLoadingProfile || isLoadingPayments || isLoadingSchemes||
  !scheme; 

    // Security check: ensure the pledge belongs to the user's shop
    if (pledge && userProfile && pledge.shopId !== userProfile.shopId) {
        return (
            <Card className="text-center py-12">
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                    <CardDescription>You do not have permission to view this pledge.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (isLoading) {
        return <PledgeDetailSkeleton />;
    }

    if (!pledge) {
        return (
            <Card className="text-center py-12">
                <CardHeader>
                    <CardTitle>Pledge Not Found</CardTitle>
                    <CardDescription>The pledge with ID '{pledgeId}' could not be found.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline">
                        <Link href="/pledges">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Pledges
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const { interestDue: grossInterestAccrued,rate } = calculateInterest(pledge, scheme, new Date(), payments || []);
    const interestPaid = pledge.interestPaid || 0;
    const currentInterestDue = Math.max(0, grossInterestAccrued - interestPaid);
    const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;
    const totalOutstanding = outstandingPrincipal + currentInterestDue;

    const repledgeMatch = pledge.notes?.match(/Repledge of ([\w-]+)/);
    const originalPledgeId = repledgeMatch ? repledgeMatch[1] : null;


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="icon" className="shrink-0">
                    <Link href="/pledges"><ArrowLeft /></Link>
                </Button>
                <h1 className="text-2xl font-bold">Pledge Details</h1>
                <Badge variant={pledge.status === 'OVERDUE' ? 'destructive' : pledge.status === 'CLOSED' ? 'outline' : 'secondary'}
                    className={cn('text-base', pledge.status === 'ACTIVE' && 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20')}
                >
                    {pledge.status}
                </Badge>
                <Button asChild variant="outline" size="icon" className="ml-auto">
                    <Link href={`/print/pledge/${pledgeId}`} target="_blank">
                        <Printer className="h-4 w-4" />
                        <span className="sr-only">Print Voucher</span>
                    </Link>
                </Button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pledge Summary</CardTitle>
                            <CardDescription>
                                Pledge ID: {pledge.id}
                                {originalPledgeId && (
                                    <span className="ml-4 text-base font-medium text-primary">(Ref: {originalPledgeId})</span>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Loan Amount</p>
                                    <p className="font-semibold text-lg">₹{pledge.loanAmount.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Principal Paid</p>
                                    <p className="font-semibold text-lg text-green-500">₹{pledge.paidAmount.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Interest Accrued</p>
                                    <p className="font-semibold text-lg text-amber-500">₹{Math.round(grossInterestAccrued).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Interest Paid</p>
                                    <p className="font-semibold text-lg text-green-500">₹{Math.round(interestPaid).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Interest Due</p>
                                    <p className="font-semibold text-lg text-destructive">₹{Math.round(currentInterestDue).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Total Outstanding</p>
                                    <p className="font-semibold text-lg">₹{Math.round(totalOutstanding).toLocaleString('en-IN')}</p>
                                </div>
                            </div>
                            <Separator className="my-6" />
                            <ItemDetails items={pledge.items} itemImageUrl={pledge.itemImageUrl} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Payment History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments && payments.length > 0 ? (
                                        payments.map(payment => (
                                            <TableRow key={payment.id}>
                                                <TableCell>{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{payment.paymentType}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">₹{payment.amount.toLocaleString('en-IN')}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">No payments recorded yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    {customer && (
                        <Card>
                            <CardHeader className="flex-row items-center gap-4">
                                <CardTitle>Customer</CardTitle>
                                {customer.photoUrl && (
                                    <ImagePreviewDialog imageUrl={customer.photoUrl} name={customer.name}>
                                        <Image src={customer.photoUrl} alt="customer photo" width={40} height={40} className="rounded-full cursor-pointer" />
                                    </ImagePreviewDialog>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="font-semibold">{customer.name}</p>
                                <p className="text-muted-foreground">{customer.address}</p>
                                <p className="text-muted-foreground">{customer.mobileNumber}</p>
                            </CardContent>
                        </Card>
                    )}
                    <Card>
                        <CardHeader>
                            <CardTitle>Loan Terms</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                             <div className="flex justify-between">
  <span className="text-muted-foreground">Scheme Name:</span>

  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-pointer text-primary underline underline-offset-2">
          {pledge.schemeName}
        </span>
      </TooltipTrigger>

      <TooltipContent className="p-3 w-56">
        <div className="space-y-1">
          <div className="font-semibold mb-2">Interest Tiers</div>

          {scheme?.interestTiers?.length ? (
            [...scheme.interestTiers]
              .sort((a, b) => a.duration - b.duration)
              .map((tier, index) => (
                <div
                  key={index}
                  className="flex justify-between text-sm"
                >
                  <span>Month {tier.duration}</span>
                  <span>{tier.rate}%</span>
                </div>
              ))
          ) : (
            <div className="text-sm text-muted-foreground">
              No interest tiers configured
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
<div className="flex justify-between">
  <span className="text-muted-foreground">
    Current Interest:
  </span>

  <span className="font-semibold text-amber-600">
    {rate}% P.M
  </span>
</div>
                            {pledge.documentCharges && pledge.documentCharges > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Document Charges:</span>
                                    <span>₹{pledge.documentCharges.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Interest Rate:</span>
                                <span>{pledge.interestRate}% p.m.</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration:</span>
                                <span>{pledge.loanDuration} {pledge.loanDurationType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Pledge Date:</span>
                                <span>{new Date(pledge.createdAt).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                                <span>Due Date:</span>
                                <span>{new Date(pledge.dueDate).toLocaleDateString('en-IN')}</span>
                            </div>
                        </CardContent>
                    </Card>
                    {pledge.bankCoverage && (
                        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                            <CardHeader className="flex flex-row items-center gap-2">
                                <Building2 className="h-5 w-5 text-blue-600" />
                                <CardTitle>Bank Coverage</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Badge variant={pledge.bankCoverage.status === 'In Bank' ? 'default' : 'secondary'}
                                        className={cn(pledge.bankCoverage.status === 'In Bank' && 'bg-blue-500/10 text-blue-600 border-blue-200')}
                                    >
                                        {pledge.bankCoverage.status}
                                    </Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Bank Name:</span>
                                    <span className="font-medium text-blue-600">{pledge.bankCoverage.bankName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Loan Amount:</span>
                                    <span className="font-mono font-bold">₹{pledge.bankCoverage.bankLoanAmount.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Loan Date:</span>
                                    <span>{new Date(pledge.bankCoverage.depositDate).toLocaleDateString('en-IN')}</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {pledge.status !== 'CLOSED' && (
                        <Button asChild className="w-full">
                            <Link href={`/pledges/${pledge.id}/make-payment`}>Make Payment</Link>
                        </Button>
                    )}
                </div>

            </div>
        </div>
    );
}
