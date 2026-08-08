
"use client";

import { useCollection, useDoc, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Customer, Pledge, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoreHorizontal, PlusCircle, Search, Trash2, Printer, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {  Scheme} from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, doc, deleteDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { clearAllPledges, deletePledge } from "@/firebase/firestore/pledges";
import { calculateInterest } from "@/lib/interest";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Scale ,Banknote} from "lucide-react";

function PledgeRowSkeleton() {
    return (
        <TableRow>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
        </TableRow>
    )
}

function PledgeRow({
  pledge,
  userProfile,
  schemes,
}: {
  pledge: Pledge;
  userProfile: UserProfile | null;
  schemes?: Scheme[] | null;
}) {
  const scheme = useMemo(() => {
    if (!schemes || !pledge?.schemeId) {
      return null;
    }

    return schemes.find((s) => s.id === pledge.schemeId) ?? null;
  }, [schemes, pledge?.schemeId]);
    const { interestDue: grossInterestAccrued } = calculateInterest(pledge,scheme,new Date());
    const interestPaid = pledge.interestPaid || 0;
    const currentInterestDue = Math.max(0, grossInterestAccrued - interestPaid);
    const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;
    const totalOutstanding = outstandingPrincipal + currentInterestDue;
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const [isDeleting, setIsDeleting] = useState(false);


    const grossWeight = useMemo(() => {
        return pledge.items.reduce((sum, item) => sum + (Number(item.totalWeight) || 0), 0)
    }, [pledge.items]);

    return (
        <TableRow className={pledge.status === 'CLOSED' ? 'opacity-50' : ''}>
            <TableCell className="font-medium">{pledge.id}</TableCell>
            <TableCell>{pledge.customerName}</TableCell>
            <TableCell>{pledge.items?.map(i => i.type).join(', ') || ''}</TableCell>
            <TableCell className="text-right">{grossWeight.toFixed(2)}g</TableCell>
            <TableCell className="text-right">{(pledge.totalWeight || 0).toFixed(2)}g</TableCell>
            <TableCell className="text-right">₹{pledge.loanAmount.toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-right font-medium">₹{Math.round(totalOutstanding).toLocaleString('en-IN')}</TableCell>
            <TableCell>{new Date(pledge.createdAt).toLocaleDateString('en-IN')}</TableCell>
            <TableCell>{new Date(pledge.dueDate).toLocaleDateString('en-IN')}</TableCell>
            <TableCell>
                <Badge variant={pledge.status === 'OVERDUE' ? 'destructive' : pledge.status === 'CLOSED' ? 'outline' : 'secondary'}
                    className={cn(pledge.status === 'ACTIVE' && 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20')}
                >
                    {pledge.status}
                </Badge>
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
                            <Link href={`/pledges/${pledge.id}`}>View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild disabled={pledge.status === 'CLOSED'}>
                            <Link href={`/pledges/${pledge.id}/make-payment`} className={pledge.status === 'CLOSED' ? 'pointer-events-none opacity-50' : ''}>Make Payment</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={`/print/pledge/${pledge.id}`} target="_blank">
                                <Printer className="mr-2 h-4 w-4" />
                                Print Voucher
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild disabled={pledge.status === 'CLOSED'}>
                            <Link href={`/pledges/new?repledgeId=${pledge.id}`} className={pledge.status === 'CLOSED' ? 'pointer-events-none opacity-50' : ''}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Repledge
                            </Link>
                        </DropdownMenuItem>

                        {userProfile?.role === 'owner' && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild disabled={pledge.status === 'CLOSED'}>
                                    <Link href={`/pledges/${pledge.id}/edit`} className={pledge.status === 'CLOSED' ? 'pointer-events-none opacity-50' : ''}>
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Edit Pledge
                                    </Link>
                                </DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Pledge
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete pledge {pledge.id} and all its associated data. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                onClick={async () => {
                                                    if (!firestore) return;
                                                    setIsDeleting(true);
                                                    try {
                                                        await deletePledge(firestore, pledge.id);
                                                        toast({
                                                            title: "Pledge deleted",
                                                            description: `Pledge ${pledge.id} has been successfully deleted.`,
                                                        });
                                                    } catch (error) {
                                                        console.error("Error deleting pledge:", error);
                                                        toast({
                                                            variant: "destructive",
                                                            title: "Error deleting pledge",
                                                            description: error instanceof Error ? error.message : "An unknown error occurred.",
                                                        });
                                                    } finally {
                                                        setIsDeleting(false);
                                                    }
                                                }}
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        )}

                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}


export default function PledgesList() {
    const searchParams = useSearchParams();
    const customerIdFilter = searchParams.get('customerId');
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [metalTypeFilter, setMetalTypeFilter] = useState("All");
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);


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

    const customersQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'customers'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: allCustomers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

    const customer = useMemo(() => {
        if (!allCustomers || !customerIdFilter) return null;
        return allCustomers.find(c => c.id === customerIdFilter);
    }, [allCustomers, customerIdFilter]);


    const pledgesQuery = useMemoFirebase(() => {
        if (!firestore || !userProfile) return null;

        let q = query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId));

        if (customerIdFilter) {
            q = query(q, where('customerId', '==', customerIdFilter));
        }

        return q;
    }, [firestore, userProfile, customerIdFilter]);

    const { data: pledges, isLoading: isLoadingPledges } = useCollection<Pledge>(pledgesQuery);

    const filteredPledges = useMemo(() => {
        if (!pledges) return [];

        return pledges.filter(pledge => {
            const pledgeDate = new Date(pledge.createdAt);

            const searchMatch = searchTerm
                ? pledge.id.toLowerCase().includes(searchTerm.toLowerCase()) || pledge.customerName.toLowerCase().includes(searchTerm.toLowerCase())
                : true;

            const statusMatch = statusFilter !== 'All' ? pledge.status === statusFilter : true;

            const metalTypeMatch = metalTypeFilter !== 'All'
                ? pledge.items.some(item => item.metalType === metalTypeFilter)
                : true;

            const startDateMatch = startDate ? pledgeDate >= startDate : true;

            const endDateMatch = endDate ? pledgeDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1) : true; // Include the whole end day

            return searchMatch && statusMatch && metalTypeMatch && startDateMatch && endDateMatch;

        }).sort((a, b) => {
            const numA = parseInt(a.id.split('-').pop() || '0', 10);
            const numB = parseInt(b.id.split('-').pop() || '0', 10);
            return numB - numA;
        });

    }, [pledges, searchTerm, statusFilter, metalTypeFilter, startDate, endDate]);

 const activePledges = filteredPledges?.filter(p => p.status === 'ACTIVE' || p.status === 'OVERDUE') || [];
   const totalLoanAmount = activePledges.reduce((sum, p) => sum + Number(p.loanAmount), 0);
  const { totalGoldWeight, totalSilverWeight,totalPacket } = useMemo(() => {
    return activePledges.reduce(
      (acc, pledge) => {
        pledge.items.forEach(item => {
          if (item.metalType === 'Gold') {
            acc.totalGoldWeight += Number(item.netWeight) || 0;
          } else if (item.metalType === 'Silver') {
            acc.totalSilverWeight += Number(item.netWeight) || 0;
          }
          acc.totalPacket++;
        });
        return acc;
      },
      { totalGoldWeight: 0, totalSilverWeight: 0,totalPacket:0 }
    );
  }, [activePledges]);


    const showLoading = isLoadingPledges || isLoadingCustomers || isUserLoading || isLoadingProfile;


function MetricCard({ icon: Icon, title, value, isLoading }: { icon: React.ElementType, title: string, value: string | number, isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground text-primary" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}
    return (
        
        <Card>
            <CardHeader>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <MetricCard
          icon={Scale}
          title="Total Gold Pledged"
          value={`${totalGoldWeight.toFixed(2)}g`}
          isLoading={showLoading}
        /><MetricCard
          icon={Scale}
          title="Total Silver Pledged"
          value={`${totalSilverWeight.toFixed(2)}g`}
          isLoading={showLoading}
        /><MetricCard
          icon={Scale}
          title="Total Packet"
          value={`${totalPacket}`}
          isLoading={showLoading}
        />
       <MetricCard
          icon={Banknote}
          title="Total Active Loan"
          value={`₹${Math.round(totalLoanAmount).toLocaleString('en-IN')}`}
          isLoading={showLoading}
        />
        </div>
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <CardTitle className="flex-1">
                        {customer ? `Pledges for ${customer.name}` : 'All Pledges'}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        {!customerIdFilter && (
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by ID or customer..."
                                    className="pl-9 w-full sm:w-48"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        )}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Statuses</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="OVERDUE">Overdue</SelectItem>
                                <SelectItem value="CLOSED">Closed</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={metalTypeFilter} onValueChange={setMetalTypeFilter}>
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <SelectValue placeholder="Filter by metal" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Metal Types</SelectItem>
                                <SelectItem value="Gold">Gold</SelectItem>
                                <SelectItem value="Silver">Silver</SelectItem>
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal sm:w-[180px]", !startDate && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "LLL dd, y") : <span>Start date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                            </PopoverContent>
                        </Popover>

                        <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal sm:w-[180px]", !endDate && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, "LLL dd, y") : <span>End date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={endDate}
                                    onSelect={(date) => {
                                        setEndDate(date);
                                        setIsEndDatePickerOpen(false);
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <Link href="/pledges/new">
                            <Button size="sm" className="gap-2 whitespace-nowrap" disabled={showLoading}>
                                <PlusCircle className="h-4 w-4" />
                                New Pledge
                            </Button>
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pledge ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-right">Gross Wt.</TableHead>
                            <TableHead className="text-right">Net Wt.</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                            <TableHead>Loan Date</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {showLoading && Array.from({ length: 5 }).map((_, i) => <PledgeRowSkeleton key={i} />)}

                        {!showLoading && filteredPledges?.map((pledge) => (
                            <PledgeRow
                                key={pledge.id}
                                pledge={pledge}
                                userProfile={userProfile}
                                schemes={schemes}
                            />
                        ))}
                    </TableBody>
                </Table>
                {!showLoading && (!filteredPledges || filteredPledges.length === 0) && (
                    <div className="text-center text-muted-foreground py-10">
                        {searchTerm || statusFilter !== 'All' || startDate || endDate || metalTypeFilter !== 'All'
                            ? `No pledges found matching the current filters.`
                            : customerIdFilter && customer
                                ? `No pledges found for ${customer.name}.`
                                : 'No pledges have been created yet.'
                        }
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
