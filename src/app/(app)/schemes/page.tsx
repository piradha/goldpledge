

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useDoc, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { MoreHorizontal, PlusCircle, Search, X } from "lucide-react";
import { collection, query, where, doc } from "firebase/firestore";
import { Scheme, UserProfile } from "@/lib/types";
import { AddSchemeDialog } from "./add-scheme-dialog";
import { addScheme, deleteScheme, updateScheme } from "@/firebase/firestore/schemes";
import { DeleteSchemeDialog } from "./delete-scheme-dialog";
import { useToast } from "@/hooks/use-toast";
import { EditSchemeDialog } from "./edit-scheme-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

function SchemeRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-6 w-12" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
    </TableRow>
  )
}

export default function SchemesPage() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [schemeToEdit, setSchemeToEdit] = useState<Scheme | null>(null);

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

  const filteredSchemes = useMemo(() => {
    if (!schemes) return [];
    if (!searchTerm.trim()) return schemes;
    const term = searchTerm.trim().toLowerCase();
    return schemes.filter((scheme) =>
      scheme.name?.toLowerCase().includes(term)
    );
  }, [schemes, searchTerm]);

  const handleAddScheme = async (newScheme: Omit<Scheme, "id" | "shopId">) => {
    if (!firestore || !userProfile) {
      toast({ variant: "destructive", title: "Error", description: "Cannot add scheme: User profile not loaded." });
      return;
    };
    try {
      await addScheme(firestore, { ...newScheme, shopId: userProfile.shopId });
      toast({
        title: "Scheme Added",
        description: `The "${newScheme.name}" scheme has been created.`,
      });
    } catch (error) {
      console.error("Error adding scheme:", error);
      toast({
        variant: "destructive",
        title: "Error Adding Scheme",
        description: "Failed to add scheme. Please try again.",
      });
    }
  };

  const handleEditScheme = async (schemeId: string, updatedScheme: Omit<Scheme, "id" | "shopId">) => {
    if (!firestore || !userProfile) {
      toast({ variant: "destructive", title: "Error", description: "Cannot update scheme: User profile not loaded." });
      return;
    }
    try {
      await updateScheme(firestore, schemeId, { ...updatedScheme, shopId: userProfile.shopId });
      toast({
        title: "Scheme Updated",
        description: `The "${updatedScheme.name}" scheme has been updated.`,
      });
    } catch (error) {
      console.error("Error updating scheme:", error);
      toast({
        variant: "destructive",
        title: "Error Updating Scheme",
        description: "Failed to update scheme. Please try again.",
      });
    }
  };

  const handleDeleteScheme = (schemeId: string) => {
    if (!firestore) return;
    deleteScheme(firestore, schemeId);
    toast({
      title: "Scheme Deleted",
      description: "The scheme has been successfully deleted.",
    })
  }

  const isLoading = isLoadingSchemes || isUserLoading || isLoadingProfile;

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row items-center gap-4">
        <CardTitle className="flex-1">Schemes</CardTitle>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by scheme name..."
              className="pl-9 pr-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>
          <AddSchemeDialog onAddScheme={handleAddScheme} disabled={isLoading}>
            <Button size="sm" className="gap-2 whitespace-nowrap" disabled={isLoading}>
              <PlusCircle className="h-4 w-4" />
              Add Scheme
            </Button>
          </AddSchemeDialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scheme Name</TableHead>
              <TableHead>Interest Tiers</TableHead>
              <TableHead>Overdue Rate</TableHead>
              <TableHead>Rate Per Gram</TableHead>
              <TableHead>Max Loan Amount</TableHead>
              <TableHead>Advance Interest</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <SchemeRowSkeleton key={i} />)}
            {!isLoading && filteredSchemes.map((scheme) => (
              <TableRow key={scheme.id}>
                <TableCell className="font-medium">{scheme.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {Array.isArray(scheme.interestTiers) && scheme.interestTiers.map((tier, index) => (
                      <span key={index} className="text-xs">
                        {tier.rate}% for {tier.duration} {scheme.durationType}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{scheme.overdueInterestRate}%</TableCell>
                <TableCell>
                  ₹{(scheme.ratePerGram ?? 0).toLocaleString('en-IN')}
                </TableCell>
                <TableCell>
                  ₹{(scheme.maximumEligibility ?? 0).toLocaleString('en-IN')}
                </TableCell>
                <TableCell>
                  <Badge variant={scheme.advanceInterest ? "secondary" : "outline"}>
                    {scheme.advanceInterest ? "Yes" : "No"}
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
                      <DropdownMenuItem onClick={() => setSchemeToEdit(scheme)}>
                        Edit
                      </DropdownMenuItem>
                      <DeleteSchemeDialog scheme={scheme} onDeleteScheme={handleDeleteScheme}>
                        <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-destructive focus:bg-destructive/10">Delete</button>
                      </DeleteSchemeDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && schemes && schemes.length > 0 && filteredSchemes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No schemes found matching &quot;{searchTerm}&quot;.
          </div>
        )}
        {!isLoading && !schemes?.length && (
          <div className="text-center py-12 text-muted-foreground">
            No schemes created yet.
          </div>
        )}
      </CardContent>
      {schemeToEdit && (
        <EditSchemeDialog
          scheme={schemeToEdit}
          onEditScheme={handleEditScheme}
          open={!!schemeToEdit}
          onOpenChange={(open) => !open && setSchemeToEdit(null)}
        />
      )}
    </Card>
  );
}
