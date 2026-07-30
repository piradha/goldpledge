
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
import { Customer, UserProfile } from "@/lib/types";
import { Camera, FileImage, Loader2, User, SwitchCamera } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCollection, useDoc, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { addCustomer } from "@/firebase/firestore/customers";
import { collection, where, query, doc } from "firebase/firestore";
import Image from "next/image";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  fatherName: z.string().min(2, "Father's name must be at least 2 characters."),
  mobile: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid mobile number."),
  alternateMobile: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid mobile number.").optional().or(z.literal("")),
  street1: z.string().min(2, "Street is required."),
  street2: z.string().optional(),
  district: z.string().min(2, "District is required."),
  idProofType: z.string().min(1, "Please select an ID proof type."),
  idProofNumber: z.string().min(2, "ID proof number is required."),
  reference: z.string().optional(),
  photoDataUrl: z.string().optional(),
});

type AddCustomerDialogProps = {
  children: React.ReactNode;
};

export function AddCustomerDialog({ children }: AddCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [cameraFor, setCameraFor] = useState<'customer' | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [customerPhoto, setCustomerPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const userProfileQuery = useMemoFirebase(
    () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
    [firestore, user?.email]
  );
  const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
  const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

  const customersQuery = useMemoFirebase(
    () => (firestore && userProfile ? query(collection(firestore, 'customers'), where('shopId', '==', userProfile.shopId)) : null),
    [firestore, userProfile]
  );
  const { data: customers } = useCollection<Customer>(customersQuery);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      fatherName: "",
      mobile: "",
      alternateMobile: "",
      street1: "",
      street2: "",
      district: "",
      idProofType: "",
      idProofNumber: "",
      reference: "",
      photoDataUrl: "",
    },
  });

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
        // Stop any existing camera stream before starting a new one
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
            description: 'Please enable camera permissions in your browser settings to use this app.',
          });
          setCameraFor(null);
        }
      };

      getCameraPermission();
    } else {
        stopCamera();
    }
    
    // This cleanup function will run when the component unmounts or when dependencies change
    return () => {
        stopCamera();
    }
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
              form.setValue("photoDataUrl", dataUrl);
            }
            setCameraFor(null);
        }
    }
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !userProfile) {
        toast({ variant: "destructive", title: "You must be logged in to add a customer." });
        return;
    }
    
    setIsSubmitting(true);

    try {
        const newCustomer: Omit<Customer, 'id' | 'createdAt'> = {
            shopId: userProfile.shopId,
            name: values.name,
            fatherName: values.fatherName,
            mobileNumber: values.mobile,
            alternateMobile: values.alternateMobile || "",
            address: `${values.street1}${values.street2 ? `, ${values.street2}` : ''}, ${values.district}`,
            idProofType: values.idProofType as any,
            idProofNumber: values.idProofNumber,
            reference: values.reference || "",
            photoUrl: values.photoDataUrl || "",
            idProofPhotoUrl: "",
            notes: '',
        };

        await addCustomer(firestore, newCustomer);
        
        toast({
          title: "Customer Added",
          description: `${newCustomer.name} has been added to the customer list.`,
        });

        setOpen(false);
        form.reset();
        setCustomerPhoto(null);
    } catch (error) {
        console.error("Error adding customer:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to add customer. Please try again.'
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
        form.reset();
        setCustomerPhoto(null);
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>
            Enter the details of the new customer below.
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
                      <AlertDescription>
                          Please allow camera access in your browser settings and try again.
                      </AlertDescription>
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
                                <img src={customerPhoto} alt="Customer photo" className="w-full h-full rounded-full object-cover" />
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
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g. John Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                        <FormField control={form.control} name="fatherName" render={({ field }) => ( <FormItem> <FormLabel>Father's Name</FormLabel><FormControl><Input placeholder="e.g. Richard Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                    </div>
                  </div>
                 
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="mobile" render={({ field }) => ( <FormItem> <FormLabel>Mobile Number</FormLabel><FormControl><Input placeholder="+91 9876543210" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                    <FormField control={form.control} name="alternateMobile" render={({ field }) => ( <FormItem> <FormLabel>Alternate Number</FormLabel><FormControl><Input placeholder="+91 9876543211" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                  </div>
                
                  <FormField control={form.control} name="street1" render={({ field }) => ( <FormItem> <FormLabel>Street 1</FormLabel><FormControl><Input placeholder="House No, Building Name" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                  <FormField control={form.control} name="street2" render={({ field }) => ( <FormItem> <FormLabel>Street 2</FormLabel><FormControl><Input placeholder="Area, Colony" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="district" render={({ field }) => ( <FormItem> <FormLabel>District</FormLabel><FormControl><Input placeholder="e.g. Mumbai" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                    <FormField
                      control={form.control}
                      name="idProofType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID Proof Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select ID Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Aadhar">Aadhar</SelectItem>
                              <SelectItem value="PAN">PAN</SelectItem>
                              <SelectItem value="Driving Licence">Driving Licence</SelectItem>
                              <SelectItem value="Others">Others</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="idProofNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proof Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter ID Proof Number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                      control={form.control}
                      name="reference"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Reference (Existing Customer)</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                      <SelectTrigger>
                                          <SelectValue placeholder="Select a customer (optional)" />
                                      </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.mobileNumber}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
                <DialogFooter className="pt-4 sticky bottom-0 bg-background/95 pb-2">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Customer
                    </Button>
                </DialogFooter>
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

    