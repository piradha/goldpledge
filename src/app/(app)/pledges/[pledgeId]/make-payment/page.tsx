
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirebase, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { Pledge, Payment, Customer, UserProfile, Shop , Scheme} from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { doc, query, where, collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateInterest } from '@/lib/interest';
import { ArrowLeft, CheckCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
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

export default function MakePaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const pledgeId = params.pledgeId as string;

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

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
  
  const { grossInterestAccrued, currentInterestDue, totalDueForSettlement, outstandingPrincipal, interestPaid, monthsPassed, durationText, lastPartialDateText, breakdown,rate } = useMemo(() => {
    if (!pledge) return { 
      grossInterestAccrued: 0, 
      currentInterestDue: 0, 
      totalDueForSettlement: 0, 
      outstandingPrincipal: 0,
      interestPaid: 0,
      monthsPassed: 0,
      durationText: '',
      lastPartialDateText: null,
      breakdown: []
    };

    const { interestDue: gross, monthsPassed, breakdown,rate } = calculateInterest(pledge,scheme, selectedPaymentDate || new Date(), payments || []);
    const paid = pledge.interestPaid || 0;
    const due = Math.max(0, gross - paid);
    const outstanding = pledge.loanAmount - pledge.paidAmount;
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
      rate
    };
  }, [pledge,scheme, selectedPaymentDate, payments]);

  const finalPaymentAmount = useMemo(() => {
    return (Number(amountToPay) || 0) + (Number(adjustment) || 0);
  }, [amountToPay, adjustment]);


  useEffect(() => {
    if (!pledge) return;
    
    if (paymentType === 'Interest') {
      // Use outstanding principal (after partial payments), not the original loan amount
      const outstanding = pledge.loanAmount - pledge.paidAmount;
      const oneMonthInterest = outstanding * (pledge.interestRate / 100);
      form.setValue('amount', parseFloat((oneMonthInterest * (monthsToPay || 1)).toFixed(2)));
    } else if (paymentType === 'Settlement') {
      form.setValue('amount', parseFloat(totalDueForSettlement.toFixed(0)));
    } else if (paymentType === 'Partial') {
      // Don't auto-set amount for partial payments as user needs to enter it
    }
  }, [paymentType, monthsToPay, pledge, form, totalDueForSettlement]);

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

  const isLoading = isLoadingPledge || isLoadingCustomer || isLoadingPayments|| isLoadingSchemes||
  !scheme;

  if (isLoading) {
    return <MakePaymentSkeleton />;
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

  // These values are now calculated via useMemo above

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;

    if (values.paymentType === 'Partial' && currentInterestDue > 0.1) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Outstanding interest must be fully paid before paying principal.',
      });
      return;
    }

    const paymentData: Omit<Payment, 'id' | 'pledgeId' | 'shopId'> = {
      amount: finalPaymentAmount, // Use the final calculated amount
      paymentType: values.paymentType,
      adjustment: values.adjustment,
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
      window.open(`/print/payment/${paymentId}`, '_blank');
      
    } catch (error) {
      console.error('Error making payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to record payment. Please try again.',
      });
    }
  };

  return (
    <>
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href={`/pledges/${pledgeId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Make Payment</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Pledge Summary for {pledge.customerName}</CardTitle>
            <CardDescription>Pledge ID: {pledge.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-base sm:text-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Amount:</span>
              <span className="font-medium">₹{pledge.loanAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal Paid:</span>
              <span className="font-medium text-green-500">₹{pledge.paidAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding Principal:</span>
              <span className="font-medium">₹{outstandingPrincipal.toLocaleString('en-IN')}</span>
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
                    : `${monthsPassed} months (${Math.max(0, monthsPassed - 1)} billable)`}
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
                    <span className="font-medium">₹{Math.round(outstandingPrincipal * (pledge.interestRate / 100)).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base text-muted-foreground">
                    <span>Calculation:</span>
                    <span className="font-medium">
                      {lastPartialDateText 
                        ? `${monthsPassed} months × ₹${Math.round(outstandingPrincipal * (pledge.interestRate / 100)).toLocaleString('en-IN')} = ₹${Math.round(grossInterestAccrued).toLocaleString('en-IN')}`
                        : `${Math.max(0, monthsPassed - 1)} months × ₹${Math.round(outstandingPrincipal * (pledge.interestRate / 100)).toLocaleString('en-IN')} = ₹${Math.round(grossInterestAccrued).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Paid:</span>
              <span className="font-medium text-green-500">
                ₹{Math.round(interestPaid).toLocaleString('en-IN')}
              </span>
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

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button type="submit">Record Payment</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
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
