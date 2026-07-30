
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Pledge } from "@/lib/types";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";

const chartConfig = {
  active: {
    label: "Active",
    color: "hsl(var(--chart-2))",
  },
  closed: {
    label: "Closed",
    color: "hsl(var(--chart-4))",
  },
  overdue: {
    label: "Overdue",
    color: "hsl(var(--destructive))",
  }
};

export function DashboardCharts({ pledges, isLoading }: { pledges: Pledge[], isLoading: boolean }) {

  const monthlyPledgeData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const data = monthNames.map(month => ({ name: month, newPledges: 0 }));

    pledges.forEach(pledge => {
      const monthIndex = new Date(pledge.createdAt).getMonth();
      if (data[monthIndex]) {
        data[monthIndex].newPledges += 1;
      }
    });

    return data;
  }, [pledges]);

  const pledgeStatusData = useMemo(() => {
    const statuses = { active: 0, closed: 0, overdue: 0 };
    pledges.forEach(p => {
      if (p.status === 'ACTIVE') statuses.active++;
      else if (p.status === 'CLOSED') statuses.closed++;
      else if (p.status === 'OVERDUE') statuses.overdue++;
    });
    return [
      { name: 'Active', value: statuses.active, fill: 'var(--color-active)' },
      { name: 'Closed', value: statuses.closed, fill: 'var(--color-closed)' },
      { name: 'Overdue', value: statuses.overdue, fill: 'var(--color-overdue)' }
    ];
  }, [pledges]);


  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
          <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
        </Card>
         <Card>
          <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
          <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>New Pledges by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={monthlyPledgeData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Bar dataKey="newPledges" fill="var(--color-active)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pledge Status Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <PieChart>
               <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie data={pledgeStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
