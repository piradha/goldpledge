

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
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { collection, query, where, doc } from "firebase/firestore";
import { Scheme, UserProfile } from "@/lib/types";
import { AddSchemeDialog } from "./add-scheme-dialog";
import { addScheme, deleteScheme, updateScheme } from "@/firebase/firestore/schemes";
import { DeleteSchemeDialog } from "./delete-scheme-dialog";
import { useToast } from "@/hooks/use-toast";
import { EditSchemeDialog } from "./edit-scheme-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
      <CardHeader className="flex flex-row items-center gap-4">
        <CardTitle className="flex-1">Schemes</CardTitle>
        <AddSchemeDialog onAddScheme={handleAddScheme} disabled={isLoading}>
          <Button size="sm" className="gap-2" disabled={isLoading}>
            <PlusCircle className="h-4 w-4" />
            Add Scheme
          </Button>
        </AddSchemeDialog>
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
            {!isLoading && schemes?.map((scheme) => (
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
