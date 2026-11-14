'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Pledge, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, BookHeart, CreditCard, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function GenericMakePaymentPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [pledgeIdInput, setPledgeIdInput] = useState('');

  const userProfileQuery = useMemoFirebase(
    () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
    [firestore, user?.email]
  );
  const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
  const userProfile = userProfiles && userProfiles[0] ? userProfiles[0] : null;

  const pledgesQuery = useMemoFirebase(
    () =>
      firestore && userProfile?.shopId
        ? query(
            collection(firestore, 'pledges'),
            where('shopId', '==', userProfile.shopId),
            where('status', 'in', ['ACTIVE', 'OVERDUE']),
            limit(15)
          )
        : null,
    [firestore, userProfile?.shopId]
  );
  const { data: pledges, isLoading } = useCollection<Pledge>(pledgesQuery);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (pledgeIdInput.trim()) {
      router.push(`/pledges/${encodeURIComponent(pledgeIdInput.trim())}/make-payment`);
    }
  };

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/pledges">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Make Payment</h1>
          <p className="text-sm text-muted-foreground">Lookup a pledge by ID to record payments and view payment details</p>
        </div>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <span>Search Pledge by ID</span>
          </CardTitle>
          <CardDescription>
            Enter the Pledge ID to view paid interest, partial payment history, and make payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter Pledge ID (e.g. GLD-101)..."
                value={pledgeIdInput}
                onChange={(e) => setPledgeIdInput(e.target.value)}
                className="pl-9 h-10 text-base"
                autoFocus
              />
            </div>
            <Button type="submit" size="default" disabled={!pledgeIdInput.trim()} className="gap-2">
              <span>Open Payment Page</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookHeart className="h-5 w-5 text-primary" />
            <span>Active Pledges</span>
          </CardTitle>
          <CardDescription>
            Select an active pledge to make a payment and view paid interest & partial payment details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pledge ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Loan Amount</TableHead>
                  <TableHead className="text-right">Principal Paid</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pledges && pledges.length > 0 ? (
                  pledges.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-semibold">{p.id}</TableCell>
                      <TableCell className="font-medium">{p.customerName}</TableCell>
                      <TableCell className="text-right">₹{(Number(p.loanAmount) || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">₹{(Number(p.paidAmount) || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>{p.createdAt ? format(new Date(p.createdAt), 'dd-MMM-yyyy') : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'OVERDUE' ? 'destructive' : 'secondary'}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="default" className="gap-1.5">
                          <Link href={`/pledges/${p.id}/make-payment`}>
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Make Payment</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {isLoading ? 'Loading active pledges...' : 'No active pledges found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
