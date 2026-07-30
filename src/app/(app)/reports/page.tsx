"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyTransactionReport } from "./daily-transaction-report";
import { ActiveInventoryReport } from "./active-inventory-report";
import { OverdueReport } from "./overdue-report";
import { CashFlowReport } from "./cash-flow-report";

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                <p className="text-muted-foreground">
                    View insights, track transactions, and monitor business health.
                </p>
            </div>

            <Tabs defaultValue="daybook" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="daybook">Day Book</TabsTrigger>
                    <TabsTrigger value="inventory">Active Inventory</TabsTrigger>
                    <TabsTrigger value="overdue">Overdue Pledges</TabsTrigger>
                    <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
                </TabsList>

                <TabsContent value="daybook" className="space-y-4">
                    <DailyTransactionReport />
                </TabsContent>

                <TabsContent value="inventory" className="space-y-4">
                    <ActiveInventoryReport />
                </TabsContent>

                <TabsContent value="overdue" className="space-y-4">
                    <OverdueReport />
                </TabsContent>

                <TabsContent value="cashflow" className="space-y-4">
                    <CashFlowReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}
