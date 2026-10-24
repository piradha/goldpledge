
"use client";

import { useCollection, useDoc, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Customer, Pledge, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MoreHorizontal, PlusCircle, Search, Trash2, Printer, Calendar as CalendarIcon, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Scale, Banknote, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { Scheme } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, doc, deleteDoc, limit, getDoc, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { clearAllPledges, deletePledge, backfillPledgeNumbers } from "@/firebase/firestore/pledges";
import { calculateInterest } from "@/lib/interest";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
    const { interestDue: grossInterestAccrued } = calculateInterest(pledge, scheme, new Date());
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

    // Limit Firestore reads to avoid quota errors (defaults to 50 latest records)
    const [dataLimit, setDataLimit] = useState<number>(50);
    // Table pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(25);

    // Track if Firestore composite index is missing and provide fallback + 1-click link
    const [useFallbackQuery, setUseFallbackQuery] = useState(false);
    const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null);

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

    // Optimized: Only fetch the single customer if filtered by customerId (avoids downloading all customers!)
    const customerRef = useMemoFirebase(
        () => (firestore && customerIdFilter ? doc(firestore, 'customers', customerIdFilter) : null),
        [firestore, customerIdFilter]
    );
    const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);

    // Track shop counters to ensure the absolute latest pledge (e.g. TEP-2460) is always available
    const counterRef = useMemoFirebase(
        () => (firestore && userProfile?.shopId ? doc(firestore, 'counters', `pledge_${userProfile.shopId}`) : null),
        [firestore, userProfile?.shopId]
    );
    const { data: counterDoc } = useDoc<{ lastId: number }>(counterRef);

    const pledgesQuery = useMemoFirebase(() => {
        if (!firestore || !userProfile) return null;

        let q = query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId));

        if (customerIdFilter) {
            q = query(q, where('customerId', '==', customerIdFilter));
        }

        // Fetch most recently created pledges first
        if (!useFallbackQuery) {
            q = query(q, orderBy('createdAt', 'desc'));
        }

        // CRITICAL QUOTA FIX: Limit is ALWAYS applied (even in fallback mode).
        // Never allow unbounded queries to avoid exhausting the 50k daily read quota!
        const effectiveLimit = dataLimit > 0 ? dataLimit : 50;
        q = query(q, limit(effectiveLimit));

        return q;
    }, [firestore, userProfile, customerIdFilter, dataLimit, useFallbackQuery]);

    const { data: pledges, isLoading: isLoadingPledges, error: pledgesError } = useCollection<Pledge>(pledgesQuery);

    const isQuotaExceeded = Boolean(
        pledgesError && (
            (pledgesError as any)?.code === 'resource-exhausted' ||
            pledgesError.message?.toLowerCase().includes('quota') ||
            pledgesError.message?.toLowerCase().includes('usage limit')
        )
    );

    // If Firestore reports missing composite index, gracefully switch to fallback query and show index creation link
    useEffect(() => {
        if (pledgesError && !useFallbackQuery) {
            const msg = pledgesError.message || pledgesError.toString();
            if (msg.includes('requires an index') || (pledgesError as any)?.code === 'failed-precondition') {
                const match = msg.match(/(https:\/\/console\.firebase\.google\.com[^\s]+)/);
                const url = match ? match[1] : 'https://console.firebase.google.com/v1/r/project/goldpledge-fa9b0/firestore/indexes?create_composite=ClBwcm9qZWN0cy9nb2xkcGxlZGdlLWZhOWIwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGVkZ2VzL2luZGV4ZXMvXxABGgoKBnNob3BJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI';
                setIndexErrorUrl(url);
                setUseFallbackQuery(true);
            }
        }
    }, [pledgesError, useFallbackQuery]);

    const [latestPledge, setLatestPledge] = useState<Pledge | null>(null);

    // Guaranteed TEP-2460 display: If counter has highest ID (e.g. 2460), ensure it is directly fetched if not in batch
    useEffect(() => {
        if (!firestore || !userProfile?.shopId || !counterDoc?.lastId) return;

        let cancelled = false;
        const fetchLatestPledge = async () => {
            const samplePrefix = pledges?.[0]?.id?.split('-')?.[0] || 'TEP';
            const targetId = `${samplePrefix}-${counterDoc.lastId}`;

            // If already in loaded pledges, no extra database query needed
            if (pledges?.some(p => p.id === targetId)) {
                setLatestPledge(null);
                return;
            }

            try {
                const docSnap = await getDoc(doc(firestore, 'pledges', targetId));
                if (!cancelled && docSnap.exists()) {
                    const data = { ...docSnap.data(), id: docSnap.id } as Pledge;
                    if (data.shopId === userProfile.shopId) {
                        setLatestPledge(data);
                    }
                }
            } catch (err) {
                console.warn("Could not direct-fetch latest pledge:", err);
            }
        };

        fetchLatestPledge();
        return () => {
            cancelled = true;
        };
    }, [counterDoc?.lastId, firestore, userProfile?.shopId, pledges]);

    const [directFoundPledge, setDirectFoundPledge] = useState<Pledge | null>(null);
    const [isSearchingDb, setIsSearchingDb] = useState(false);

    // Smart Direct ID Search: If user searches an ID not in current batch, fetch it directly from Firestore
    useEffect(() => {
        const term = searchTerm.trim().toUpperCase();
        if (!term || !firestore || !userProfile) {
            setDirectFoundPledge(null);
            return;
        }

        // If already in loaded pledges, no extra database query needed
        const alreadyLoaded = pledges?.some(p =>
            p.id.toUpperCase() === term ||
            p.id.toUpperCase().endsWith(`-${term}`)
        );
        if (alreadyLoaded) {
            setDirectFoundPledge(null);
            return;
        }

        let cancelled = false;
        const searchDirect = async () => {
            setIsSearchingDb(true);
            try {
                // Try exact ID (e.g. "PL-101" or "GP-5" or "TEP-2460")
                let pledgeDoc = await getDoc(doc(firestore, 'pledges', term));

                // If not found and term is digits (e.g. "2460"), try with shop prefix
                if (!pledgeDoc.exists() && /^\d+$/.test(term)) {
                    const samplePrefix = pledges?.[0]?.id?.split('-')?.[0] || 'TEP';
                    if (samplePrefix) {
                        pledgeDoc = await getDoc(doc(firestore, 'pledges', `${samplePrefix}-${term}`));
                    }
                }

                if (!cancelled && pledgeDoc.exists()) {
                    const data = { ...pledgeDoc.data(), id: pledgeDoc.id } as Pledge;
                    if (data.shopId === userProfile.shopId) {
                        setDirectFoundPledge(data);
                    }
                } else if (!cancelled) {
                    setDirectFoundPledge(null);
                }
            } catch (err) {
                console.error("Direct pledge lookup error:", err);
            } finally {
                if (!cancelled) setIsSearchingDb(false);
            }
        };

        const timer = setTimeout(searchDirect, 350);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchTerm, firestore, userProfile, pledges]);

    const allPledgesList = useMemo(() => {
        let list = pledges ? [...pledges] : [];
        if (latestPledge && !list.some(p => p.id === latestPledge.id)) {
            list.unshift(latestPledge);
        }
        if (directFoundPledge && !list.some(p => p.id === directFoundPledge.id)) {
            list.unshift(directFoundPledge);
        }
        return list;
    }, [pledges, latestPledge, directFoundPledge]);

    // Reset pagination to page 1 whenever search, filters, or page size change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, metalTypeFilter, startDate, endDate, pageSize, dataLimit]);

    const filteredPledges = useMemo(() => {
        if (!allPledgesList) return [];

        return allPledgesList
            .filter(pledge => {
                const pledgeDate = new Date(pledge.createdAt);
                const searchMatch = searchTerm
                    ? pledge.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    pledge.customerName.toLowerCase().includes(searchTerm.toLowerCase())
                    : true;
                const statusMatch = statusFilter !== 'All' ? pledge.status === statusFilter : true;
                const metalTypeMatch = metalTypeFilter !== 'All'
                    ? pledge.items.some(item => item.metalType === metalTypeFilter)
                    : true;
                const startDateMatch = startDate ? pledgeDate >= startDate : true;
                const endDateMatch = endDate ? pledgeDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1) : true;

                return searchMatch && statusMatch && metalTypeMatch && startDateMatch && endDateMatch;
            })
            .sort((a, b) => {
                // Extract numeric part after the hyphen (e.g., "TEP-2460" -> 2460)
                const numA = a.pledgeNo ?? parseInt(a.id.split('-').pop() || '0', 10);
                const numB = b.pledgeNo ?? parseInt(b.id.split('-').pop() || '0', 10);

                // Compare numerically descending (highest ID first, e.g. TEP-2460 before TEP-2459)
                if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                    return numB - numA;
                }

                // Fallback string comparison
                return (b.id || '').localeCompare(a.id || '', undefined, { numeric: true, sensitivity: 'base' });
            });
    }, [allPledgesList, searchTerm, statusFilter, metalTypeFilter, startDate, endDate]);
    // Paginated slice for the table view
    const totalPages = Math.max(1, Math.ceil(filteredPledges.length / pageSize));
    const paginatedPledges = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPledges.slice(start, start + pageSize);
    }, [filteredPledges, currentPage, pageSize]);

    const activePledges = filteredPledges?.filter(p => p.status === 'ACTIVE' || p.status === 'OVERDUE') || [];
    const totalLoanAmount = activePledges.reduce((sum, p) => sum + Number(p.loanAmount), 0);
    const { totalGoldWeight, totalSilverWeight, totalPacket } = useMemo(() => {
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
            { totalGoldWeight: 0, totalSilverWeight: 0, totalPacket: 0 }
        );
    }, [activePledges]);

    const showLoading = isLoadingPledges || (customerIdFilter ? isLoadingCustomer : false) || isUserLoading || isLoadingProfile;


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
                                    className="pl-9 pr-8 w-full sm:w-52"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {isSearchingDb && (
                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
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

                        <Select value={String(dataLimit)} onValueChange={(val) => setDataLimit(Number(val))}>
                            <SelectTrigger className="w-full sm:w-[130px]" title="Limit documents fetched from database to save quota">
                                <SelectValue placeholder="Data Limit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="25">Fetch 25</SelectItem>
                                <SelectItem value="50">Fetch 50</SelectItem>
                                <SelectItem value="100">Fetch 100</SelectItem>
                                <SelectItem value="250">Fetch 250</SelectItem>
                                <SelectItem value="500">Fetch 500</SelectItem>
                            </SelectContent>
                        </Select>

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
                {isQuotaExceeded && (
                    <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                        <div>
                            <strong>Daily Firestore Read Limit Reached:</strong> Firebase Spark Free Tier allows 50,000 document reads per day.
                            Displaying locally cached records. Queries are now capped to {dataLimit} records to save quota. The daily quota will automatically reset at midnight.
                        </div>
                    </div>
                )}
                {indexErrorUrl && (
                    <div className="mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>
                                <strong>Fast Loading Optimization:</strong> Click to create the Firestore composite index to fetch latest pledges directly from the database and save quota. (Currently displaying latest pledges in fallback mode).
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={indexErrorUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold underline text-primary hover:underline"
                            >
                                Create Index <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                    setUseFallbackQuery(false);
                                    setIndexErrorUrl(null);
                                }}
                            >
                                Retry Index
                            </Button>
                        </div>
                    </div>
                )}
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

                        {!showLoading && paginatedPledges?.map((pledge) => (
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
                    <div className="text-center text-muted-foreground py-10 space-y-3">
                        <p>
                            {searchTerm || statusFilter !== 'All' || startDate || endDate || metalTypeFilter !== 'All'
                                ? `No pledges found matching the current filters${dataLimit > 0 ? ` in the latest ${dataLimit} loaded records` : ''}.`
                                : customerIdFilter && customer
                                    ? `No pledges found for ${customer.name}.`
                                    : 'No pledges have been created yet.'
                            }
                        </p>
                        {dataLimit > 0 && (searchTerm || statusFilter !== 'All' || startDate || endDate || metalTypeFilter !== 'All') && (
                            <div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDataLimit(250)}
                                    className="gap-2"
                                >
                                    <Search className="h-4 w-4" />
                                    Fetch more records (Load 250)
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {!showLoading && filteredPledges && filteredPledges.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>
                                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredPledges.length)} to {Math.min(currentPage * pageSize, filteredPledges.length)} of {filteredPledges.length} pledges
                            </span>
                            {pledges && dataLimit > 0 && pledges.length >= dataLimit && (
                                <Badge variant="secondary" className="text-xs">
                                    Capped at {dataLimit} from DB
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs">Rows per page:</span>
                                <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-1 font-medium">
                                <span>Page {currentPage} of {totalPages}</span>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage <= 1}
                                    title="First Page"
                                >
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage <= 1}
                                    title="Previous Page"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage >= totalPages}
                                    title="Next Page"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage >= totalPages}
                                    title="Last Page"
                                >
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
