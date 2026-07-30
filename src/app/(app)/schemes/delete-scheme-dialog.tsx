
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Scheme } from "@/lib/types";

type DeleteSchemeDialogProps = {
  children: React.ReactNode;
  scheme: Scheme;
  onDeleteScheme: (schemeId: string) => void;
};

export function DeleteSchemeDialog({ children, scheme, onDeleteScheme }: DeleteSchemeDialogProps) {
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    onDeleteScheme(scheme.id);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this scheme?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the scheme named "{scheme.name}". This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
