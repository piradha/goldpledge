'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCharts } from "./dashboard-charts";
import { useCollection, useDoc, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { Pledge, UserProfile, Payment } from "@/lib/types";
import { collection, doc, query, where } from "firebase/firestore";
import { Banknote, BookHeart, CalendarClock, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

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

export default function DashboardPage() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  const userProfileQuery = useMemoFirebase(
    () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
    [firestore, user?.email]
  );
  const { data: userProfiles, isLoading: isLoadingProfile } = useCollection<UserProfile>(userProfileQuery);
  const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

  const shopPledgesQuery = useMemoFirebase(
    () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId)) : null),
    [firestore, userProfile]
  );
  
  const { data: pledges, isLoading: isLoadingPledges } = useCollection<Pledge>(shopPledgesQuery);

  const shopPaymentsQuery = useMemoFirebase(
    () => (firestore && userProfile ? query(collection(firestore, 'payments'), where('shopId', '==', userProfile.shopId)) : null),
    [firestore, userProfile]
  );
  const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(shopPaymentsQuery);

  const isLoading = isUserLoading || isLoadingPledges || isLoadingProfile || isLoadingPayments;

  const activePledges = pledges?.filter(p => p.status === 'ACTIVE' || p.status === 'OVERDUE') || [];
  const totalLoanAmount = activePledges.reduce((sum, p) => sum + Number(p.loanAmount), 0);
  
  const { totalGoldWeight, totalSilverWeight } = useMemo(() => {
    return activePledges.reduce(
      (acc, pledge) => {
        pledge.items.forEach(item => {
          if (item.metalType === 'Gold') {
            acc.totalGoldWeight += Number(item.netWeight) || 0;
          } else if (item.metalType === 'Silver') {
            acc.totalSilverWeight += Number(item.netWeight) || 0;
          }
        });
        return acc;
      },
      { totalGoldWeight: 0, totalSilverWeight: 0 }
    );
  }, [activePledges]);

  const overduePledges = pledges?.filter(p => p.status === 'OVERDUE').length || 0;
  const releasedPledges = pledges?.filter(p => p.status === 'CLOSED').length || 0;

  const todaysIncome = useMemo(() => {
    if (!payments) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

    return payments.reduce((sum, payment) => {
        const paymentDate = new Date(payment.paymentDate);
        if (paymentDate >= today && paymentDate < tomorrow) {
            return sum + (Number(payment.amount) || 0);
        }
        return sum;
    }, 0);
  }, [payments]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <MetricCard
          icon={Scale}
          title="Total Gold Pledged"
          value={`${totalGoldWeight.toFixed(2)}g`}
          isLoading={isLoading}
        />
        <MetricCard
          icon={Scale}
          title="Total Silver Pledged"
          value={`${totalSilverWeight.toFixed(2)}g`}
          isLoading={isLoading}
        />
        <MetricCard
          icon={Banknote}
          title="Total Active Loan"
          value={`₹${Math.round(totalLoanAmount).toLocaleString('en-IN')}`}
          isLoading={isLoading}
        />
        <MetricCard
          icon={TrendingUp}
          title="Today's Income"
          value={`₹${Math.round(todaysIncome).toLocaleString('en-IN')}`}
          isLoading={isLoading}
        />
        <MetricCard
          icon={BookHeart}
          title="Active Pledges"
          value={activePledges.length}
          isLoading={isLoading}
        />
        <MetricCard
          icon={TrendingDown}
          title="Released Pledges"
          value={releasedPledges}
          isLoading={isLoading}
        />
        <MetricCard
          icon={CalendarClock}
          title="Overdue Pledges"
          value={overduePledges}
          isLoading={isLoading}
        />
      </div>
      <DashboardCharts pledges={pledges || []} isLoading={isLoading} />
    </div>
  );
}
