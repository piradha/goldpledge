
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirebase, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { Pledge, Payment, Customer, UserProfile, Shop , Scheme} from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { doc, query, where, collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateInterest } from '@/lib/interest';
import { ArrowLeft, CheckCircle, Printer, Loader2, Search, Banknote, Scale, History, ReceiptText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useForm, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { addPaymentAndUpdatePledge } from '@/firebase/firestore/pledges';
import { useEffect, useMemo, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import { RepledgeHistoryCard } from '@/app/(app)/pledges/repledge-history-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (val: number | undefined | null) => (Number(val) || 0).toLocaleString('en-IN');

const formSchema = z.object({
  paymentType: z.enum(['Interest', 'Partial', 'Settlement'], { required_error: 'Please select a payment type.' }),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  adjustment: z.coerce.number().optional().default(0),
  monthsToPay: z.coerce.number().optional(),
  paymentDate: z.date({ required_error: 'Please select a payment date.' }),
});

function MakePaymentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaidInterestSection({
  payments,
  totalInterestPaid,
  pledgeInterestPaid,
  isAdvanceInterest,
}: {
  payments: Payment[];
  totalInterestPaid: number;
  pledgeInterestPaid: number;
  isAdvanceInterest: boolean;
}) {
  if (payments.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground space-y-2">
        <Banknote className="mx-auto h-8 w-8 opacity-40 text-amber-500" />
        <p className="font-medium text-sm sm:text-base">No interest payments recorded yet for this pledge.</p>
        {isAdvanceInterest && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 py-1.5 px-3 rounded-md inline-block">
            ℹ️ 1st month advance interest was included at the time of pledge creation.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-12 text-center font-semibold">#</TableHead>
              <TableHead className="font-semibold">Payment Date</TableHead>
              <TableHead className="font-semibold">Receipt No</TableHead>
              <TableHead className="text-right font-semibold">Interest Paid</TableHead>
              <TableHead className="text-right font-semibold">Adjustment</TableHead>
              <TableHead className="text-center w-16 font-semibold">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p, idx) => (
              <TableRow key={p.id} className="hover:bg-muted/30">
                <TableCell className="text-center font-medium text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {p.paymentDate ? format(new Date(p.paymentDate), 'dd-MMM-yyyy') : '-'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {p.id.slice(-6).toUpperCase()}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                  ₹{(Number(p.amount) || 0).toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="text-right text-xs whitespace-nowrap">
                  {p.adjustment && Number(p.adjustment) !== 0 ? (
                    <span className={Number(p.adjustment) > 0 ? "text-amber-600 font-medium" : "text-blue-600 font-medium"}>
                      {Number(p.adjustment) > 0 ? `+₹${p.adjustment}` : `-₹${Math.abs(p.adjustment)}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="Print Receipt">
                    <Link href={`/print/payment/${p.id}`} target="_blank">
                      <Printer className="h-4 w-4" />
                      <span className="sr-only">Print Receipt</span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-bold">Total Interest Paid</TableCell>
              <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                ₹{formatCurrency(totalInterestPaid)}
              </TableCell>
              <TableCell colSpan={2} className="text-right text-xs text-muted-foreground">
                {(Number(pledgeInterestPaid) || 0) > (Number(totalInterestPaid) || 0) && (
                  <span>(Total recorded: ₹{formatCurrency(pledgeInterestPaid)})</span>
                )}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {isAdvanceInterest && (
        <p className="text-xs text-muted-foreground italic">
          * Month 1 advance interest was collected at pledge creation.
        </p>
      )}
    </div>
  );
}

function PartialPaymentsSection({
  payments,
  totalPrincipalPaid,
  outstandingPrincipal,
  loanAmount,
}: {
  payments: (Payment & { paymentIndex: number; remainingPrincipal: number })[];
  totalPrincipalPaid: number;
  outstandingPrincipal: number;
  loanAmount: number;
}) {
  if (payments.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground space-y-2">
        <Scale className="mx-auto h-8 w-8 opacity-40 text-emerald-500" />
        <p className="font-medium text-sm sm:text-base">No partial payments recorded yet for this pledge.</p>
        <p className="text-xs">
          Original loan amount remains ₹{formatCurrency(loanAmount)}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-12 text-center font-semibold">#</TableHead>
              <TableHead className="font-semibold">Payment Date</TableHead>
              <TableHead className="font-semibold">Receipt No</TableHead>
              <TableHead className="text-right font-semibold">Principal Paid</TableHead>
              <TableHead className="text-right font-semibold">Balance Principal</TableHead>
              <TableHead className="text-right font-semibold">Adjustment</TableHead>
              <TableHead className="text-center w-16 font-semibold">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p, idx) => (
              <TableRow key={p.id} className="hover:bg-muted/30">
                <TableCell className="text-center font-medium text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {p.paymentDate ? format(new Date(p.paymentDate), 'dd-MMM-yyyy') : '-'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {p.id.slice(-6).toUpperCase()}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                  ₹{(Number(p.amount) || 0).toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="text-right font-medium text-foreground whitespace-nowrap">
                  ₹{(Number(p.remainingPrincipal) || 0).toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="text-right text-xs whitespace-nowrap">
                  {p.adjustment && Number(p.adjustment) !== 0 ? (
                    <span className={Number(p.adjustment) > 0 ? "text-amber-600 font-medium" : "text-blue-600 font-medium"}>
                      {Number(p.adjustment) > 0 ? `+₹${p.adjustment}` : `-₹${Math.abs(p.adjustment)}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="Print Receipt">
                    <Link href={`/print/payment/${p.id}`} target="_blank">
                      <Printer className="h-4 w-4" />
                      <span className="sr-only">Print Receipt</span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-bold">Total Principal Paid</TableCell>
              <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                ₹{formatCurrency(totalPrincipalPaid)}
              </TableCell>
              <TableCell className="text-right font-bold text-foreground">
                Bal: ₹{formatCurrency(outstandingPrincipal)}
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

function AllPaymentsSection({
  payments,
}: {
  payments: Payment[];
}) {
  if (payments.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground space-y-2">
        <ReceiptText className="mx-auto h-8 w-8 opacity-40" />
        <p className="font-medium text-sm sm:text-base">No payments recorded yet for this pledge.</p>
      </div>
    );
  }

  const grandTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-12 text-center font-semibold">#</TableHead>
            <TableHead className="font-semibold">Payment Date</TableHead>
            <TableHead className="font-semibold">Receipt No</TableHead>
            <TableHead className="font-semibold">Payment Type</TableHead>
            <TableHead className="text-right font-semibold">Amount Paid</TableHead>
            <TableHead className="text-right font-semibold">Adjustment</TableHead>
            <TableHead className="text-center w-16 font-semibold">Receipt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p, idx) => (
            <TableRow key={p.id} className="hover:bg-muted/30">
              <TableCell className="text-center font-medium text-muted-foreground">{idx + 1}</TableCell>
              <TableCell className="font-medium whitespace-nowrap">
                {p.paymentDate ? format(new Date(p.paymentDate), 'dd-MMM-yyyy') : '-'}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {p.id.slice(-6).toUpperCase()}
              </TableCell>
              <TableCell>
                <Badge
                  variant={p.paymentType === 'Settlement' ? 'default' : p.paymentType === 'Partial' ? 'secondary' : 'outline'}
                  className={cn(
                    p.paymentType === 'Interest' && 'bg-blue-500/10 text-blue-600 border-blue-200',
                    p.paymentType === 'Partial' && 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
                    p.paymentType === 'Settlement' && 'bg-purple-500/10 text-purple-600 border-purple-200'
                  )}
                >
                  {p.paymentType === 'Interest' ? 'Interest Payment' : p.paymentType === 'Partial' ? 'Partial Principal' : 'Full Settlement'}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">
                ₹{(Number(p.amount) || 0).toLocaleString('en-IN')}
              </TableCell>
              <TableCell className="text-right text-xs whitespace-nowrap">
                {p.adjustment && Number(p.adjustment) !== 0 ? (
                  <span className={Number(p.adjustment) > 0 ? "text-amber-600 font-medium" : "text-blue-600 font-medium"}>
                    {Number(p.adjustment) > 0 ? `+₹${p.adjustment}` : `-₹${Math.abs(p.adjustment)}`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="Print Receipt">
                  <Link href={`/print/payment/${p.id}`} target="_blank">
                    <Printer className="h-4 w-4" />
                    <span className="sr-only">Print Receipt</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4} className="font-bold">Total Paid</TableCell>
            <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
              ₹{grandTotal.toLocaleString('en-IN')}
            </TableCell>
            <TableCell colSpan={2}></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export default function MakePaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const pledgeId = params.pledgeId as string;

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [searchPledgeId, setSearchPledgeId] = useState('');

  const handleSearchPledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchPledgeId.trim()) {
      router.push(`/pledges/${encodeURIComponent(searchPledgeId.trim())}/make-payment`);
    }
  };

  const pledgeRef = useMemoFirebase(
    () => (firestore && pledgeId ? doc(firestore, 'pledges', pledgeId) : null),
    [firestore, pledgeId]
  );
  const { data: pledge, isLoading: isLoadingPledge } = useDoc<Pledge>(pledgeRef);

   
  const userProfileQuery = useMemoFirebase(
      () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
      [firestore, user?.email]
  );
  const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
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

  const customerRef = useMemoFirebase(
    () => (firestore && pledge ? doc(firestore, 'customers', pledge.customerId) : null),
    [firestore, pledge]
  );
  const { data: customer, isLoading: isLoadingCustomer } = useDoc<Customer>(customerRef);
  
  const paymentsQuery = useMemoFirebase(
    () => (firestore && pledgeId ? query(collection(firestore, "payments"), where("pledgeId", "==", pledgeId)) : null),
    [firestore, pledgeId]
  );
  const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentType: undefined,
      amount: 0,
      monthsToPay: 1,
      adjustment: 0,
      paymentDate: new Date(),
    },
  });

  const paymentType = form.watch('paymentType');
  const monthsToPay = form.watch('monthsToPay');
  const amountToPay = form.watch('amount');
  const adjustment = form.watch('adjustment');
  const selectedPaymentDate = form.watch('paymentDate');
  
  const { grossInterestAccrued, currentInterestDue, totalDueForSettlement, outstandingPrincipal, interestPaid, monthsPassed, durationText, lastPartialDateText, breakdown, rate, isAdvanceInterest } = useMemo(() => {
    if (!pledge) return { 
      grossInterestAccrued: 0, 
      currentInterestDue: 0, 
      totalDueForSettlement: 0, 
      outstandingPrincipal: 0,
      interestPaid: 0,
      monthsPassed: 0,
      durationText: '',
      lastPartialDateText: null,
      breakdown: [],
      rate: 0,
      isAdvanceInterest: false
    };

    const { interestDue: gross, monthsPassed, breakdown,rate } = calculateInterest(pledge,scheme, selectedPaymentDate || new Date(), payments || []);
    const paid = Number(pledge.interestPaid) || 0;
    const due = Math.max(0, gross - paid);
    const outstanding = (Number(pledge.loanAmount) || 0) - (Number(pledge.paidAmount) || 0);
    const total = outstanding + due;

    // Calculate months and days duration
    let durationText = '';
    if (pledge.createdAt) {
      const startDate = new Date(pledge.createdAt);
      startDate.setHours(0, 0, 0, 0);
      const evalDate = new Date(selectedPaymentDate || new Date());
      evalDate.setHours(0, 0, 0, 0);

      if (evalDate > startDate) {
        let months = (evalDate.getFullYear() - startDate.getFullYear()) * 12 + (evalDate.getMonth() - startDate.getMonth());
        let tempDate = new Date(startDate);
        tempDate.setMonth(tempDate.getMonth() + months);

        if (tempDate > evalDate) {
          months -= 1;
          tempDate = new Date(startDate);
          tempDate.setMonth(tempDate.getMonth() + months);
        }

        const timeDiff = evalDate.getTime() - tempDate.getTime();
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        const monthsStr = months > 0 ? `${months} month${months !== 1 ? 's' : ''}` : '';
        const daysStr = days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : '';
        durationText = [monthsStr, daysStr].filter(Boolean).join(' ') || '0 days';
      } else {
        durationText = '0 days';
      }
    }

    // Find if a partial payment exists
    const partialPaymentsList = (payments || [])
      .filter(p => p.paymentType === 'Partial')
      .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
    const lastPartial = partialPaymentsList[partialPaymentsList.length - 1];
    const lastPartialDateText = lastPartial ? format(new Date(lastPartial.paymentDate), 'dd-MMM-yyyy') : null;

    const isAdvanceInterest = scheme?.advanceInterest ?? pledge.advanceInterest ?? false;

    return {
      grossInterestAccrued: gross,
      currentInterestDue: due,
      totalDueForSettlement: total,
      outstandingPrincipal: outstanding,
      interestPaid: paid,
      monthsPassed,
      durationText,
      lastPartialDateText,
      breakdown,
      rate,
      isAdvanceInterest
    };
  }, [pledge,scheme, selectedPaymentDate, payments]);

  const finalPaymentAmount = useMemo(() => {
    return (Number(amountToPay) || 0) + (Number(adjustment) || 0);
  }, [amountToPay, adjustment]);

  // Chronologically sorted payments for this pledge
  const sortedPayments = useMemo(() => {
    if (!payments) return [];
    return [...payments].sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
  }, [payments]);

  // All interest payments
  const interestPayments = useMemo(() => {
    return sortedPayments.filter(p => p.paymentType === 'Interest');
  }, [sortedPayments]);

  const totalInterestPaidFromPayments = useMemo(() => {
    return interestPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [interestPayments]);

  // All partial principal payments with progressive remaining balance
  const partialPaymentsWithBalance = useMemo(() => {
    if (!pledge) return [];
    let currentBalance = Number(pledge.loanAmount) || 0;
    return sortedPayments
      .filter(p => p.paymentType === 'Partial')
      .map((payment, idx) => {
        currentBalance = Math.max(0, currentBalance - (Number(payment.amount) || 0));
        return {
          ...payment,
          paymentIndex: idx + 1,
          remainingPrincipal: currentBalance,
        };
      });
  }, [sortedPayments, pledge]);

  const totalPartialPaidFromPayments = useMemo(() => {
    return partialPaymentsWithBalance.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [partialPaymentsWithBalance]);

  // Settlement payments if any
  const settlementPayments = useMemo(() => {
    return sortedPayments.filter(p => p.paymentType === 'Settlement');
  }, [sortedPayments]);


  useEffect(() => {
    if (!pledge) return;
    
    if (paymentType === 'Interest') {
      // Use outstanding principal (after partial payments), not the original loan amount
      const outstanding = (Number(pledge.loanAmount) || 0) - (Number(pledge.paidAmount) || 0);
      const activeRate = Number(rate || pledge.interestRate) || 0;
      const oneMonthInterest = outstanding * (activeRate / 100);
      form.setValue('amount', parseFloat((oneMonthInterest * (monthsToPay || 1)).toFixed(2)));
    } else if (paymentType === 'Settlement') {
      form.setValue('amount', parseFloat(totalDueForSettlement.toFixed(0)));
    } else if (paymentType === 'Partial') {
      // Don't auto-set amount for partial payments as user needs to enter it
    }
  }, [paymentType, monthsToPay, pledge, form, totalDueForSettlement, rate]);

  if (pledge && userProfile && pledge.shopId !== userProfile.shopId) {
      return (
            <Card className="text-center py-12">
              <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
                  <CardDescription>You do not have permission to view this page.</CardDescription>
              </CardHeader>
            </Card>
      )
  }

  const isLoading = isLoadingPledge || isLoadingCustomer || isLoadingPayments || isLoadingSchemes;

  if (isLoading) {
    return <MakePaymentSkeleton />;
  }

  if (!pledge) {
    return (
      <Card className="text-center py-12 max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle>Pledge Not Found</CardTitle>
          <CardDescription>The pledge with ID '{pledgeId}' could not be found.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearchPledge} className="flex gap-2 max-w-sm mx-auto">
            <Input
              type="text"
              placeholder="Enter valid Pledge ID..."
              value={searchPledgeId}
              onChange={(e) => setSearchPledgeId(e.target.value)}
            />
            <Button type="submit">Lookup</Button>
          </form>
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

  const onInvalid = (errors: FieldErrors<z.infer<typeof formSchema>>) => {
    console.error('MakePayment form validation failed:', errors);
    const firstErrorMessage = Object.values(errors)[0]?.message || 'Please check all required fields.';
    toast({
      variant: 'destructive',
      title: 'Validation Error',
      description: String(firstErrorMessage),
    });
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Firestore is not initialized. Please refresh and try again.',
      });
      return;
    }

    if (values.paymentType === 'Partial') {
      if (currentInterestDue > 0.1) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Outstanding interest must be fully paid before paying principal.',
        });
        return;
      }
      if (!values.amount || values.amount <= 0) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please enter a valid partial payment amount greater than ₹0.',
        });
        return;
      }
      if (values.amount > outstandingPrincipal) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: `Payment cannot exceed outstanding principal of ₹${outstandingPrincipal.toLocaleString('en-IN')}.`,
        });
        return;
      }
    }

    const paymentData: Omit<Payment, 'id' | 'pledgeId' | 'shopId'> = {
      amount: finalPaymentAmount, // Use the final calculated amount
      paymentType: values.paymentType,
      adjustment: Number(values.adjustment) || 0,
      paymentDate: values.paymentDate.toISOString(),
    };

    try {
      const principalPayment = values.paymentType === 'Settlement' 
        ? outstandingPrincipal 
        : (values.paymentType === 'Partial' ? values.amount : 0);
      const paymentId = await addPaymentAndUpdatePledge(firestore, pledge.id, paymentData, principalPayment);

      toast({
        title: 'Payment Recorded',
        description: `₹${finalPaymentAmount.toLocaleString('en-IN')} payment has been recorded.`,
      });

      setLastPaymentId(paymentId);
      setShowSuccessDialog(true);
      try {
        window.open(`/print/payment/${paymentId}`, '_blank');
      } catch (e) {
        console.warn('Popup blocked for receipt print:', e);
      }
      
    } catch (error: any) {
      console.error('Error making payment:', error);
      toast({
        variant: 'destructive',
        title: 'Payment Error',
        description: error?.message || 'Failed to record payment. Please try again.',
      });
    }
  };

  return (
    <>
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon">
            <Link href={`/pledges/${pledgeId}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Make Payment</h1>
            <p className="text-sm text-muted-foreground">Pledge ID: <span className="font-semibold text-foreground">{pledge.id}</span></p>
          </div>
        </div>

        {/* Quick Search / Switch Pledge ID */}
        <form onSubmit={handleSearchPledge} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Switch Pledge ID..."
              value={searchPledgeId}
              onChange={(e) => setSearchPledgeId(e.target.value)}
              className="pl-8 w-44 sm:w-56 h-9 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Go
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pledge Summary for {pledge.customerName}</CardTitle>
              <CardDescription>Pledge ID: {pledge.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-base sm:text-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Amount:</span>
                <span className="font-medium">₹{formatCurrency(pledge.loanAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Principal Paid:</span>
                <div className="text-right">
                  <span className="font-medium text-green-500">₹{formatCurrency(pledge.paidAmount)}</span>
                  {partialPaymentsWithBalance.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1.5 font-normal">
                      ({partialPaymentsWithBalance.length} payment{partialPaymentsWithBalance.length === 1 ? '' : 's'})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding Principal:</span>
                <span className="font-medium">₹{formatCurrency(outstandingPrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Date:</span>
                <span className="font-medium">
                  {pledge.createdAt ? format(new Date(pledge.createdAt), 'dd-MMM-yyyy') : '-'}
                </span>
              </div>
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate of Interest:</span>
                <span className="font-medium">
                  {pledge.interestTiers && pledge.interestTiers.length > 0 
                    ? `${pledge.interestRate}% p.m. (Tiered)` 
                    : `${pledge.interestRate}% p.m.`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Duration:</span>
                <span className="font-medium">{durationText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Interest Accrued {selectedPaymentDate ? `(till ${format(selectedPaymentDate, 'MMM do')})` : ''}:
                </span>
                <span className="font-medium text-amber-500">
                  ₹{Math.round(grossInterestAccrued).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="pl-4 border-l-2 border-amber-200 dark:border-amber-900 space-y-1.5 py-0.5 my-1">
                <div className="flex justify-between text-sm sm:text-base text-muted-foreground">
                  <span>Total Months Passed:</span>
                  <span className="font-medium">
                    {lastPartialDateText 
                      ? `${monthsPassed} months (since payment on ${lastPartialDateText})`
                      : isAdvanceInterest
                        ? `${monthsPassed} months (${Math.max(0, monthsPassed - 1)} billable)`
                        : `${monthsPassed} months (${monthsPassed} billable)`}
                  </span>
                </div>

                {breakdown && breakdown.length > 0 ? (
                  <div className="mt-2 space-y-1 bg-amber-50/50 dark:bg-amber-950/10 p-2 rounded border border-amber-100 dark:border-amber-900/50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Interest Breakdown (Month-wise):
                    </span>
                    {breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs sm:text-sm text-muted-foreground pl-2 border-l border-amber-200 dark:border-amber-800">
                        <span>
                          Month {item.monthIndex}: {item.rate}% of ₹{item.principal.toLocaleString('en-IN')}
                        </span>
                        <span className="font-medium">
                          ₹{Math.round(item.interestAccrued).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm sm:text-base text-muted-foreground">
                      <span>One Month Interest:</span>
                      <span className="font-medium">₹{Math.round(outstandingPrincipal * ((rate || pledge.interestRate) / 100)).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-sm sm:text-base text-muted-foreground">
                      <span>Calculation:</span>
                      <span className="font-medium">
                        {lastPartialDateText 
                          ? `${monthsPassed} months × ₹${Math.round(outstandingPrincipal * ((rate || pledge.interestRate) / 100)).toLocaleString('en-IN')} = ₹${Math.round(grossInterestAccrued).toLocaleString('en-IN')}`
                          : `${Math.max(0, monthsPassed - 1)} months × ₹${Math.round(outstandingPrincipal * ((rate || pledge.interestRate) / 100)).toLocaleString('en-IN')} = ₹${Math.round(grossInterestAccrued).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest Paid:</span>
                <div className="text-right">
                  <span className="font-medium text-green-500">
                    ₹{Math.round(interestPaid).toLocaleString('en-IN')}
                  </span>
                  {interestPayments.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1.5 font-normal">
                      ({interestPayments.length} payment{interestPayments.length === 1 ? '' : 's'})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest Due:</span>
                <span className="font-medium text-destructive">
                  ₹{Math.round(currentInterestDue).toLocaleString('en-IN')}
                </span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-lg sm:text-xl pt-1">
                <span>Total Due for Full Settlement:</span>
                <span className="text-amber-500">₹{Math.round(totalDueForSettlement).toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
          </Card>

          <RepledgeHistoryCard pledge={pledge} variant="compact" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit, onInvalid)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Payment Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Interest">Interest Payment</SelectItem>
                          <SelectItem value="Partial" disabled={currentInterestDue > 0.1}>
                            Partial Principal Payment {currentInterestDue > 0.1 && " (Pay interest first)"}
                          </SelectItem>
                          <SelectItem value="Settlement">Full Settlement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {paymentType === 'Interest' && (
                  <FormField
                    control={form.control}
                    name="monthsToPay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Months to Pay</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 1"
                            min="1"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className={cn(paymentType === 'Interest' || paymentType === 'Settlement' ? '' : '')}>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter payment amount"
                          min="0"
                          readOnly={paymentType === 'Interest' || paymentType === 'Settlement'}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="adjustment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjustment (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., -10 for discount, 10 for charge"
                          {...field}
                        />
                      </FormControl>
                       <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                  <div className="flex justify-between items-center text-lg font-bold">
                      <FormLabel>Final Payment Amount</FormLabel>
                      <span>₹{Math.round(finalPaymentAmount).toLocaleString('en-IN')}</span>
                  </div>
                <Separator />


                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={form.formState.isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {form.formState.isSubmitting ? 'Recording Payment...' : 'Record Payment'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Payment Records: Paid Interest & Partial Payments for this pledgeId */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <span>Payment Records for Pledge {pledge.id}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Review paid interest and partial principal payment details for {pledge.customerName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium py-1 px-2.5 bg-background">
              Total Interest Paid: <span className="font-semibold text-green-600 dark:text-green-400 ml-1">₹{formatCurrency(interestPaid)}</span>
            </Badge>
            <Badge variant="outline" className="text-xs font-medium py-1 px-2.5 bg-background">
              Principal Paid: <span className="font-semibold text-green-600 dark:text-green-400 ml-1">₹{formatCurrency(pledge.paidAmount)}</span>
            </Badge>
            <Badge variant="outline" className="text-xs font-medium py-1 px-2.5 bg-background">
              Outstanding: <span className="font-semibold text-amber-600 ml-1">₹{formatCurrency(outstandingPrincipal)}</span>
            </Badge>
          </div>
        </div>

        {settlementPayments.length > 0 && (
          <div className="space-y-2">
            {settlementPayments.map(sp => (
              <div
                key={sp.id}
                className="p-4 rounded-lg border border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-base text-purple-900 dark:text-purple-300">
                      Pledge Full Settlement Recorded
                    </h4>
                    <p className="text-sm text-purple-700 dark:text-purple-400">
                      Settlement payment of ₹{formatCurrency(sp.amount)} recorded on{' '}
                      {format(new Date(sp.paymentDate), 'dd-MMM-yyyy')} (Receipt #{sp.id.slice(-6).toUpperCase()})
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:text-purple-300 shrink-0">
                  <Link href={`/print/payment/${sp.id}`} target="_blank">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Settlement Receipt
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="overview" className="w-full">
          <div className="flex items-center justify-between overflow-x-auto pb-1">
            <TabsList className="grid w-full sm:w-auto grid-cols-4 max-w-lg">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="interest" className="text-xs sm:text-sm">
                Paid Interest ({interestPayments.length})
              </TabsTrigger>
              <TabsTrigger value="partial" className="text-xs sm:text-sm">
                Partial ({partialPaymentsWithBalance.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All ({sortedPayments.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Paid Interest Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-amber-500" />
                      <span>Paid Interest Details</span>
                    </CardTitle>
                    <Badge variant="secondary" className="font-semibold">
                      {interestPayments.length} payment{interestPayments.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <CardDescription>
                    History of interest payments recorded for this pledge
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PaidInterestSection
                    payments={interestPayments}
                    totalInterestPaid={totalInterestPaidFromPayments}
                    pledgeInterestPaid={Number(interestPaid) || 0}
                    isAdvanceInterest={isAdvanceInterest}
                  />
                </CardContent>
              </Card>

              {/* Partial Payment Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Scale className="h-5 w-5 text-emerald-500" />
                      <span>Partial Payment Details</span>
                    </CardTitle>
                    <Badge variant="secondary" className="font-semibold">
                      {partialPaymentsWithBalance.length} payment{partialPaymentsWithBalance.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <CardDescription>
                    Principal reductions and balance progression
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PartialPaymentsSection
                    payments={partialPaymentsWithBalance}
                    totalPrincipalPaid={totalPartialPaidFromPayments}
                    outstandingPrincipal={outstandingPrincipal}
                    loanAmount={Number(pledge.loanAmount) || 0}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="interest" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-amber-500" />
                      <span>Paid Interest Details (Pledge: {pledge.id})</span>
                    </CardTitle>
                    <CardDescription>
                      Full history of interest payments collected for this pledge
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold text-green-600 dark:text-green-400">
                    Total Interest Paid: ₹{formatCurrency(interestPaid)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PaidInterestSection
                  payments={interestPayments}
                  totalInterestPaid={totalInterestPaidFromPayments}
                  pledgeInterestPaid={Number(interestPaid) || 0}
                  isAdvanceInterest={isAdvanceInterest}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partial" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="h-5 w-5 text-emerald-500" />
                      <span>Partial Principal Payment Details (Pledge: {pledge.id})</span>
                    </CardTitle>
                    <CardDescription>
                      Principal reductions, date recorded, and remaining principal
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs sm:text-sm px-2.5 py-1">
                      Loan: ₹{formatCurrency(pledge.loanAmount)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs sm:text-sm px-2.5 py-1 text-emerald-600 font-semibold">
                      Paid: ₹{formatCurrency(pledge.paidAmount)}
                    </Badge>
                    <Badge variant="destructive" className="text-xs sm:text-sm px-2.5 py-1 font-semibold">
                      Due: ₹{formatCurrency(outstandingPrincipal)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PartialPaymentsSection
                  payments={partialPaymentsWithBalance}
                  totalPrincipalPaid={totalPartialPaidFromPayments}
                  outstandingPrincipal={outstandingPrincipal}
                  loanAmount={Number(pledge.loanAmount) || 0}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ReceiptText className="h-5 w-5 text-primary" />
                      <span>All Payment Transactions (Pledge: {pledge.id})</span>
                    </CardTitle>
                    <CardDescription>
                      Complete chronological ledger of all interest, partial, and settlement payments
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
                    {sortedPayments.length} Total Transaction{sortedPayments.length === 1 ? '' : 's'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <AllPaymentsSection payments={sortedPayments} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>

    <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            </div>
            <DialogTitle className="text-center text-2xl">Payment Successful</DialogTitle>
            <DialogDescription className="text-center">
                The payment has been recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-4 py-4">
            <DialogClose asChild>
                <Button variant="outline" onClick={() => router.push(`/pledges/${pledgeId}`)}>Close</Button>
            </DialogClose>
            <Button asChild>
                <Link href={`/print/payment/${lastPaymentId}`} target="_blank">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
