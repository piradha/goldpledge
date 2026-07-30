
"use client";

import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BankPledgeGroup, Pledge, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search, PlusCircle, Building2, Calendar, FileCheck, CheckCircle2, XCircle, MoreHorizontal } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, doc, getDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { NewBankGroupDialog } from "./new-group-dialog";
import { calculateInterest } from "@/lib/interest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BankPledgesList() {
    const { firestore } = useFirebase();
    const { user } = useUser();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState("");
    const [pledgeSearchId, setPledgeSearchId] = useState("");
    const [foundPledge, setFoundPledge] = useState<Pledge | null>(null);
    const [isSearchingPledge, setIsSearchingPledge] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    const groupsQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'bank_pledge_groups'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: groups, isLoading: isLoadingGroups } = useCollection<BankPledgeGroup>(groupsQuery);

    const bankPledgesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'pledges'), where('shopId', '==', userProfile.shopId), where('bankCoverage.status', 'in', ['In Bank', 'Released'])) : null),
        [firestore, userProfile]
    );
    const { data: bankPledges, isLoading: isLoadingPledges } = useCollection<Pledge>(bankPledgesQuery);

    const activeGroups = useMemo(() => {
        if (!groups) return [];
        return groups.filter(g => g.status === 'In Bank' &&
            (g.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (g.bankLoanAmount?.toString().includes(searchTerm)))
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [groups, searchTerm]);



    const handleSearchPledge = async () => {
        if (!firestore || !pledgeSearchId) return;
        setIsSearchingPledge(true);
        try {
            const pledgeDoc = await getDoc(doc(firestore, 'pledges', pledgeSearchId));
            if (pledgeDoc.exists()) {
                setFoundPledge(pledgeDoc.data() as Pledge);
            } else {
                setFoundPledge(null);
                toast({
                    title: "Pledge Not Found",
                    description: `No pledge found with ID ${pledgeSearchId}`,
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Failed to search pledge",
                variant: "destructive"
            });
        } finally {
            setIsSearchingPledge(false);
        }
    };



    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Search Pledge Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <Search className="h-5 w-5" />
                            Search Pledge Bank Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter Pledge ID (e.g. ABC-123)"
                                value={pledgeSearchId}
                                onChange={(e) => setPledgeSearchId(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchPledge()}
                            />
                            <Button onClick={handleSearchPledge} disabled={isSearchingPledge}>
                                {isSearchingPledge ? "Searching..." : "Search"}
                            </Button>
                        </div>

                        {foundPledge && (
                            <div className="p-4 border rounded-xl bg-muted/40 backdrop-blur-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex justify-between items-center pb-2 border-b">
                                    <span className="font-bold text-lg">{foundPledge.id}</span>
                                    <Badge variant={foundPledge.bankCoverage?.status === 'In Bank' ? 'default' : 'secondary'}
                                        className={cn(foundPledge.bankCoverage?.status === 'In Bank' && "bg-blue-600 text-white")}
                                    >
                                        {foundPledge.bankCoverage ? (foundPledge.bankCoverage.status === 'In Bank' ? 'Currently in Bank' : 'Released from Bank') : 'In Safe (Not in Bank)'}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase">Customer</p>
                                        <p className="font-semibold">{foundPledge.customerName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase">Date of Interest</p>
                                        <p className="font-semibold">{format(new Date(foundPledge.createdAt), "dd MMM yyyy")}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase">Scheme</p>
                                        <p className="font-semibold text-primary">{foundPledge.schemeName || "General"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase">Interest Rate</p>
                                        <p className="font-semibold">{foundPledge.interestRate}% P.A.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase">Loan Amount</p>
                                        <p className="font-semibold text-green-600">₹{foundPledge.loanAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase">Interest Due</p>
                                        <p className="font-semibold text-rose-500">₹{calculateInterest(foundPledge).interestDue.toFixed(2)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase">Closing Date</p>
                                        <p className="font-semibold">{format(new Date(foundPledge.dueDate), "dd MMM yyyy")}</p>
                                    </div>

                                    {foundPledge.bankCoverage && (
                                        <>
                                            <Separator className="col-span-2 my-1" />
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground text-xs uppercase">Bank Name</p>
                                                <p className="font-medium text-blue-600">{foundPledge.bankCoverage.bankName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground text-xs uppercase">Loan Amount</p>
                                                <p className="font-mono font-medium">₹{foundPledge.bankCoverage.bankLoanAmount}</p>
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <p className="text-muted-foreground text-xs uppercase">Loan Date</p>
                                                <p>{format(new Date(foundPledge.bankCoverage.depositDate), "PPP")}</p>
                                            </div>
                                            {foundPledge.bankCoverage.scheme && (
                                                <div className="space-y-1 text-xs">
                                                    <p className="text-muted-foreground uppercase">Bank Scheme</p>
                                                    <p className="font-bold">{foundPledge.bankCoverage.scheme}</p>
                                                </div>
                                            )}
                                            {foundPledge.bankCoverage.duration && (
                                                <div className="space-y-1 text-xs">
                                                    <p className="text-muted-foreground uppercase">Bank Duration</p>
                                                    <p className="font-bold">{foundPledge.bankCoverage.duration}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-primary/70 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Management Guide
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm leading-relaxed">
                        <p>Track your high-value assets securely. Move items between your **Safe** and **Bank Vaults** with full traceability.</p>
                        <div className="p-3 bg-background/50 rounded-lg border border-primary/10 space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                                <p>Select group of pledges to move to bank.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                                <p>Generate Bank Reference ID and store it here.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                                <p>Pledges are automatically tracked as released when they are closed by the customer.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden border-none shadow-xl ring-1 ring-border">
                <CardHeader className="bg-muted/30 pb-0">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4">
                        <CardTitle className="text-xl">Bank Pledge Inventory</CardTitle>
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search by Bank, Ref, or ID..."
                                    className="pl-9 w-64 bg-background/80"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <NewBankGroupDialog shopId={userProfile?.shopId || ""}>
                                <Button className="gap-2 shadow-lg shadow-primary/20">
                                    <PlusCircle className="h-4 w-4" />
                                    Create Bank Loan
                                </Button>
                            </NewBankGroupDialog>
                        </div>
                    </div>

                    <Tabs defaultValue="active" className="w-full">
                        <TabsList className="grid w-full grid-cols-1 max-w-[200px] mb-4">
                            <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                Active in Bank ({activeGroups.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-0">
                            <div className="border-t bg-background">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-bold uppercase text-[10px] tracking-wider">Loan amount</TableHead>
                                            <TableHead className="font-bold uppercase text-[10px] tracking-wider">Bank Name</TableHead>
                                            <TableHead className="font-bold uppercase text-[10px] tracking-wider">Loan Date</TableHead>
                                            <TableHead className="text-center font-bold uppercase text-[10px] tracking-wider"># Pledges</TableHead>
                                            <TableHead className="text-right font-bold uppercase text-[10px] tracking-wider">Total Loan</TableHead>
                                            <TableHead className="text-right font-bold uppercase text-[10px] tracking-wider">Appraisal Fees</TableHead>
                                            <TableHead className="font-bold uppercase text-[10px] tracking-wider">Status</TableHead>
                                            <TableHead className="text-right font-bold uppercase text-[10px] tracking-wider">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingGroups ? Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                        )) : activeGroups.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No active bank groups found.</TableCell></TableRow>
                                        ) : activeGroups.map((group) => {
                                            const isExpanded = expandedGroups.includes(group.id);
                                            const groupTotalLoan = group.pledgeIds.reduce((sum, id) => {
                                                const p = bankPledges?.find(bp => bp.id === id);
                                                return sum + (p?.loanAmount || 0);
                                            }, 0);

                                            return (
                                                <React.Fragment key={group.id}>
                                                    <TableRow className="group/row">
                                                        <TableCell className="font-bold text-sm">₹{(group.bankLoanAmount || 0).toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="font-bold text-blue-600">{group.bankName}</TableCell>
                                                        <TableCell className="font-medium">{format(new Date(group.depositDate), "MMMM do, yyyy")}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge
                                                                variant="outline"
                                                                className="cursor-pointer hover:bg-muted gap-2 py-1 px-3"
                                                                onClick={() => toggleGroup(group.id)}
                                                            >
                                                                {group.pledgeIds.length}
                                                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-primary">₹{groupTotalLoan.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right font-medium">₹{group.appraisalFees || 0}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className="bg-blue-600/10 text-blue-600 border-blue-200 text-[10px]">
                                                                In Bank
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                    <DropdownMenuItem onClick={() => toggleGroup(group.id)}>
                                                                        {isExpanded ? "Hide Pledges" : "View Pledges"}
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && (
                                                        <TableRow className="bg-muted/30 border-b-2">
                                                            <TableCell colSpan={8} className="p-0">
                                                                <div className="px-6 py-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="space-y-1">
                                                                            <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Loan Details</p>
                                                                            <div className="flex gap-4 text-xs">
                                                                                {group.authorisedPerson && (
                                                                                    <span className="bg-muted px-2 py-0.5 rounded border">
                                                                                        Auth: <span className="font-bold">{group.authorisedPerson}</span>
                                                                                    </span>
                                                                                )}
                                                                                {group.bankInterestRate !== undefined && (
                                                                                    <span className="bg-muted px-2 py-0.5 rounded border">
                                                                                        Rate: <span className="font-bold">{group.bankInterestRate}%</span>
                                                                                    </span>
                                                                                )}
                                                                                {group.scheme && (
                                                                                    <span className="bg-muted px-2 py-0.5 rounded border text-blue-600">
                                                                                        Scheme: <span className="font-bold">{group.scheme}</span>
                                                                                    </span>
                                                                                )}
                                                                                {group.duration && (
                                                                                    <span className="bg-muted px-2 py-0.5 rounded border text-purple-600">
                                                                                        Duration: <span className="font-bold">{group.duration}</span>
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Group Contents</p>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {group.pledgeIds.map(pledgeId => {
                                                                                const p = bankPledges?.find(bp => bp.id === pledgeId);
                                                                                const isReleased = p?.bankCoverage?.status === 'Released';

                                                                                return (
                                                                                    <div key={pledgeId} className={cn(
                                                                                        "flex items-center justify-between p-3 rounded-lg border bg-background transition-all",
                                                                                        isReleased ? "opacity-60 grayscale border-dashed" : "shadow-sm hover:border-primary/30"
                                                                                    )}>
                                                                                        <div className="space-y-1">
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-mono font-bold text-sm">{pledgeId}</span>
                                                                                                <span className="text-[10px] text-muted-foreground font-medium">{p?.customerName}</span>
                                                                                            </div>
                                                                                            {isReleased && <Badge variant="secondary" className="text-[9px] h-4">Released</Badge>}
                                                                                        </div>
                                                                                        {p && (
                                                                                            <div className="text-right">
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="text-xs font-bold text-green-600">₹{p.loanAmount.toLocaleString('en-IN')}</span>
                                                                                                    <span className="text-[9px] text-muted-foreground">{p.schemeName || "General"} ({p.interestRate}%)</span>
                                                                                                </div>
                                                                                                <div className="text-[9px] text-rose-500 font-medium">
                                                                                                    Int: ₹{calculateInterest(p).interestDue.toFixed(2)}
                                                                                                </div>
                                                                                                <div className="text-[8px] text-muted-foreground">
                                                                                                    Since: {format(new Date(p.createdAt), "dd/MM/yy")}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>


                    </Tabs>
                </CardHeader>
            </Card >
        </div >
    );
}
