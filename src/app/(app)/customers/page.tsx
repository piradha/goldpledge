
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Customer, Pledge, UserProfile } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Search, Edit } from "lucide-react";
import Link from "next/link";
import { AddCustomerDialog } from "./add-customer-dialog";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ImagePreviewDialog } from "./image-preview-dialog";
import { EditCustomerDialog } from "./edit-customer-dialog";

function CustomerRowSkeleton() {
    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-28" />
                </div>
            </TableCell>
            <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
            </TableCell>
            <TableCell className="text-center">
                <Skeleton className="h-6 w-8 mx-auto" />
            </TableCell>
            <TableCell>
                <Skeleton className="h-8 w-8 ml-auto" />
            </TableCell>
        </TableRow>
    )
}


export default function CustomersPage() {
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    const [searchTerm, setSearchTerm] = useState("");
    const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles, isLoading: isLoadingProfile } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    const customersQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'customers'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

    const pledgesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: pledges, isLoading: isLoadingPledges } = useCollection<Pledge>(pledgesQuery);

    const customerPledgeCounts = useMemo(() => {
        if (!pledges) return new Map<string, number>();
        return pledges.reduce((acc, pledge) => {
            acc.set(pledge.customerId, (acc.get(pledge.customerId) || 0) + 1);
            return acc;
        }, new Map<string, number>());
    }, [pledges]);

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];

        const sortedCustomers = [...customers].sort((a, b) => {
            if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            if (a.createdAt) return -1;
            if (b.createdAt) return 1;
            return 0;
        });

        if (!searchTerm) return sortedCustomers;

        return sortedCustomers.filter(customer =>
            customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.mobileNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (customer.idProofNumber && customer.idProofNumber.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [customers, searchTerm]);

    const showLoading = isLoadingCustomers || isLoadingPledges || isUserLoading || isLoadingProfile;

    return (
        <Card>
            <CardHeader className="flex flex-col md:flex-row items-center gap-4">
                <CardTitle className="flex-1">Customers</CardTitle>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, mobile..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <AddCustomerDialog>
                        <Button size="sm" className="gap-2 whitespace-nowrap" disabled={showLoading}>
                            <PlusCircle className="h-4 w-4" />
                            Add Customer
                        </Button>
                    </AddCustomerDialog>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>ID Proof</TableHead>
                            <TableHead className="text-center">Pledges</TableHead>
                            <TableHead>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {showLoading && Array.from({ length: 5 }).map((_, i) => <CustomerRowSkeleton key={i} />)}
                        {!showLoading && filteredCustomers.map((customer) => (
                            <TableRow key={customer.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        {customer.photoUrl ? (
                                            <ImagePreviewDialog imageUrl={customer.photoUrl} name={customer.name}>
                                                <Avatar className="cursor-pointer">
                                                    <AvatarImage src={customer.photoUrl} alt={customer.name} data-ai-hint="person" />
                                                    <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </ImagePreviewDialog>
                                        ) : (
                                            <Avatar>
                                                <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="font-medium">{customer.name}</span>
                                            {customer.fatherName && <span className="text-xs text-muted-foreground">s/o {customer.fatherName}</span>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{customer.mobileNumber}</span>
                                        {customer.alternateMobile && <span className="text-xs text-muted-foreground">{customer.alternateMobile}</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">{customer.idProofType}</Badge>
                                        {customer.idProofPhotoUrl && (
                                            <ImagePreviewDialog imageUrl={customer.idProofPhotoUrl} name={`${customer.name}'s ID Proof`}>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Search className="h-4 w-4" />
                                                </Button>
                                            </ImagePreviewDialog>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Button variant="link" asChild>
                                        <Link href={`/pledges?customerId=${customer.id}`}>
                                            {customerPledgeCounts.get(customer.id) || 0}
                                        </Link>
                                    </Button>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/customers/${customer.id}`}>View Details</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setCustomerToEdit(customer)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>Send Reminder</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {!showLoading && filteredCustomers.length === 0 && (
                    <div className="text-center text-muted-foreground py-10">
                        {searchTerm ? `No customers found for "${searchTerm}".` : 'No customers yet. Click "Add Customer" to get started.'}
                    </div>
                )}
            </CardContent>
            {customerToEdit && (
                <EditCustomerDialog
                    customer={customerToEdit}
                    open={!!customerToEdit}
                    onOpenChange={(open) => !open && setCustomerToEdit(null)}
                />
            )}
        </Card>
    )
}

