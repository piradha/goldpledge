
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { Customer, Pledge, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { doc, collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { calculateInterest } from '@/lib/interest';
import { ImagePreviewDialog } from '../image-preview-dialog';
import { EditCustomerDialog } from '../edit-customer-dialog';

function CustomerDetailSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-8 w-48" />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-center">
                                <Skeleton className="h-24 w-24 rounded-full" />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-5 w-3/4 mx-auto" />
                            <Skeleton className="h-4 w-full mx-auto" />
                            <Skeleton className="h-4 w-full mx-auto" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                        <CardContent className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-full" />
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                        <CardContent>
                            <Skeleton className="h-40 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}


export default function CustomerDetailPage() {
    const params = useParams();
    const { firestore } = useFirebase();
    const { user } = useUser();
    const customerId = params.customerId as string;
    const router = useRouter();

    const customerRef = useMemoFirebase(
        () => (firestore && customerId ? doc(firestore, 'customers', customerId) : null),
        [firestore, customerId]
    );
    const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles, isLoading: isLoadingProfile } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    const customerPledgesQuery = useMemoFirebase(
        () => (firestore && customerId ? query(collection(firestore, 'pledges'), where('customerId', '==', customerId)) : null),
        [firestore, customerId]
    );
    const { data: pledges, isLoading: isLoadingPledges } = useCollection<Pledge>(customerPledgesQuery);

    const isLoading = isLoadingCustomer || isLoadingPledges || isLoadingProfile;

    if (customer && userProfile && customer.shopId !== userProfile.shopId) {
        return (
            <Card className="text-center py-12">
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                    <CardDescription>You do not have permission to view this customer.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (isLoading) {
        return <CustomerDetailSkeleton />;
    }

    if (!customer) {
        return (
            <Card className="text-center py-12">
                <CardHeader>
                    <CardTitle>Customer Not Found</CardTitle>
                    <CardDescription>The customer with ID '{customerId}' could not be found.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline">
                        <Link href="/customers">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Customers
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="icon" className="shrink-0">
                    <Link href="/customers"><ArrowLeft /></Link>
                </Button>
                <h1 className="text-2xl font-bold truncate">Customer: {customer.name}</h1>
                <div className="ml-auto">
                    <EditCustomerDialog customer={customer}>
                        <Button size="sm" className="gap-2">
                            <Edit className="h-4 w-4" />
                            Edit Customer
                        </Button>
                    </EditCustomerDialog>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardContent className="pt-6 flex flex-col items-center gap-4">
                            {customer.photoUrl ? (
                                <ImagePreviewDialog imageUrl={customer.photoUrl} name={customer.name}>
                                    <Avatar className="h-24 w-24 cursor-pointer">
                                        <AvatarImage src={customer.photoUrl} alt={customer.name} />
                                        <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </ImagePreviewDialog>
                            ) : (
                                <Avatar className="h-24 w-24">
                                    <AvatarFallback className="text-3xl">{customer.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            )}
                            <div className="text-center">
                                <p className="font-semibold text-lg">{customer.name}</p>
                                {customer.fatherName && <p className="text-muted-foreground text-sm">s/o {customer.fatherName}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Contact & ID</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="space-y-1">
                                <p className="font-medium">Address</p>
                                <p className="text-muted-foreground">{customer.address}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium">Mobile</p>
                                <p className="text-muted-foreground">{customer.mobileNumber}</p>
                                {customer.alternateMobile && <p className="text-muted-foreground">{customer.alternateMobile}</p>}
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium">ID Proof</p>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{customer.idProofType}: {customer.idProofNumber}</Badge>
                                    {customer.idProofPhotoUrl && (
                                        <ImagePreviewDialog imageUrl={customer.idProofPhotoUrl} name={`${customer.name}'s ID Proof`}>
                                            <Button variant="outline" size="icon" className="h-7 w-7">
                                                <Link href="#"><ArrowLeft className="h-4 w-4 transform -rotate-45" /></Link>
                                            </Button>
                                        </ImagePreviewDialog>
                                    )}
                                </div>
                            </div>
                            {customer.reference && (
                                <div className="space-y-1">
                                    <p className="font-medium">Reference</p>
                                    <p className="text-muted-foreground">{customer.reference}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pledge History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pledge ID</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Outstanding</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pledges && pledges.length > 0 ? (
                                        pledges.map(pledge => {
                                            const { interestDue } = calculateInterest(pledge);
                                            const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;
                                            const totalOutstanding = outstandingPrincipal + interestDue;
                                            return (
                                                <TableRow key={pledge.id} onClick={() => router.push(`/pledges/${pledge.id}`)} className="cursor-pointer">
                                                    <TableCell className="font-medium">{pledge.id}</TableCell>
                                                    <TableCell>{new Date(pledge.createdAt).toLocaleDateString('en-IN')}</TableCell>
                                                    <TableCell>₹{pledge.loanAmount.toLocaleString('en-IN')}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={pledge.status === 'OVERDUE' ? 'destructive' : pledge.status === 'CLOSED' ? 'outline' : 'secondary'}
                                                            className={cn(pledge.status === 'ACTIVE' && 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20')}
                                                        >
                                                            {pledge.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">₹{Math.round(totalOutstanding).toLocaleString('en-IN')}</TableCell>
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">No pledges recorded for this customer.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
