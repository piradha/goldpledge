
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Customer } from "@/lib/types";
import { Camera, Loader2, User, SwitchCamera } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { updateCustomer } from "@/firebase/firestore/customers";
import { collection, query, where } from "firebase/firestore";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  fatherName: z.string().min(2, "Father's name must be at least 2 characters."),
  mobileNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid mobile number."),
  alternateMobile: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid mobile number.").optional().or(z.literal("")),
  street1: z.string().min(2, "Street is required."),
  street2: z.string().optional(),
  district: z.string().min(2, "District is required."),
  idProofType: z.string().min(1, "Please select an ID proof type."),
  idProofNumber: z.string().min(2, "ID proof number is required."),
  idProofPhotoUrl: z.string().optional(),
  reference: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
});

type EditCustomerDialogProps = {
  children?: React.ReactNode;
  customer: Customer;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function EditCustomerDialog({ children, customer, open: controlledOpen, onOpenChange: controlledOnOpenChange }: EditCustomerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [cameraFor, setCameraFor] = useState<'customer' | 'idProof' | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [customerPhoto, setCustomerPhoto] = useState<string | null>(customer.photoUrl);
  const [idProofPhoto, setIdProofPhoto] = useState<string | null>(customer.idProofPhotoUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { toast } = useToast();
  const { firestore } = useFirebase();

  const otherCustomersQuery = useMemoFirebase(
    () => (firestore && customer ? query(collection(firestore, 'customers'), where('shopId', '==', customer.shopId)) : null),
    [firestore, customer]
  );
  const { data: otherCustomers } = useCollection<Customer>(otherCustomersQuery);

  const parseAddress = (address: string) => {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const district = parts.pop() || '';
      const street1 = parts.join(', ');
      return { street1, street2: '', district };
    }
    return { street1: address, street2: '', district: '' };
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: customer.name || "",
      fatherName: customer.fatherName || "",
      mobileNumber: customer.mobileNumber || "",
      alternateMobile: customer.alternateMobile || "",
      street1: parseAddress(customer.address).street1,
      street2: parseAddress(customer.address).street2,
      district: parseAddress(customer.address).district,
      idProofType: customer.idProofType || "",
      idProofType: customer.idProofType || "",
      idProofNumber: customer.idProofNumber || "",
      idProofPhotoUrl: customer.idProofPhotoUrl || "",
      reference: customer.reference || "",
      photoUrl: customer.photoUrl || "",
      notes: customer.notes || "",
    },
  });

  useEffect(() => {
    if (open) {
      const { street1, street2, district } = parseAddress(customer.address);
      form.reset({
        name: customer.name || "",
        fatherName: customer.fatherName || "",
        mobileNumber: customer.mobileNumber || "",
        alternateMobile: customer.alternateMobile || "",
        street1: street1,
        street2: street2,
        district: district,
        idProofType: customer.idProofType || "",
        idProofType: customer.idProofType || "",
        idProofNumber: customer.idProofNumber || "",
        idProofPhotoUrl: customer.idProofPhotoUrl || "",
        reference: customer.reference || "",
        photoUrl: customer.photoUrl || "",
        notes: customer.notes || "",
      });
      setCustomerPhoto(customer.photoUrl);
      setIdProofPhoto(customer.idProofPhotoUrl || null);
    }
  }, [open, customer, form]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (cameraFor) {
      const getCameraPermission = async () => {
        stopCamera();
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
          setCameraFor(null);
        }
      };
      getCameraPermission();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [cameraFor, facingMode, toast, stopCamera]);

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const takePicture = () => {
    if (videoRef.current && canvasRef.current && cameraFor) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/png');
        if (cameraFor === 'customer') {
          setCustomerPhoto(dataUrl);
          form.setValue("photoUrl", dataUrl);
        } else if (cameraFor === 'idProof') {
          setIdProofPhoto(dataUrl);
          form.setValue("idProofPhotoUrl", dataUrl);
        }
        setCameraFor(null);
      }
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
      toast({ variant: "destructive", title: "Error", description: "Database not available." });
      return;
    }
    setIsSubmitting(true);
    try {
      const updatedCustomerData = {
        ...values,
        address: `${values.street1}${values.street2 ? `, ${values.street2}` : ''}, ${values.district}`,
      }

      const { street1, street2, district, ...finalData } = updatedCustomerData;

      await updateCustomer(firestore, customer.id, finalData);
      toast({
        title: "Customer Updated",
        description: `${values.name}'s details have been updated.`,
      });
      setOpen(false);
    } catch (error) {
      console.error("Error updating customer:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update customer. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleOpenChange = (newOpenState: boolean) => {
    setOpen(newOpenState);
    if (!newOpenState) {
      setCameraFor(null);
      stopCamera();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Customer: {customer.name}</DialogTitle>
          <DialogDescription>
            Update the customer details below.
          </DialogDescription>
        </DialogHeader>
        {cameraFor ? (
          <div className="space-y-4">
            <div className="relative">
              <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
            </div>
            {hasCameraPermission === false && (
              <Alert variant="destructive">
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>Please allow camera access in your browser settings and try again.</AlertDescription>
              </Alert>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCameraFor(null)}>Cancel</Button>
              <Button variant="outline" size="icon" onClick={toggleFacingMode} disabled={hasCameraPermission !== true}>
                <SwitchCamera className="h-4 w-4" />
              </Button>
              <Button onClick={takePicture} disabled={hasCameraPermission !== true}>Take Picture</Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[70vh] overflow-y-auto pr-4 pl-1 space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                      {customerPhoto ? (
                        <img src={customerPhoto} alt="Customer photo" width={96} height={96} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-muted-foreground" />
                      )}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCameraFor('customer')}>
                      <Camera className="mr-2 h-4 w-4" />
                      {customerPhoto ? 'Retake Photo' : 'Take Photo'}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormLabel>Father's Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Add notes here..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="mobileNumber" render={({ field }) => (<FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="alternateMobile" render={({ field }) => (<FormItem><FormLabel>Alternate Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <FormField control={form.control} name="street1" render={({ field }) => (<FormItem> <FormLabel>Street 1</FormLabel><FormControl><Input placeholder="House No, Building Name" {...field} /></FormControl> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="street2" render={({ field }) => (<FormItem> <FormLabel>Street 2</FormLabel><FormControl><Input placeholder="Area, Colony" {...field} /></FormControl> <FormMessage /> </FormItem>)} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="district" render={({ field }) => (<FormItem> <FormLabel>District</FormLabel><FormControl><Input placeholder="e.g. Mumbai" {...field} /></FormControl> <FormMessage /> </FormItem>)} />
                  <FormField control={form.control} name="idProofType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Proof Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select ID Type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Aadhar">Aadhar</SelectItem>
                          <SelectItem value="PAN">PAN</SelectItem>
                          <SelectItem value="Driving Licence">Driving Licence</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <FormField control={form.control} name="idProofNumber" render={({ field }) => (<FormItem><FormLabel>Proof Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="flex items-center gap-2 pb-1">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden border">
                      {idProofPhoto ? (
                        <img src={idProofPhoto} alt="ID Proof" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground text-center px-1">No Img</span>
                      )}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCameraFor('idProof')}>
                      <Camera className="h-4 w-4 mr-2" />
                      {idProofPhoto ? 'Retake' : 'Scan ID'}
                    </Button>
                  </div>
                </div>

                <FormField control={form.control} name="reference" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (Existing Customer)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a customer (optional)" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {otherCustomers?.filter(c => c.id !== customer.id).map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.mobileNumber}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4 sticky bottom-0 bg-background/95 pb-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

