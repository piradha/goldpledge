
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Pledge } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { createBankPledgeGroup } from "@/firebase/firestore/bank-pledges";
import { format } from "date-fns";

export function NewBankGroupDialog({ children, shopId }: { children: React.ReactNode, shopId: string }) {
    const [open, setOpen] = useState(false);
    const [bankName, setBankName] = useState("");
    const [bankLoanAmount, setBankLoanAmount] = useState<string>("");
    const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedPledgeIds, setSelectedPledgeIds] = useState<string[]>([]);
    const [appraisalFees, setAppraisalFees] = useState<string>("");
    const [authorisedPerson, setAuthorisedPerson] = useState("");
    const [bankInterestRate, setBankInterestRate] = useState<string>("");
    const [scheme, setScheme] = useState("");
    const [duration, setDuration] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchPledge, setSearchPledge] = useState("");

    const { firestore } = useFirebase();
    const { toast } = useToast();

    const pledgesQuery = useMemoFirebase(
        () => (firestore && shopId ? query(
            collection(firestore, 'pledges'),
            where('shopId', '==', shopId),
            where('status', '==', 'ACTIVE') // Only active pledges can be covered
        ) : null),
        [firestore, shopId]
    );

    const { data: pledges, isLoading } = useCollection<Pledge>(pledgesQuery);

    // Filter out pledges already in bank and apply search
    const availablePledges = useMemo(() => {
        if (!pledges) return [];
        return pledges.filter(p =>
            (!p.bankCoverage || p.bankCoverage.status === 'Released') &&
            (p.id.toLowerCase().includes(searchPledge.toLowerCase()) ||
                p.customerName.toLowerCase().includes(searchPledge.toLowerCase()))
        );
    }, [pledges, searchPledge]);

    const handleSelectPledge = (pledgeId: string) => {
        setSelectedPledgeIds(prev =>
            prev.includes(pledgeId)
                ? prev.filter(id => id !== pledgeId)
                : [...prev, pledgeId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !shopId) return;

        if (selectedPledgeIds.length === 0) {
            toast({
                title: "Validation Error",
                description: "Please select at least one pledge.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await createBankPledgeGroup(firestore, shopId, {
                bankName,
                bankLoanAmount: Number(bankLoanAmount) || 0,
                depositDate: new Date(depositDate).toISOString(),
                pledgeIds: selectedPledgeIds,
                appraisalFees: appraisalFees ? Number(appraisalFees) : 0,
                authorisedPerson,
                bankInterestRate: bankInterestRate ? Number(bankInterestRate) : 0,
                scheme,
                duration,
            });

            toast({
                title: "Success",
                description: "Bank loan created successfully.",
            });

            setOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Failed to create bank pledge group.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setBankName("");
        setBankLoanAmount("");
        setDepositDate(new Date().toISOString().split('T')[0]);
        setSelectedPledgeIds([]);
        setAppraisalFees("");
        setAuthorisedPerson("");
        setBankInterestRate("");
        setScheme("");
        setDuration("");
        setSearchPledge("");
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>Create Bank Loan</DialogTitle>
                        <DialogDescription>
                            Create a bank loan by grouping multiple pledges under a reference ID.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 pt-2">
                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bankName">Bank Name</Label>
                                    <Input
                                        id="bankName"
                                        placeholder="State Bank of India"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankLoanAmount">Loan amount (₹)</Label>
                                    <Input
                                        id="bankLoanAmount"
                                        type="number"
                                        placeholder="10000"
                                        value={bankLoanAmount}
                                        onChange={(e) => setBankLoanAmount(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="depositDate">Loan Date</Label>
                                    <Input
                                        id="depositDate"
                                        type="date"
                                        value={depositDate}
                                        onChange={(e) => setDepositDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="appraisalFees">Appraisal Fees (₹)</Label>
                                    <Input
                                        id="appraisalFees"
                                        type="number"
                                        placeholder="0"
                                        value={appraisalFees}
                                        onChange={(e) => setAppraisalFees(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="authorisedPerson">Authorised Person</Label>
                                    <Input
                                        id="authorisedPerson"
                                        placeholder="Enter name"
                                        value={authorisedPerson}
                                        onChange={(e) => setAuthorisedPerson(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankInterestRate">Rate of Interest (%)</Label>
                                    <Input
                                        id="bankInterestRate"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={bankInterestRate}
                                        onChange={(e) => setBankInterestRate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="scheme">Scheme</Label>
                                    <Input
                                        id="scheme"
                                        placeholder="Enter scheme"
                                        value={scheme}
                                        onChange={(e) => setScheme(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="duration">Duration</Label>
                                    <Input
                                        id="duration"
                                        placeholder="Enter duration"
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 border rounded-md p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <Label className="text-sm font-semibold">Select Pledges ({selectedPledgeIds.length} selected)</Label>
                                    <Input
                                        placeholder="Search ID or Customer..."
                                        className="h-8 w-40 text-xs"
                                        value={searchPledge}
                                        onChange={(e) => setSearchPledge(e.target.value)}
                                    />
                                </div>
                                <ScrollArea className="h-[200px] pr-4">
                                    {isLoading ? (
                                        <div className="text-center py-4 text-muted-foreground">Loading pledges...</div>
                                    ) : availablePledges.length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground">No active pledges available in safe.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {availablePledges.map((pledge) => (
                                                <div key={pledge.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md transition-colors border">
                                                    <Checkbox
                                                        id={`pledge-${pledge.id}`}
                                                        checked={selectedPledgeIds.includes(pledge.id)}
                                                        onCheckedChange={() => handleSelectPledge(pledge.id)}
                                                    />
                                                    <label
                                                        htmlFor={`pledge-${pledge.id}`}
                                                        className="flex-1 grid grid-cols-3 gap-2 text-sm cursor-pointer"
                                                    >
                                                        <span className="font-mono font-medium">{pledge.id}</span>
                                                        <span className="truncate">{pledge.customerName}</span>
                                                        <span className="text-right text-muted-foreground">₹{pledge.loanAmount.toLocaleString('en-IN')}</span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Creating..." : "Create Bank Loan"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
