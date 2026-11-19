"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { collection, query, where, doc, getDoc } from "firebase/firestore";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Payment, Pledge, Customer, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ImagePreviewDialog } from "@/app/(app)/customers/image-preview-dialog";

import {
  Receipt,
  Search,
  Calendar as CalendarIcon,
  Printer,
  User,
  BookHeart,
  PlusCircle,
  RotateCcw,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  Phone,
  MoreHorizontal,
  Wallet,
  TrendingUp,
  CreditCard,
  MapPin,
} from "lucide-react";

function formatPaymentDate(dateStr?: string) {
  if (!dateStr) return { date: "-", time: "" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: dateStr, time: "" };
    return {
      date: format(d, "dd MMM yyyy"),
      time: format(d, "hh:mm a"),
    };
  } catch {
    return { date: dateStr || "-", time: "" };
  }
}

function getPaymentTypeBadge(type: Payment["paymentType"]) {
  switch (type) {
    case "Interest":
      return {
        label: "Interest",
        className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-medium",
      };
    case "Partial":
      return {
        label: "Partial Principal",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-medium",
      };
    case "Settlement":
      return {
        label: "Settlement",
        className: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-medium",
      };
    default:
      return {
        label: type,
        className: "bg-secondary text-secondary-foreground",
      };
  }
}

function PaymentRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-md" /></TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
    </TableRow>
  );
}

export default function PaymentsList() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fallback cache for pledges or customers not loaded in bulk query
  const [extraPledges, setExtraPledges] = useState<Record<string, Pledge>>({});
  const [extraCustomers, setExtraCustomers] = useState<Record<string, Customer>>({});

  // 1. Fetch current user profile to determine shopId
  const userProfileQuery = useMemoFirebase(
    () => (firestore && user?.email ? query(collection(firestore, "users"), where("email", "==", user.email)) : null),
    [firestore, user?.email]
  );
  const { data: userProfiles, isLoading: isLoadingProfile } = useCollection<UserProfile>(userProfileQuery);
  const userProfile = useMemo(() => (userProfiles && userProfiles[0] ? userProfiles[0] : null), [userProfiles]);

  // 2. Fetch all payments for this shop
  const paymentsQuery = useMemoFirebase(
    () => (firestore && userProfile?.shopId ? query(collection(firestore, "payments"), where("shopId", "==", userProfile.shopId)) : null),
    [firestore, userProfile?.shopId]
  );
  const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);

  // 3. Fetch pledges for mapping pledge info (customerName, loanAmount, status)
  const pledgesQuery = useMemoFirebase(
    () => (firestore && userProfile?.shopId ? query(collection(firestore, "pledges"), where("shopId", "==", userProfile.shopId)) : null),
    [firestore, userProfile?.shopId]
  );
  const { data: pledges, isLoading: isLoadingPledges } = useCollection<Pledge>(pledgesQuery);

  // 4. Fetch customers for mapping customer detail (photo, contact, address)
  const customersQuery = useMemoFirebase(
    () => (firestore && userProfile?.shopId ? query(collection(firestore, "customers"), where("shopId", "==", userProfile.shopId)) : null),
    [firestore, userProfile?.shopId]
  );
  const { data: customers, isLoading: isLoadingCustomers } = useCollection<Customer>(customersQuery);

  // Lookup maps
  const pledgesMap = useMemo(() => {
    const map = new Map<string, Pledge>();
    if (pledges) {
      pledges.forEach((p) => map.set(p.id, p));
    }
    return map;
  }, [pledges]);

  const customersMap = useMemo(() => {
    const map = new Map<string, Customer>();
    if (customers) {
      customers.forEach((c) => map.set(c.id, c));
    }
    return map;
  }, [customers]);

  // Asynchronously resolve missing pledges or customers if not present in shop collections
  useEffect(() => {
    if (!firestore || !payments) return;

    payments.forEach(async (p) => {
      // Check if pledge needs fetching
      if (p.pledgeId && !pledgesMap.has(p.pledgeId) && !extraPledges[p.pledgeId]) {
        try {
          const pledgeDoc = await getDoc(doc(firestore, "pledges", p.pledgeId));
          if (pledgeDoc.exists()) {
            const fetchedPledge = { ...pledgeDoc.data(), id: pledgeDoc.id } as Pledge;
            setExtraPledges((prev) => ({ ...prev, [p.pledgeId]: fetchedPledge }));

            // If pledge has customerId and customer is missing, fetch customer too
            if (fetchedPledge.customerId && !customersMap.has(fetchedPledge.customerId) && !extraCustomers[fetchedPledge.customerId]) {
              const custDoc = await getDoc(doc(firestore, "customers", fetchedPledge.customerId));
              if (custDoc.exists()) {
                setExtraCustomers((prev) => ({ ...prev, [fetchedPledge.customerId]: { ...custDoc.data(), id: custDoc.id } as Customer }));
              }
            }
          }
        } catch (e) {
          console.warn(`Could not resolve pledge ${p.pledgeId}:`, e);
        }
      }

      // Check if customerId is directly on payment and needs fetching
      if (p.customerId && !customersMap.has(p.customerId) && !extraCustomers[p.customerId]) {
        try {
          const custDoc = await getDoc(doc(firestore, "customers", p.customerId));
          if (custDoc.exists()) {
            setExtraCustomers((prev) => ({ ...prev, [p.customerId!]: { ...custDoc.data(), id: custDoc.id } as Customer }));
          }
        } catch (e) {
          console.warn(`Could not resolve customer ${p.customerId}:`, e);
        }
      }
    });
  }, [firestore, payments, pledgesMap, customersMap, extraPledges, extraCustomers]);

  // Combined enrichment & filtering
  const enrichedPayments = useMemo(() => {
    if (!payments) return [];

    return payments.map((payment) => {
      const pledge = pledgesMap.get(payment.pledgeId) || extraPledges[payment.pledgeId];
      const customerId = payment.customerId || pledge?.customerId;
      const customer = customerId ? customersMap.get(customerId) || extraCustomers[customerId] : null;

      const customerName =
        customer?.name ||
        payment.customerName ||
        pledge?.customerName ||
        "Unknown Customer";

      const customerMobile =
        customer?.mobileNumber ||
        customer?.alternateMobile ||
        payment.customerMobile ||
        "";

      const customerAddress = customer?.address || "";
      const customerFatherName = customer?.fatherName || "";
      const customerPhoto = customer?.photoUrl || "";

      return {
        ...payment,
        pledge,
        customer,
        customerId,
        customerName,
        customerMobile,
        customerAddress,
        customerFatherName,
        customerPhoto,
      };
    });
  }, [payments, pledgesMap, customersMap, extraPledges, extraCustomers]);

  // Apply filters & search
  const filteredPayments = useMemo(() => {
    // Sort latest payments first
    let result = [...enrichedPayments].sort((a, b) => {
      const timeA = new Date(a.paymentDate).getTime();
      const timeB = new Date(b.paymentDate).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    // 1. Payment Type filter
    if (typeFilter !== "ALL") {
      result = result.filter((p) => p.paymentType === typeFilter);
    }

    // 2. Date preset filter
    const now = new Date();
    if (datePreset === "TODAY") {
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      result = result.filter((p) => {
        const d = new Date(p.paymentDate);
        return !isNaN(d.getTime()) && isWithinInterval(d, { start: todayStart, end: todayEnd });
      });
    } else if (datePreset === "7DAYS") {
      const sevenDaysAgo = startOfDay(subDays(now, 7));
      const todayEnd = endOfDay(now);
      result = result.filter((p) => {
        const d = new Date(p.paymentDate);
        return !isNaN(d.getTime()) && isWithinInterval(d, { start: sevenDaysAgo, end: todayEnd });
      });
    } else if (datePreset === "MONTH") {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      result = result.filter((p) => {
        const d = new Date(p.paymentDate);
        return !isNaN(d.getTime()) && isWithinInterval(d, { start: monthStart, end: monthEnd });
      });
    } else if (datePreset === "CUSTOM" && (customStartDate || customEndDate)) {
      const start = customStartDate ? startOfDay(customStartDate) : new Date(0);
      const end = customEndDate ? endOfDay(customEndDate) : new Date(8640000000000000);
      result = result.filter((p) => {
        const d = new Date(p.paymentDate);
        return !isNaN(d.getTime()) && isWithinInterval(d, { start, end });
      });
    }

    // 3. Search Term filter
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.pledgeId?.toLowerCase().includes(term) ||
          p.customerName?.toLowerCase().includes(term) ||
          p.customerMobile?.toLowerCase().includes(term) ||
          p.id?.toLowerCase().includes(term) ||
          p.paymentType?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [enrichedPayments, typeFilter, datePreset, customStartDate, customEndDate, searchTerm]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalAmount = 0;
    let interestAmount = 0;
    let partialAmount = 0;
    let settlementAmount = 0;

    filteredPayments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      totalAmount += amt;
      if (p.paymentType === "Interest") interestAmount += amt;
      else if (p.paymentType === "Partial") partialAmount += amt;
      else if (p.paymentType === "Settlement") settlementAmount += amt;
    });

    return {
      count: filteredPayments.length,
      totalAmount,
      interestAmount,
      principalAndSettlement: partialAmount + settlementAmount,
    };
  }, [filteredPayments]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPayments.length / pageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredPayments.slice(startIndex, startIndex + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, datePreset, customStartDate, customEndDate, pageSize]);

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "ALL" || datePreset !== "ALL";

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("ALL");
    setDatePreset("ALL");
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
  };

  const isLoading = isLoadingProfile || isLoadingPayments || isUserLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-8 w-8 text-primary" />
            <span>Payments</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete history of customer payments, interest receipts, and pledge settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/pledges/make-payment">
              <PlusCircle className="h-4 w-4" />
              <span>Make Payment</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collections</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                ₹{stats.totalAmount.toLocaleString("en-IN")}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              From {stats.count} recorded payment{stats.count === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interest Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                ₹{stats.interestAmount.toLocaleString("en-IN")}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total interest income</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Principal / Settlement</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₹{stats.principalAndSettlement.toLocaleString("en-IN")}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Principal recoveries & releases</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats.count}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveFilters ? "Matching current filter" : "All transactions recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">Payment Records</CardTitle>
              <CardDescription>
                Detailed list showing pledge ID, payment type, customer details, and receipt actions
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pledge, customer, phone..."
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Payment Type Dropdown */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Payment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="Interest">Interest</SelectItem>
                  <SelectItem value="Partial">Partial Principal</SelectItem>
                  <SelectItem value="Settlement">Settlement</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Preset Dropdown */}
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Time</SelectItem>
                  <SelectItem value="TODAY">Today</SelectItem>
                  <SelectItem value="7DAYS">Last 7 Days</SelectItem>
                  <SelectItem value="MONTH">This Month</SelectItem>
                  <SelectItem value="CUSTOM">Custom Date</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Range Picker */}
              {datePreset === "CUSTOM" && (
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>
                        {customStartDate ? format(customStartDate, "dd/MM/yy") : "From"} -{" "}
                        {customEndDate ? format(customEndDate, "dd/MM/yy") : "To"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 space-y-4" align="end">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold mb-1 text-muted-foreground">Start Date</div>
                        <Calendar
                          mode="single"
                          selected={customStartDate}
                          onSelect={setCustomStartDate}
                          initialFocus
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-1 text-muted-foreground">End Date</div>
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={(d) => {
                            setCustomEndDate(d);
                            setIsDatePickerOpen(false);
                          }}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground hover:text-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[160px]">Payment Date</TableHead>
                  <TableHead className="w-[130px]">Pledge ID</TableHead>
                  <TableHead className="min-w-[220px]">Customer Detail</TableHead>
                  <TableHead className="w-[150px]">Payment Type</TableHead>
                  <TableHead className="text-right w-[150px]">Amount Paid</TableHead>
                  <TableHead className="text-center w-[110px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <PaymentRowSkeleton key={i} />)
                ) : paginatedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-44 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="rounded-full bg-muted p-3">
                          <Receipt className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-semibold">No payments found</p>
                          <p className="text-sm text-muted-foreground">
                            {hasActiveFilters
                              ? "Try adjusting your search query or date filters."
                              : "No payments have been recorded for this shop yet."}
                          </p>
                        </div>
                        {hasActiveFilters ? (
                          <Button variant="outline" size="sm" onClick={clearFilters}>
                            Clear Filters
                          </Button>
                        ) : (
                          <Button asChild size="sm">
                            <Link href="/pledges/make-payment">Record First Payment</Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayments.map((payment) => {
                    const { date, time } = formatPaymentDate(payment.paymentDate);
                    const typeBadge = getPaymentTypeBadge(payment.paymentType);
                    const amount = Number(payment.amount) || 0;
                    const adjustment = Number(payment.adjustment) || 0;

                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                        {/* Payment Date & Time */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{date}</span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                          </div>
                        </TableCell>

                        {/* Pledge ID */}
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Link
                              href={`/pledges/${encodeURIComponent(payment.pledgeId)}`}
                              className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                              title="View pledge details"
                            >
                              <BookHeart className="h-3.5 w-3.5" />
                              <span>{payment.pledgeId}</span>
                            </Link>
                            {payment.pledge && (
                              <Badge
                                variant={
                                  payment.pledge.status === "OVERDUE"
                                    ? "destructive"
                                    : payment.pledge.status === "CLOSED"
                                    ? "outline"
                                    : "secondary"
                                }
                                className={cn(
                                  "text-[10px] px-1.5 py-0 h-4 font-normal",
                                  payment.pledge.status === "ACTIVE" &&
                                    "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20"
                                )}
                              >
                                {payment.pledge.status}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Customer Detail */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {/* Photo / Avatar */}
                            {payment.customerPhoto ? (
                              <ImagePreviewDialog imageUrl={payment.customerPhoto} name={payment.customerName}>
                                <Avatar className="h-9 w-9 cursor-pointer border ring-1 ring-border shadow-xs hover:scale-105 transition-transform">
                                  <AvatarImage src={payment.customerPhoto} alt={payment.customerName} />
                                  <AvatarFallback className="font-semibold text-xs">
                                    {payment.customerName.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </ImagePreviewDialog>
                            ) : (
                              <Avatar className="h-9 w-9 border shadow-xs">
                                <AvatarFallback className="font-semibold text-xs bg-primary/10 text-primary">
                                  {payment.customerName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            {/* Customer Name, Phone, and Address/Relation */}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                {payment.customerId ? (
                                  <Link
                                    href={`/customers/${encodeURIComponent(payment.customerId)}`}
                                    className="font-medium text-sm text-foreground hover:text-primary hover:underline truncate"
                                    title="View customer profile"
                                  >
                                    {payment.customerName}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-sm text-foreground truncate">
                                    {payment.customerName}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground mt-0.5">
                                {payment.customerMobile ? (
                                  <span className="inline-flex items-center gap-0.5 font-mono">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {payment.customerMobile}
                                  </span>
                                ) : null}

                                {payment.customerFatherName ? (
                                  <span className="truncate max-w-[140px] text-[11px]">
                                    S/o {payment.customerFatherName}
                                  </span>
                                ) : payment.customerAddress ? (
                                  <span className="inline-flex items-center gap-0.5 truncate max-w-[140px] text-[11px]" title={payment.customerAddress}>
                                    <MapPin className="h-2.5 w-2.5" />
                                    {payment.customerAddress}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Payment Type */}
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs py-0.5 px-2", typeBadge.className)}>
                            {typeBadge.label}
                          </Badge>
                        </TableCell>

                        {/* Amount Paid */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-foreground text-sm">
                              ₹{amount.toLocaleString("en-IN")}
                            </span>
                            {adjustment !== 0 && (
                              <span
                                className={cn(
                                  "text-[11px] font-medium",
                                  adjustment > 0 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                                )}
                              >
                                {adjustment > 0 ? `+₹${adjustment} adj` : `-₹${Math.abs(adjustment)} adj`}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Quick Print Receipt Button */}
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-primary hover:bg-primary/10"
                              title="Print Payment Receipt"
                            >
                              <Link href={`/print/payment/${encodeURIComponent(payment.id)}`} target="_blank">
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">Print Receipt</span>
                              </Link>
                            </Button>

                            {/* Dropdown Menu for More Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/print/payment/${encodeURIComponent(payment.id)}`} target="_blank">
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print Receipt
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/pledges/${encodeURIComponent(payment.pledgeId)}`}>
                                    <BookHeart className="mr-2 h-4 w-4" />
                                    View Pledge
                                  </Link>
                                </DropdownMenuItem>
                                {payment.customerId && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/customers/${encodeURIComponent(payment.customerId)}`}>
                                      <User className="mr-2 h-4 w-4" />
                                      View Customer
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem asChild>
                                  <Link href={`/pledges/${encodeURIComponent(payment.pledgeId)}/make-payment`}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Pledge Payments
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {!isLoading && filteredPayments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/60">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredPayments.length)} of {filteredPayments.length} payments
                </span>
                <span className="mx-1">•</span>
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => setPageSize(Number(val))}
                  >
                    <SelectTrigger className="h-7 w-[70px] text-xs">
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
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-xs font-medium px-2">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
