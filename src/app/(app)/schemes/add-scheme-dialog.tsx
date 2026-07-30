"use client";

import { useState } from "react";
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
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InterestTier, Scheme } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2 } from "lucide-react";

const interestTierSchema = z.object({
  duration: z.coerce.number().min(1, "Duration must be at least 1."),
  rate: z.coerce.number().min(0.1, "Rate must be positive."),
});

const formSchema = z.object({
  name: z.string().min(2, "Scheme name must be at least 2 characters."),
  interestTiers: z.array(interestTierSchema).min(1, "At least one interest tier is required."),
  durationType: z.string().min(1, "Please select a duration type."),
  overdueInterestRate: z.coerce.number().min(0.1, "Overdue interest rate must be positive."),
  advanceInterest: z.boolean().default(false),
  maximumEligibility: z.coerce.number().min(1, "Maximum eligibility must be a positive number."),
  ratePerGram: z.coerce.number().min(1, "Rate per gram must be a positive number."),
});

type AddSchemeDialogProps = {
  children: React.ReactNode;
  onAddScheme: (scheme: Omit<Scheme, 'id' | 'shopId'>) => Promise<void>;
  disabled?: boolean;
};

export function AddSchemeDialog({ children, onAddScheme, disabled }: AddSchemeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      interestTiers: [{ duration: 3, rate: 2 }],
      durationType: "Months",
      overdueInterestRate: 3,
      advanceInterest: false,
      maximumEligibility: 50000,
      ratePerGram: 5000,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "interestTiers",
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
        const newScheme: Omit<Scheme, 'id' | 'shopId'> = {
          ...values,
          durationType: values.durationType as any,
        };
        await onAddScheme(newScheme);
        setOpen(false);
        form.reset();
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleOpenChange = (newOpenState: boolean) => {
    setOpen(newOpenState);
    if (!newOpenState) {
        form.reset();
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={disabled}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Scheme</DialogTitle>
          <DialogDescription>
            Enter the details for the new loan scheme, including interest tiers.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4 pl-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheme Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Monthly Gold Loan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Interest Rate Tiers</FormLabel>
              <div className="space-y-3 mt-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                    <FormField
                      control={form.control}
                      name={`interestTiers.${index}.duration`}
                      render={({ field }) => (
                        <FormItem className="col-span-5">
                           {index === 0 && <FormLabel>Duration</FormLabel>}
                          <FormControl>
                            <Input type="number" placeholder="e.g., 3" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name={`interestTiers.${index}.rate`}
                      render={({ field }) => (
                        <FormItem className="col-span-5">
                          {index === 0 && <FormLabel>Rate (%)</FormLabel>}
                          <FormControl>
                            <Input type="number" placeholder="e.g., 2" step="0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                 <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ duration: 3, rate: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Tier
                </Button>
              </div>
            </div>
            
            <FormField
                control={form.control}
                name="durationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tier Duration Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Months">Months</SelectItem>
                        <SelectItem value="Years">Years</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
              control={form.control}
              name="ratePerGram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate per Gram (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="maximumEligibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Loan Amount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="overdueInterestRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overdue Interest Rate (% p.m.)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="advanceInterest"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Advance Interest Taken</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Scheme
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
